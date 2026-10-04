import { consultar, consultarUna } from "@/lib/db";

/**
 * Gestión académica: los cursos técnicos y las clases de Global Effect 360.
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
 * Los cursos técnicos y las clases de 360 son DOS programas distintos y no se
 * mezclan en una lista: el catálogo de 360 lo administran admin y super admin, y
 * el profesor solo ve sus clases para ponerles tareas.
 */

export type CursoGestionado = {
  id: string;
  nombre: string;
  descripcion: string | null;
  docente: string | null;
  estado: string;
  modalidad: string;
  horario: string | null;
  capacidad: number;
  periodo: string | null;
  /** Semestre o cuatrimestre, del período (migración 0028). */
  periodo_tipo: string | null;
  /** Estudiantes con al menos una calificación en el curso. */
  estudiantes: number;
  /** Notas registradas y promedio, para saber si el curso está al día. */
  notas: number;
  promedio: number | null;
  /** Tareas y exámenes publicados en el curso. */
  tareas: number;
};

/**
 * Cursos técnicos, con su carga y su avance.
 *
 * `estudiantes` sale de `calificacion` y no de `curso.inscritos`: esa columna es
 * un contador que se pone a mano y se queda desfasado. Quien tiene una nota en
 * el curso está en el curso.
 */
export async function cursosGestionados(
  docenteId: string | null,
): Promise<CursoGestionado[]> {
  return consultar<CursoGestionado>(
    `SELECT c.id,
            c.nombre,
            c.descripcion,
            c.docente,
            c.estado,
            c.modalidad,
            c.horario,
            coalesce(c.capacidad, 0) AS capacidad,
            p.nombre AS periodo,
            p.tipo   AS periodo_tipo,
            (SELECT count(DISTINCT k.estudiante_id)::int
               FROM calificacion k WHERE k.curso_id = c.id) AS estudiantes,
            (SELECT count(*)::int
               FROM calificacion k WHERE k.curso_id = c.id) AS notas,
            (SELECT round(avg(k.nota), 2)::float8
               FROM calificacion k WHERE k.curso_id = c.id) AS promedio,
            (SELECT count(*)::int
               FROM asignacion a
              WHERE a.curso_id = c.id
                AND a.tipo IN ('tarea', 'examen')) AS tareas
       FROM curso c
       LEFT JOIN periodo p ON p.id = c.periodo_id
      WHERE ($1::uuid IS NULL OR c.docente_usuario_id = $1)
      ORDER BY c.estado, p.fecha_inicio DESC NULLS LAST, c.nombre`,
    [docenteId],
  );
}

export type EstudianteEnCurso = {
  estudiante_id: string;
  nombre: string;
  /** Promedio de sus notas en ESTE curso. */
  promedio: number | null;
  notas: number;
  /** Tareas del curso que ya entregó, y cuántas hay. */
  entregadas: number;
  tareas: number;
  /** Cuántas tiene calificadas por el profesor. */
  calificadas: number;
};

/**
 * Los estudiantes de un curso, con su nota y si cumplieron con las tareas.
 *
 * Es lo que el profesor pidió ver en una sola pantalla: quién está, cómo va y si
 * entregó. `entregadas` cuenta lo que llegó —entregado, tarde o calificado—
 * porque "cumplió" no es lo mismo que "sacó buena nota".
 */
export async function estudiantesDeCurso(
  cursoId: string,
): Promise<EstudianteEnCurso[]> {
  return consultar<EstudianteEnCurso>(
    `WITH del_curso AS (
       SELECT DISTINCT k.estudiante_id
         FROM calificacion k
        WHERE k.curso_id = $1
     ),
     tareas AS (
       SELECT count(*)::int AS total
         FROM asignacion a
        WHERE a.curso_id = $1
          AND a.tipo IN ('tarea', 'examen')
     )
     SELECT e.id AS estudiante_id,
            e.nombre,
            (SELECT round(avg(k.nota), 2)::float8
               FROM calificacion k
              WHERE k.curso_id = $1 AND k.estudiante_id = e.id) AS promedio,
            (SELECT count(*)::int
               FROM calificacion k
              WHERE k.curso_id = $1 AND k.estudiante_id = e.id) AS notas,
            (SELECT count(*)::int
               FROM entrega_estudiante d
               JOIN asignacion a ON a.id = d.asignacion_id
              WHERE a.curso_id = $1
                AND d.estudiante_id = e.id
                AND d.estado IN ('entregado', 'tarde', 'calificado')) AS entregadas,
            (SELECT total FROM tareas) AS tareas,
            (SELECT count(*)::int
               FROM entrega_estudiante d
               JOIN asignacion a ON a.id = d.asignacion_id
              WHERE a.curso_id = $1
                AND d.estudiante_id = e.id
                AND d.estado = 'calificado') AS calificadas
       FROM del_curso dc
       JOIN estudiante e ON e.id = dc.estudiante_id
      ORDER BY e.nombre`,
    [cursoId],
  );
}

export type Clase360 = {
  id: string;
  nombre: string;
  codigo: string | null;
  obligatoria: boolean;
  creditos: number;
  activa: boolean;
  /** Becados con la materia prematriculada o cursando. */
  inscritos: number;
  tareas: number;
};

/**
 * Clases de Global Effect 360 de un docente.
 *
 * Solo LEER y poner tareas: el catálogo —crear una materia, marcarla como
 * obligatoria, retirarla— lo administran admin y super admin en
 * `/academico/prematricula`. Esa separación es de la especificación y la sostiene
 * el permiso: el docente no tiene `academico.escribir`.
 */
export async function clases360(docenteId: string | null): Promise<Clase360[]> {
  return consultar<Clase360>(
    `SELECT m.id,
            m.nombre,
            m.codigo,
            m.obligatoria,
            m.creditos,
            m.activa,
            (SELECT count(*)::int
               FROM inscripcion_360 i
              WHERE i.materia_id = m.id
                AND i.estado IN ('prematriculada', 'cursando')) AS inscritos,
            (SELECT count(*)::int
               FROM asignacion a
              WHERE a.materia_360_id = m.id
                AND a.tipo IN ('tarea', 'examen')) AS tareas
       FROM materia_360 m
      WHERE ($1::uuid IS NULL OR m.docente_id = $1)
      ORDER BY m.activa DESC, m.obligatoria DESC, m.orden, m.nombre`,
    [docenteId],
  );
}

export type InscritoEn360 = {
  estudiante_id: string;
  nombre: string;
  estado: string;
  periodo: string | null;
  nota: number | null;
  entregadas: number;
  tareas: number;
};

/** Los becados inscritos en una clase de 360, con su avance. */
export async function inscritosDeClase360(
  materiaId: string,
): Promise<InscritoEn360[]> {
  return consultar<InscritoEn360>(
    `SELECT e.id AS estudiante_id,
            e.nombre,
            i.estado,
            p.nombre AS periodo,
            i.nota::float8 AS nota,
            (SELECT count(*)::int
               FROM entrega_estudiante d
               JOIN asignacion a ON a.id = d.asignacion_id
              WHERE a.materia_360_id = $1
                AND d.estudiante_id = e.id
                AND d.estado IN ('entregado', 'tarde', 'calificado')) AS entregadas,
            (SELECT count(*)::int
               FROM asignacion a
              WHERE a.materia_360_id = $1
                AND a.tipo IN ('tarea', 'examen')) AS tareas
       FROM inscripcion_360 i
       JOIN estudiante e ON e.id = i.estudiante_id
       LEFT JOIN periodo p ON p.id = i.periodo_id
      WHERE i.materia_id = $1
      ORDER BY e.nombre`,
    [materiaId],
  );
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
  calificacion: number | null;
  comentario_profesor: string | null;
};

/**
 * Entregas que esperan revisión, de las clases de este docente.
 *
 * `coalesce` de los tres nombres posibles: la tarea cuelga de una materia
 * universitaria, de un curso técnico o de una materia de 360, y la pantalla
 * necesita decir de cuál sin preguntar tres veces.
 */
export async function entregasPorRevisar(
  docenteId: string | null,
  limite = 30,
): Promise<EntregaPorRevisar[]> {
  return consultar<EntregaPorRevisar>(
    `SELECT d.id,
            a.titulo AS asignacion,
            coalesce(mu.nombre, cu.nombre, m3.nombre, '—') AS unidad,
            e.nombre AS estudiante,
            d.estado,
            d.fecha_entrega,
            d.archivo_url,
            d.calificacion::float8 AS calificacion,
            d.comentario_profesor
       FROM entrega_estudiante d
       JOIN asignacion  a  ON a.id = d.asignacion_id
       JOIN estudiante  e  ON e.id = d.estudiante_id
       LEFT JOIN materia     mu ON mu.id = a.materia_id
       LEFT JOIN curso       cu ON cu.id = a.curso_id
       LEFT JOIN materia_360 m3 ON m3.id = a.materia_360_id
      WHERE d.estado IN ('entregado', 'tarde')
        AND ($1::uuid IS NULL
             OR mu.profesor_usuario_id = $1
             OR cu.docente_usuario_id  = $1
             OR m3.docente_id          = $1)
      ORDER BY d.fecha_entrega DESC NULLS LAST
      LIMIT $2`,
    [docenteId, limite],
  );
}

export type CifrasDocente = {
  cursos: number;
  clases_360: number;
  estudiantes: number;
  por_revisar: number;
};

/** Las cifras de cabecera del portal del profesor. */
export async function cifrasDocente(
  docenteId: string | null,
): Promise<CifrasDocente> {
  const fila = await consultarUna<CifrasDocente>(
    `SELECT (SELECT count(*)::int FROM curso c
              WHERE c.estado = 'activo'
                AND ($1::uuid IS NULL OR c.docente_usuario_id = $1)) AS cursos,
            (SELECT count(*)::int FROM materia_360 m
              WHERE m.activa
                AND ($1::uuid IS NULL OR m.docente_id = $1)) AS clases_360,
            (SELECT count(DISTINCT k.estudiante_id)::int
               FROM calificacion k
               JOIN curso c ON c.id = k.curso_id
              WHERE ($1::uuid IS NULL OR c.docente_usuario_id = $1)) AS estudiantes,
            (SELECT count(*)::int
               FROM entrega_estudiante d
               JOIN asignacion a ON a.id = d.asignacion_id
               LEFT JOIN materia     mu ON mu.id = a.materia_id
               LEFT JOIN curso       cu ON cu.id = a.curso_id
               LEFT JOIN materia_360 m3 ON m3.id = a.materia_360_id
              WHERE d.estado IN ('entregado', 'tarde')
                AND ($1::uuid IS NULL
                     OR mu.profesor_usuario_id = $1
                     OR cu.docente_usuario_id  = $1
                     OR m3.docente_id          = $1)) AS por_revisar`,
    [docenteId],
  );

  return fila ?? { cursos: 0, clases_360: 0, estudiantes: 0, por_revisar: 0 };
}
