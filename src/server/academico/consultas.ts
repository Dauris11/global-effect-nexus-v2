import { consultar, consultarUna } from "@/lib/db";

/**
 * El módulo académico: períodos, materias universitarias y calificaciones.
 *
 * Los dos primeros son la columna vertebral. Todo lo demás cuelga de ahí: los
 * cursos técnicos apuntan a un período, la matrícula apunta a una materia y a
 * un período, y el historial se agrupa por cuatrimestre. Sin filas en esas dos
 * tablas no hay nada que calificar, seleccionar ni historiar.
 *
 * Las calificaciones van al final del archivo, con su propia cabecera.
 *
 * Va separado de `@/server/profesor/consultas` a propósito: aquel responde
 * "¿qué es MÍO?" y filtra por docente en cada consulta; este responde "¿qué
 * OFRECE la Fundación?" y no filtra por nadie. Mezclarlos obligaría a arrastrar
 * un `docenteId` por consultas a las que no les significa nada.
 *
 * Las materias de aquí son las de la carrera universitaria del becado. Los
 * cursos técnicos viven en `curso` y las clases del programa en `materia_360`:
 * son tres cosas distintas y ninguna consulta las junta.
 */

/** Tope de filas del catálogo. Coincide con `academic.limitHint`. */
const TOPE = 200;

export type PeriodoGestionado = {
  id: string;
  nombre: string;
  /** `semestre` o `cuatrimestre` (migración 0028). */
  tipo: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: string;
  /**
   * Dónde cae HOY respecto al período. Lo calcula la base, no el navegador.
   *
   * Los tres se usan para avisar de incoherencias: un período marcado activo
   * cuyas fechas ya pasaron, o uno planificado que ya empezó. Esa comparación
   * decide qué se le enseña a coordinación, así que no puede depender del reloj
   * del dispositivo de quien mira.
   */
  en_curso: boolean;
  ya_empezo: boolean;
  ya_termino: boolean;
  /** Lo que cuelga del período, para saber si se puede borrar y qué se perdería. */
  materias: number;
  cursos: number;
  inscripciones: number;
};

/**
 * Los períodos, del más reciente al más antiguo.
 *
 * `en_curso` lo decide PostgreSQL con `CURRENT_DATE` y no el cliente con `new
 * Date()`: el navegador va con la hora del dispositivo, y un portátil con la
 * fecha mal puesta enseñaría el cuatrimestre equivocado como activo.
 *
 * Los tres conteos van en subconsultas y no en `LEFT JOIN` con `GROUP BY`:
 * tres joins sobre la misma fila multiplican las filas entre sí y los conteos
 * salen inflados. Son listas de decenas de períodos, no de miles.
 */
export async function periodosGestionados(): Promise<PeriodoGestionado[]> {
  return consultar<PeriodoGestionado>(
    `SELECT p.id,
            p.nombre,
            p.tipo,
            p.fecha_inicio::text AS fecha_inicio,
            p.fecha_fin::text    AS fecha_fin,
            p.estado,
            (CURRENT_DATE BETWEEN p.fecha_inicio AND p.fecha_fin) AS en_curso,
            (CURRENT_DATE >= p.fecha_inicio) AS ya_empezo,
            (CURRENT_DATE >  p.fecha_fin)    AS ya_termino,
            (SELECT count(*)::int FROM materia     m WHERE m.periodo_id = p.id) AS materias,
            (SELECT count(*)::int FROM curso       c WHERE c.periodo_id = p.id) AS cursos,
            (SELECT count(*)::int FROM inscripcion i WHERE i.periodo_id = p.id) AS inscripciones
       FROM periodo p
      ORDER BY p.fecha_inicio DESC`,
  );
}

export type MateriaGestionada = {
  id: string;
  nombre: string;
  codigo: string | null;
  descripcion: string | null;
  creditos: number;
  estado: string;
  horario: string | null;
  aula: string | null;
  /** El nombre que se muestra: puede ser de alguien externo al sistema. */
  profesor_nombre: string | null;
  /** Quién es, cuando es usuario. Manda para "de quién es"; el texto, para qué se muestra. */
  profesor_usuario_id: string | null;
  periodo_id: string | null;
  periodo: string | null;
  periodo_tipo: string | null;
  /** Matrícula y tareas de la materia: lo que se perdería al borrarla. */
  inscritos: number;
  tareas: number;
};

/**
 * El catálogo de materias, con filtro de período y búsqueda por texto.
 *
 * Filtrar y buscar se hacen EN SQL y no en el navegador. Con 200 filas daría
 * igual, pero el tope existe justamente porque el catálogo crece: filtrar en el
 * cliente significaría traerse el catálogo entero para esconder la mayoría.
 *
 * La búsqueda cubre nombre, código y profesor —lo que dice
 * `subjects.searchPlaceholder`— con `ILIKE` sobre un patrón parametrizado. El
 * `%` se compone aquí con `$2` y nunca interpolando en el SQL.
 */
export async function materiasGestionadas({
  periodoId,
  busqueda,
}: {
  /** Id de período, o `null` para todos. */
  periodoId?: string | null;
  busqueda?: string | null;
} = {}): Promise<MateriaGestionada[]> {
  return consultar<MateriaGestionada>(
    `SELECT m.id,
            m.nombre,
            m.codigo,
            m.descripcion,
            coalesce(m.creditos, 0) AS creditos,
            m.estado,
            m.horario,
            m.aula,
            m.profesor_nombre,
            m.profesor_usuario_id,
            m.periodo_id,
            p.nombre AS periodo,
            p.tipo   AS periodo_tipo,
            (SELECT count(*)::int FROM inscripcion i WHERE i.materia_id = m.id) AS inscritos,
            (SELECT count(*)::int FROM asignacion  a WHERE a.materia_id = m.id) AS tareas
       FROM materia m
       LEFT JOIN periodo p ON p.id = m.periodo_id
      WHERE ($1::uuid IS NULL OR m.periodo_id = $1)
        AND ($2::text IS NULL
             OR m.nombre           ILIKE '%' || $2 || '%'
             OR m.codigo           ILIKE '%' || $2 || '%'
             OR m.profesor_nombre  ILIKE '%' || $2 || '%')
      ORDER BY p.fecha_inicio DESC NULLS LAST, m.nombre
      LIMIT $3`,
    [periodoId ?? null, busqueda?.trim() || null, TOPE + 1],
  );
}

export type PeriodoSimple = { id: string; nombre: string; tipo: string };

/** Los períodos, sin conteos: para los desplegables de los formularios. */
export async function periodosSimples(): Promise<PeriodoSimple[]> {
  return consultar<PeriodoSimple>(
    `SELECT id, nombre, tipo
       FROM periodo
      ORDER BY fecha_inicio DESC`,
  );
}

export type DocenteAsignable = { id: string; nombre: string };

/**
 * Quién puede figurar como profesor de una materia.
 *
 * Solo cuentas activas, y solo los roles que dan clase o coordinan. Que la
 * lista sea corta no es cosmético: elegir de un desplegable es lo que enlaza la
 * materia con una identidad real (`profesor_usuario_id`), y esa columna es la
 * que decide qué ve cada docente en su portal. El nombre suelto no vale para
 * eso —dos homónimos son una sola cadena— y por eso la 0019 añadió la FK.
 *
 * Para quien no es usuario del sistema —un profesor invitado— el formulario
 * deja escribir el nombre a mano, que se guarda en `profesor_nombre` con la FK
 * en NULL.
 */
export async function docentesAsignables(): Promise<DocenteAsignable[]> {
  return consultar<DocenteAsignable>(
    `SELECT u.id, u.nombre
       FROM usuario u
       JOIN rol r ON r.id = u.rol_id
      WHERE u.activo
        AND r.nombre IN ('docente', 'admin', 'super_admin')
      ORDER BY u.nombre`,
  );
}

/** Si la consulta llegó al tope, para avisar de que hay más sin mostrar. */
export function hayMasQueElTope(filas: readonly unknown[]): boolean {
  return filas.length > TOPE;
}

/** Recorta al tope lo que se pinta, dejando fuera la fila sonda. */
export function recortarAlTope<T>(filas: readonly T[]): T[] {
  return filas.slice(0, TOPE);
}

/**
 * ────────────────────────────────────────────────────────────────────────────
 * CALIFICACIONES
 *
 * `calificacion` cuelga de `curso`, no de `materia`: son las notas por
 * evaluación de los CURSOS TÉCNICOS. Las del becado universitario viven en
 * `historial_calificacion`, ya consolidadas por cuatrimestre, y son la materia
 * de `/academico/historial`. Que las dos cosas se llamen "notas" no las
 * convierte en la misma tabla, y juntarlas en una consulta daría una lista
 * donde media docena de columnas estarían siempre vacías.
 * ────────────────────────────────────────────────────────────────────────────
 */

/** Tope de la lista de notas. Coincide con `academic.grades.limitHint`. */
const TOPE_NOTAS = 500;

export type NotaRegistrada = {
  id: string;
  nota: number;
  tipo_evaluacion: string;
  observaciones: string | null;
  estudiante_id: string;
  estudiante: string;
  curso_id: string;
  curso: string;
  periodo_id: string;
  periodo: string;
  /** Si quien mira puede editarla y borrarla: se resuelve en el SQL, no en la vista. */
  editable: boolean;
  created_at: Date;
};

/**
 * Las notas registradas, con filtro de período y búsqueda por estudiante o
 * curso.
 *
 * `docenteId` funciona igual que en el resto del módulo: un id limita a lo
 * suyo, `null` lo abre todo. Pero aquí hay una diferencia importante — el
 * docente SÍ ve las notas de cursos ajenos si alguien le da la URL de un
 * período, porque el filtro de `docenteId` no va en el WHERE sino en
 * `editable`. Es deliberado: una nota es del estudiante, no del profesor, y
 * coordinación y el equipo académico necesitan leer el conjunto. Lo que el
 * docente no puede es TOCAR lo que no es suyo, y de eso se encarga el WHERE de
 * las acciones, no esta consulta.
 */
export async function notasRegistradas({
  periodoId,
  busqueda,
  docenteId,
}: {
  periodoId?: string | null;
  busqueda?: string | null;
  /** Id del docente para calcular `editable`, o `null` si puede con todas. */
  docenteId?: string | null;
}): Promise<NotaRegistrada[]> {
  return consultar<NotaRegistrada>(
    `SELECT k.id,
            k.nota::float8 AS nota,
            k.tipo_evaluacion::text AS tipo_evaluacion,
            k.observaciones,
            e.id   AS estudiante_id,
            e.nombre AS estudiante,
            c.id   AS curso_id,
            c.nombre AS curso,
            p.id   AS periodo_id,
            p.nombre AS periodo,
            ($3::uuid IS NULL OR c.docente_usuario_id = $3) AS editable,
            k.created_at
       FROM calificacion k
       JOIN estudiante e ON e.id = k.estudiante_id
       JOIN curso      c ON c.id = k.curso_id
       JOIN periodo    p ON p.id = k.periodo_id
      WHERE ($1::uuid IS NULL OR k.periodo_id = $1)
        AND ($2::text IS NULL
             OR e.nombre ILIKE '%' || $2 || '%'
             OR c.nombre ILIKE '%' || $2 || '%')
      ORDER BY k.created_at DESC
      LIMIT $4`,
    [periodoId ?? null, busqueda?.trim() || null, docenteId ?? null, TOPE_NOTAS + 1],
  );
}

export type ResumenNotas = {
  total: number;
  promedio: number | null;
  aprobadas: number;
  excelente: number;
  buena: number;
  riesgo: number;
  critica: number;
};

/**
 * Las cifras de cabecera y la distribución por banda.
 *
 * Es una consulta APARTE de la lista, y no un recuento de las filas que se
 * pintan, porque la lista está topada en 500: con más notas que eso, un
 * promedio calculado sobre lo visible sería el promedio de las 500 más
 * recientes disfrazado de promedio general. Los mismos filtros, la tabla
 * entera.
 *
 * Los umbrales llegan como parámetros desde `UMBRAL_BANDA` (`@/lib/notas`) en
 * vez de escribirse aquí: la escala tiene un solo sitio, y si aprobar deja de
 * ser 70 esta consulta se entera sola.
 */
export async function resumenDeNotas({
  periodoId,
  busqueda,
  umbrales,
}: {
  periodoId?: string | null;
  busqueda?: string | null;
  umbrales: { excelente: number; buena: number; riesgo: number };
}): Promise<ResumenNotas> {
  const fila = await consultarUna<ResumenNotas>(
    `SELECT count(*)::int AS total,
            round(avg(k.nota), 2)::float8 AS promedio,
            count(*) FILTER (WHERE k.nota >= $4)::int AS aprobadas,
            count(*) FILTER (WHERE k.nota >= $3)::int AS excelente,
            count(*) FILTER (WHERE k.nota >= $4 AND k.nota < $3)::int AS buena,
            count(*) FILTER (WHERE k.nota >= $5 AND k.nota < $4)::int AS riesgo,
            count(*) FILTER (WHERE k.nota <  $5)::int AS critica
       FROM calificacion k
       JOIN estudiante e ON e.id = k.estudiante_id
       JOIN curso      c ON c.id = k.curso_id
      WHERE ($1::uuid IS NULL OR k.periodo_id = $1)
        AND ($2::text IS NULL
             OR e.nombre ILIKE '%' || $2 || '%'
             OR c.nombre ILIKE '%' || $2 || '%')`,
    [
      periodoId ?? null,
      busqueda?.trim() || null,
      umbrales.excelente,
      umbrales.buena,
      umbrales.riesgo,
    ],
  );

  return (
    fila ?? {
      total: 0,
      promedio: null,
      aprobadas: 0,
      excelente: 0,
      buena: 0,
      riesgo: 0,
      critica: 0,
    }
  );
}

export type OpcionSimple = { id: string; nombre: string };

/**
 * Los cursos donde se puede registrar una nota.
 *
 * Solo los activos: registrar en un curso finalizado es casi siempre un error
 * de dedo en el desplegable, y el que de verdad lo necesite tiene el estado del
 * curso a un clic en `/academico/cursos`.
 */
export async function cursosParaNota(
  docenteId: string | null,
): Promise<OpcionSimple[]> {
  return consultar<OpcionSimple>(
    `SELECT id, nombre
       FROM curso
      WHERE estado = 'activo'
        AND ($1::uuid IS NULL OR docente_usuario_id = $1)
      ORDER BY nombre`,
    [docenteId],
  );
}

/**
 * Los estudiantes a los que se puede poner nota.
 *
 * Todos los activos, y no solo los que ya tienen alguna nota en el curso: la
 * primera nota de alguien tiene que poder ponerse, y una lista construida desde
 * `calificacion` dejaría fuera precisamente a quien todavía no tiene ninguna.
 */
export async function estudiantesParaNota(): Promise<OpcionSimple[]> {
  return consultar<OpcionSimple>(
    `SELECT id, nombre
       FROM estudiante
      WHERE estado = 'activo'
      ORDER BY nombre
      LIMIT 500`,
  );
}

/** Si la lista de notas llegó al tope. */
export function hayMasNotasQueElTope(filas: readonly unknown[]): boolean {
  return filas.length > TOPE_NOTAS;
}

/** Recorta la lista de notas al tope, dejando fuera la fila sonda. */
export function recortarNotas<T>(filas: readonly T[]): T[] {
  return filas.slice(0, TOPE_NOTAS);
}

/**
 * ────────────────────────────────────────────────────────────────────────────
 * HISTORIAL ACADÉMICO
 *
 * `historial_calificacion` es el expediente del becado universitario: una fila
 * por materia CERRADA, con su nota, su letra y su índice ya calculados y
 * guardados. La 0006 lo dice y conviene repetirlo: la escala de conversión
 * puede cambiar de un año a otro, así que el índice se lee, **nunca se
 * recalcula desde la nota**. Un 3.70 guardado que se recalcula sale 4.00.
 *
 * La materia va como TEXTO, no como referencia a `materia`. Por eso borrar una
 * materia del catálogo no toca el historial de nadie, y por eso aquí no hay
 * ningún JOIN con `materia`.
 *
 * Es la otra mitad de las calificaciones: aquellas son del curso técnico y por
 * evaluación; estas son de la carrera y por cuatrimestre cerrado.
 * ────────────────────────────────────────────────────────────────────────────
 */

/** Tope de la lista del historial. Coincide con `academic.history.limitHint`. */
const TOPE_HISTORIAL = 300;

export type FilaHistorial = {
  estudiante_id: string;
  nombre: string;
  /** Índice acumulado sobre 4.00. SIEMPRE de todo el historial (ver abajo). */
  indice: number | null;
  /** Las demás cifras SÍ respetan el filtro de cuatrimestre. */
  promedio: number | null;
  materias: number;
  aprobadas: number;
  reprobadas: number;
  prueba: number;
  ultimo_cuatrimestre: string | null;
};

/**
 * Una fila por estudiante, con su índice y cómo va cerrando.
 *
 * DOS ÁMBITOS EN LA MISMA FILA, y es deliberado:
 *
 *   · El **índice** se calcula sobre TODO el historial, siempre, aunque haya un
 *     cuatrimestre elegido. Es acumulado y es el que decide la beca; verlo
 *     cambiar al pulsar un cuatrimestre daría a entender que la Fundación lo
 *     calcula por período, que es justo lo que no hace. Es la misma regla que
 *     ya sigue el portal del estudiante.
 *   · Lo **contable** —materias, aprobadas, reprobadas, promedio— sí respeta el
 *     filtro: ahí la pregunta es "cómo cerró ESE cuatrimestre", y un recuento
 *     que ignorara el filtro haría que el filtro no sirviera para nada.
 *
 * Eso se resuelve con `FILTER` sobre los agregados en vez de meter el
 * cuatrimestre en el WHERE: en el WHERE, las filas de los otros cuatrimestres
 * desaparecerían y el índice acumulado saldría mal.
 *
 * La búsqueda decide QUÉ ESTUDIANTES salen, no qué filas cuentan: buscar por
 * materia enseña a quien la cursó, con su expediente entero, no con un índice
 * recortado a esa materia.
 */
export async function historialPorEstudiante({
  cuatrimestre,
  busqueda,
}: {
  cuatrimestre?: string | null;
  busqueda?: string | null;
} = {}): Promise<FilaHistorial[]> {
  return consultar<FilaHistorial>(
    `SELECT e.id AS estudiante_id,
            e.nombre,
            round(avg(h.gpa), 2)::float8 AS indice,
            round(avg(h.nota_numerica) FILTER (
              WHERE $1::text IS NULL OR h.cuatrimestre = $1
            ), 2)::float8 AS promedio,
            count(*) FILTER (
              WHERE $1::text IS NULL OR h.cuatrimestre = $1
            )::int AS materias,
            count(*) FILTER (
              WHERE (($1::text IS NULL OR h.cuatrimestre = $1)) AND h.estado = 'aprobada'
            )::int AS aprobadas,
            count(*) FILTER (
              WHERE (($1::text IS NULL OR h.cuatrimestre = $1)) AND h.estado = 'reprobada'
            )::int AS reprobadas,
            count(*) FILTER (
              WHERE (($1::text IS NULL OR h.cuatrimestre = $1)) AND h.estado = 'prueba_academica'
            )::int AS prueba,
            max(h.cuatrimestre) AS ultimo_cuatrimestre
       FROM historial_calificacion h
       JOIN estudiante e ON e.id = h.estudiante_id
      WHERE ($2::text IS NULL
             OR e.nombre  ILIKE '%' || $2 || '%'
             OR EXISTS (SELECT 1 FROM historial_calificacion b
                         WHERE b.estudiante_id = e.id
                           AND b.materia ILIKE '%' || $2 || '%'))
      GROUP BY e.id, e.nombre
     HAVING $1::text IS NULL
         OR count(*) FILTER (WHERE h.cuatrimestre = $1) > 0
      ORDER BY e.nombre
      LIMIT $3`,
    [cuatrimestre?.trim() || null, busqueda?.trim() || null, TOPE_HISTORIAL + 1],
  );
}

export type ResumenHistorial = {
  estudiantes: number;
  registros: number;
  indice: number | null;
  reprobadas: number;
};

/**
 * Las cuatro cifras de cabecera, sobre el conjunto filtrado entero.
 *
 * Aparte de la lista por lo mismo que en calificaciones: la lista está topada
 * en 300 y un "índice general" calculado sobre los 300 primeros por orden
 * alfabético no sería el índice general de nada.
 *
 * MISMOS DOS ÁMBITOS QUE LA LISTA, y esto costó un intento: la primera versión
 * metía el cuatrimestre en el WHERE, así que al filtrar la cabecera decía 2.67
 * mientras cada fila seguía diciendo 2.83. Dos números para lo mismo en la
 * misma pantalla, y el de arriba —el que se lee primero— era el que no
 * significaba nada: un "índice general" de un solo cuatrimestre no es un índice
 * acumulado. Ahora el cuatrimestre solo elige QUIÉN entra (el EXISTS) y luego
 * filtra los recuentos; el promedio de índices se hace sobre todo el historial
 * de esa gente, igual que en la fila.
 *
 * `indice` es el promedio de los índices GUARDADOS, no de las notas: si se
 * calculara desde `nota_numerica` volvería el error del 3.70 que sale 4.00.
 */
export async function resumenDelHistorial({
  cuatrimestre,
  busqueda,
}: {
  cuatrimestre?: string | null;
  busqueda?: string | null;
} = {}): Promise<ResumenHistorial> {
  const fila = await consultarUna<ResumenHistorial>(
    `SELECT count(DISTINCT h.estudiante_id) FILTER (
              WHERE $1::text IS NULL OR h.cuatrimestre = $1
            )::int AS estudiantes,
            count(*) FILTER (
              WHERE $1::text IS NULL OR h.cuatrimestre = $1
            )::int AS registros,
            round(avg(h.gpa), 2)::float8 AS indice,
            count(*) FILTER (
              WHERE (($1::text IS NULL OR h.cuatrimestre = $1)) AND h.estado = 'reprobada'
            )::int AS reprobadas
       FROM historial_calificacion h
       JOIN estudiante e ON e.id = h.estudiante_id
      WHERE ($2::text IS NULL
             OR e.nombre  ILIKE '%' || $2 || '%'
             OR EXISTS (SELECT 1 FROM historial_calificacion b
                         WHERE b.estudiante_id = e.id
                           AND b.materia ILIKE '%' || $2 || '%'))
        AND ($1::text IS NULL
             OR EXISTS (SELECT 1 FROM historial_calificacion c
                         WHERE c.estudiante_id = h.estudiante_id
                           AND c.cuatrimestre = $1))`,
    [cuatrimestre?.trim() || null, busqueda?.trim() || null],
  );

  return fila ?? { estudiantes: 0, registros: 0, indice: null, reprobadas: 0 };
}

export type MateriaDelHistorial = {
  id: string;
  cuatrimestre: string;
  materia: string;
  nota_numerica: number;
  nota_letra: string;
  gpa: number;
  estado: string;
};

/**
 * El detalle de un estudiante: sus materias cerradas, cuatrimestre a
 * cuatrimestre.
 *
 * Se pide solo para el estudiante que se abre, y no se cargan de golpe los de
 * toda la lista: son 300 estudiantes por varias materias por varios
 * cuatrimestres, y traerlo todo para enseñar uno es exactamente el reparto al
 * revés.
 *
 * Ordena por el NOMBRE del cuatrimestre y no por ninguna fecha: un cuatrimestre
 * ya cursado no suele tener fila en `periodo`, así que no hay fecha de la que
 * tirar. El nombre sigue la convención de la 0006 (`2026-I`, `2026-II`) y
 * ordena bien por sí solo.
 */
export async function materiasDelHistorial(
  estudianteId: string,
): Promise<MateriaDelHistorial[]> {
  return consultar<MateriaDelHistorial>(
    `SELECT id,
            cuatrimestre,
            materia,
            nota_numerica::float8 AS nota_numerica,
            nota_letra,
            gpa::float8 AS gpa,
            estado
       FROM historial_calificacion
      WHERE estudiante_id = $1
      ORDER BY cuatrimestre DESC, materia`,
    [estudianteId],
  );
}

/** Los cuatrimestres que existen en el historial, para el desplegable. */
export async function cuatrimestresDelHistorial(): Promise<string[]> {
  const filas = await consultar<{ cuatrimestre: string }>(
    `SELECT DISTINCT cuatrimestre
       FROM historial_calificacion
      ORDER BY cuatrimestre DESC`,
  );

  return filas.map((fila) => fila.cuatrimestre);
}

/** Si el historial llegó al tope. */
export function hayMasHistorialQueElTope(filas: readonly unknown[]): boolean {
  return filas.length > TOPE_HISTORIAL;
}

/** Recorta el historial al tope, dejando fuera la fila sonda. */
export function recortarHistorial<T>(filas: readonly T[]): T[] {
  return filas.slice(0, TOPE_HISTORIAL);
}
