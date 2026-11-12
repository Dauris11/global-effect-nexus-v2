import { consultar, consultarUna } from "@/lib/db";
import { SQL_HOY_RD } from "@/lib/fecha-rd";
import { calcularNotaFinal } from "@/lib/nota-final";

/**
 * Gestión académica: las clases de Global Effect 360 y las materias del docente.
 *
 * Quién ve qué se decide con un solo parámetro, `docenteId`:
 *
 *   · Con un id → solo lo suyo. Es el caso del rol `docente`.
 *   · Con `null` → todo. Es el caso de `admin` y `super_admin`, que gestionan el
 *     programa completo.
 *
 * El `null` es explícito y no un valor por omisión: quien llama tiene que
 * decidirlo mirando el rol, y así no hay forma de acabar viéndolo todo por
 * haberse dejado un argumento.
 *
 * Desde la 0047 no hay cursos técnicos: 360 es la única formación propia de la
 * Fundación y ocupa su lugar. El catálogo lo siguen administrando admin y super
 * admin; el profesor ve sus clases, les pone tareas y cierra la nota final.
 */

export type Clase360 = {
  id: string;
  nombre: string;
  codigo: string | null;
  creditos: number;
  activa: boolean;
  horario: string | null;
  aula: string | null;
  /** Estudiantes con la materia prematriculada o cursando. */
  inscritos: number;
  tareas: number;
  /** Inscritos con la nota final ya puesta, para saber si la clase está al día. */
  con_nota: number;
  promedio: number | null;
};

/**
 * Clases de Global Effect 360 de un docente.
 *
 * El docente pone tareas y la nota final, pero no toca el catálogo —crear una
 * materia o retirarla—: eso lo administran admin y super admin en
 * `/academico/prematricula`. La separación la sostiene el permiso: el docente no
 * tiene `academico.escribir`.
 *
 * La nota y el promedio se cuentan sobre las inscripciones no retiradas: quien se
 * dio de baja no está en la clase, y su `NULL` bajaría el "al día" sin motivo.
 */
export async function clases360(docenteId: string | null): Promise<Clase360[]> {
  return consultar<Clase360>(
    `SELECT m.id,
            m.nombre,
            m.codigo,
            m.creditos,
            m.activa,
            m.horario,
            m.aula,
            (SELECT count(*)::int
               FROM inscripcion_360 i
              WHERE i.materia_id = m.id
                AND i.estado IN ('prematriculada', 'cursando')) AS inscritos,
            (SELECT count(*)::int
               FROM asignacion a
              WHERE a.materia_360_id = m.id
                AND a.tipo IN ('tarea', 'examen')) AS tareas,
            (SELECT count(*)::int
               FROM inscripcion_360 i
              WHERE i.materia_id = m.id
                AND i.estado <> 'retirada'
                AND i.nota IS NOT NULL) AS con_nota,
            (SELECT round(avg(i.nota), 2)::float8
               FROM inscripcion_360 i
              WHERE i.materia_id = m.id
                AND i.estado <> 'retirada') AS promedio
       FROM materia_360 m
      WHERE ($1::uuid IS NULL OR m.docente_id = $1)
      ORDER BY m.activa DESC, m.orden, m.nombre`,
    [docenteId],
  );
}

export type InscritoEn360 = {
  /** Id de la inscripción: es lo que se califica, no el estudiante. */
  id: string;
  estudiante_id: string;
  nombre: string;
  estado: string;
  periodo: string | null;
  ronda: number;
  nota: number | null;
  /**
   * Nota final sugerida con las tareas DE SU PERÍODO (`calcularNotaFinal`).
   * Es una propuesta: el profesor decide la nota.
   */
  notaPropuesta: number | null;
  entregadas: number;
  /** Tareas evaluables del período de esta inscripción. */
  tareas: number;
  /** Quién dio la materia por aprobada o reprobada, y cuándo. */
  decidida_por: string | null;
  decidida_en: Date | null;
};

type FilaInscrito = Omit<InscritoEn360, "notaPropuesta" | "entregadas" | "tareas">;

type FilaTareaDeInscrito = {
  inscripcion_id: string;
  tipo: string;
  peso: number;
  puntaje_maximo: number;
  fecha_vencimiento: Date | null;
  calificacion: number | null;
  entregada: boolean;
};

/** Las tareas evaluables de cada inscripción, ya filtradas por su período. */
async function tareasPorInscripcion(
  materiaId: string | null,
  inscripcionId: string | null,
): Promise<Map<string, FilaTareaDeInscrito[]>> {
  const tareas = await consultar<FilaTareaDeInscrito>(
    `SELECT i.id AS inscripcion_id,
            a.tipo::text AS tipo,
            a.peso::float8 AS peso,
            coalesce(a.puntaje_maximo, 100)::float8 AS puntaje_maximo,
            a.fecha_vencimiento,
            d.calificacion::float8 AS calificacion,
            coalesce(d.estado IN ('entregado', 'tarde', 'calificado'), false) AS entregada
       FROM inscripcion_360 i
       JOIN asignacion a
         ON a.materia_360_id = i.materia_id
        AND a.tipo IN ('tarea', 'examen')
        AND (a.periodo_id IS NULL OR a.periodo_id = i.periodo_id)
       LEFT JOIN entrega_estudiante d
         ON d.asignacion_id = a.id AND d.estudiante_id = i.estudiante_id
      WHERE ($1::uuid IS NULL OR i.materia_id = $1)
        AND ($2::uuid IS NULL OR i.id = $2)`,
    [materiaId, inscripcionId],
  );

  const porInscripcion = new Map<string, FilaTareaDeInscrito[]>();
  for (const tarea of tareas) {
    const lista = porInscripcion.get(tarea.inscripcion_id) ?? [];
    lista.push(tarea);
    porInscripcion.set(tarea.inscripcion_id, lista);
  }

  return porInscripcion;
}

function proponer(tareas: readonly FilaTareaDeInscrito[]): number | null {
  return calcularNotaFinal(
    tareas.map((t) => ({
      tipo: t.tipo,
      peso: t.peso,
      puntajeMaximo: t.puntaje_maximo,
      calificacion: t.calificacion,
      vence: t.fecha_vencimiento,
      entregada: t.entregada,
    })),
  ).propuesta;
}

/**
 * La propuesta de UNA inscripción, calculada en el servidor.
 *
 * La usa la acción de calificar para dejar constancia de si el profesor anuló
 * la propuesta: no se fía de lo que mande el formulario.
 */
export async function propuestaDeInscripcion(
  inscripcionId: string,
): Promise<number | null> {
  const mapa = await tareasPorInscripcion(null, inscripcionId);

  return proponer(mapa.get(inscripcionId) ?? []);
}

/**
 * Los inscritos de una clase de 360, con su avance y su nota.
 *
 * Las tareas de cada inscrito son las de SU período: una con `periodo_id = P`
 * solo cuenta para inscripciones de P, y una con `periodo_id` nulo (anterior a
 * la 0069) cuenta para todas. Así quien repite la materia no hereda las notas
 * del intento anterior.
 */
export async function inscritosDeClase360(
  materiaId: string,
): Promise<InscritoEn360[]> {
  const [inscritos, porInscripcion] = await Promise.all([
    consultar<FilaInscrito>(
      `SELECT i.id,
              e.id AS estudiante_id,
              e.nombre,
              i.estado,
              p.nombre AS periodo,
              i.ronda,
              i.nota::float8 AS nota,
              u.nombre AS decidida_por,
              i.decidida_en
         FROM inscripcion_360 i
         JOIN estudiante e ON e.id = i.estudiante_id
         LEFT JOIN periodo p ON p.id = i.periodo_id
         LEFT JOIN usuario u ON u.id = i.decidida_por
        WHERE i.materia_id = $1
        ORDER BY p.fecha_inicio DESC NULLS LAST, i.ronda, e.nombre`,
      [materiaId],
    ),
    tareasPorInscripcion(materiaId, null),
  ]);

  return inscritos.map((inscrito) => {
    const suyas = porInscripcion.get(inscrito.id) ?? [];

    return {
      ...inscrito,
      notaPropuesta: proponer(suyas),
      entregadas: suyas.filter((t) => t.entregada).length,
      tareas: suyas.length,
    };
  });
}

export type PeriodoParaTarea = {
  id: string;
  nombre: string;
  /** Hoy cae dentro del período: es el que se propone por defecto. */
  vigente: boolean;
};

/**
 * Los períodos donde cada clase tiene inscritos, para elegir a cuál pertenece
 * una tarea nueva. Con `docenteId` solo las clases de esa persona.
 *
 * Solo inscripciones no retiradas: una tarea en un período donde nadie cursa
 * no la vería nadie.
 */
export async function periodosParaTareas360(
  docenteId: string | null,
): Promise<Record<string, PeriodoParaTarea[]>> {
  const filas = await consultar<PeriodoParaTarea & { materia_id: string }>(
    `SELECT DISTINCT i.materia_id, p.id, p.nombre, p.fecha_inicio,
            (${SQL_HOY_RD} BETWEEN p.fecha_inicio AND p.fecha_fin) AS vigente
       FROM inscripcion_360 i
       JOIN materia_360 m ON m.id = i.materia_id
       JOIN periodo p ON p.id = i.periodo_id
      WHERE i.estado <> 'retirada'
        AND ($1::uuid IS NULL OR m.docente_id = $1)
      ORDER BY p.fecha_inicio DESC`,
    [docenteId],
  );

  const resultado: Record<string, PeriodoParaTarea[]> = {};
  for (const { materia_id, id, nombre, vigente } of filas) {
    (resultado[materia_id] ??= []).push({ id, nombre, vigente });
  }

  return resultado;
}

export type AsignacionDeClase360 = {
  id: string;
  materia_id: string;
  titulo: string;
  descripcion: string | null;
  tipo: "tarea" | "examen" | "material" | "anuncio";
  periodo: string | null;
  fecha_vencimiento: string | null;
  peso: number;
  puntaje_maximo: number;
  archivo_url: string | null;
  /** Cantidad de entregas enviadas por estudiantes para esta asignación. */
  entregas: number;
};

/**
 * Asignaciones (tareas, exámenes, materiales y anuncios) publicadas en cada
 * clase de Global Effect 360 visible para el docente o coordinación.
 */
export async function asignacionesDeClases360(
  docenteId: string | null,
): Promise<Record<string, AsignacionDeClase360[]>> {
  const filas = await consultar<AsignacionDeClase360>(
    `SELECT a.id,
            a.materia_360_id AS materia_id,
            a.titulo,
            a.descripcion,
            a.tipo::text AS tipo,
            p.nombre AS periodo,
            to_char(a.fecha_vencimiento AT TIME ZONE 'America/Santo_Domingo', 'YYYY-MM-DD HH24:MI') AS fecha_vencimiento,
            coalesce(a.peso, 1)::float8 AS peso,
            coalesce(a.puntaje_maximo, 100)::float8 AS puntaje_maximo,
            a.archivo_url,
            (SELECT count(*)::int
               FROM entrega_estudiante d
              WHERE d.asignacion_id = a.id
                AND d.estado IN ('entregado', 'tarde', 'calificado')) AS entregas
       FROM asignacion a
       JOIN materia_360 m ON m.id = a.materia_360_id
       LEFT JOIN periodo p ON p.id = a.periodo_id
      WHERE ($1::uuid IS NULL OR m.docente_id = $1)
      ORDER BY a.fecha_publicacion DESC`,
    [docenteId],
  );

  const resultado: Record<string, AsignacionDeClase360[]> = {};
  for (const fila of filas) {
    (resultado[fila.materia_id] ??= []).push(fila);
  }

  return resultado;
}

export type MateriaDelDocente = {
  id: string;
  nombre: string;
  codigo: string | null;
  creditos: number;
  estado: string;
  horario: string | null;
  aula: string | null;
  periodo: string | null;
  /** Matriculados en la materia y tareas que tiene puestas. */
  inscritos: number;
  tareas: number;
};

/**
 * Las materias universitarias a nombre del docente.
 *
 * Filtra por `profesor_usuario_id` y NUNCA por `profesor_nombre`: ese es texto
 * libre y la 0019 añadió la clave ajena justamente porque comparar nombres le
 * acaba enseñando a alguien la materia de otro —"Juan Pérez" y "Juan A. Pérez"
 * son la misma persona con dos cadenas, y dos homónimos son dos personas con
 * una sola—.
 *
 * El docente aquí solo MIRA. El catálogo de materias lo administra coordinación
 * con `academico.escribir`, que el rol `docente` no tiene; esta consulta existe
 * para que vea las suyas en su portal, no para que las toque.
 */
export async function materiasDelDocente(
  docenteId: string | null,
): Promise<MateriaDelDocente[]> {
  return consultar<MateriaDelDocente>(
    `SELECT m.id,
            m.nombre,
            m.codigo,
            coalesce(m.creditos, 0) AS creditos,
            m.estado,
            m.horario,
            m.aula,
            p.nombre AS periodo,
            (SELECT count(*)::int FROM inscripcion i WHERE i.materia_id = m.id) AS inscritos,
            (SELECT count(*)::int FROM asignacion  a WHERE a.materia_id = m.id
                                                       AND a.tipo IN ('tarea', 'examen')) AS tareas
       FROM materia m
       LEFT JOIN periodo p ON p.id = m.periodo_id
      WHERE ($1::uuid IS NULL OR m.profesor_usuario_id = $1)
      ORDER BY m.estado, p.fecha_inicio DESC NULLS LAST, m.nombre`,
    [docenteId],
  );
}

export type EntregaPorRevisar = {
  id: string;
  asignacion: string;
  unidad: string;
  estudiante: string;
  estado: string;
  fecha_entrega: Date | null;
  archivo_url: string | null;
  /** La respuesta que el estudiante escribió en la plataforma. */
  texto_respuesta: string | null;
  calificacion: number | null;
  /** Escala de ESTA tarea: la nota va de 0 a aquí. */
  puntaje_maximo: number;
  comentario_profesor: string | null;
};

/**
 * Entregas que esperan revisión, de las clases de este docente.
 *
 * `coalesce` de los dos nombres posibles: la tarea cuelga de una materia
 * universitaria o de una materia de 360, y la pantalla necesita decir de cuál
 * sin preguntar dos veces.
 */
export async function entregasPorRevisar(
  docenteId: string | null,
  limite = 30,
): Promise<EntregaPorRevisar[]> {
  return consultar<EntregaPorRevisar>(
    `SELECT d.id,
            a.titulo AS asignacion,
            coalesce(mu.nombre, m3.nombre, '—') AS unidad,
            e.nombre AS estudiante,
            d.estado,
            d.fecha_entrega,
            d.archivo_url,
            d.texto_respuesta,
            d.calificacion::float8 AS calificacion,
            coalesce(a.puntaje_maximo, 100)::float8 AS puntaje_maximo,
            d.comentario_profesor
       FROM entrega_estudiante d
       JOIN asignacion  a  ON a.id = d.asignacion_id
       JOIN estudiante  e  ON e.id = d.estudiante_id
       LEFT JOIN materia     mu ON mu.id = a.materia_id
       LEFT JOIN materia_360 m3 ON m3.id = a.materia_360_id
      WHERE d.estado IN ('entregado', 'tarde')
        AND ($1::uuid IS NULL
             OR mu.profesor_usuario_id = $1
             OR m3.docente_id          = $1)
      ORDER BY d.fecha_entrega DESC NULLS LAST
      LIMIT $2`,
    [docenteId, limite],
  );
}

export type CifrasDocente = {
  clases_360: number;
  estudiantes: number;
  por_revisar: number;
};

/** Las cifras de cabecera del portal del profesor. */
export async function cifrasDocente(
  docenteId: string | null,
): Promise<CifrasDocente> {
  const fila = await consultarUna<CifrasDocente>(
    `SELECT (SELECT count(*)::int FROM materia_360 m
              WHERE m.activa
                AND ($1::uuid IS NULL OR m.docente_id = $1)) AS clases_360,
            (SELECT count(DISTINCT i.estudiante_id)::int
               FROM inscripcion_360 i
               JOIN materia_360 m ON m.id = i.materia_id
              WHERE i.estado IN ('prematriculada', 'cursando')
                AND ($1::uuid IS NULL OR m.docente_id = $1)) AS estudiantes,
            (SELECT count(*)::int
               FROM entrega_estudiante d
               JOIN asignacion a ON a.id = d.asignacion_id
               LEFT JOIN materia     mu ON mu.id = a.materia_id
                       LEFT JOIN materia_360 m3 ON m3.id = a.materia_360_id
              WHERE d.estado IN ('entregado', 'tarde')
                AND ($1::uuid IS NULL
                     OR mu.profesor_usuario_id = $1
                             OR m3.docente_id          = $1)) AS por_revisar`,
    [docenteId],
  );

  return fila ?? { clases_360: 0, estudiantes: 0, por_revisar: 0 };
}
