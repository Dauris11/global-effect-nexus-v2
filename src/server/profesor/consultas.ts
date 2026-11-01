import { consultar, consultarUna } from "@/lib/db";

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
  /** Promedio de sus entregas calificadas: la base para poner la nota final. */
  promedio_tareas: number | null;
  entregadas: number;
  tareas: number;
};

/** Los inscritos en una clase de 360, con su avance y su nota. */
export async function inscritosDeClase360(
  materiaId: string,
): Promise<InscritoEn360[]> {
  return consultar<InscritoEn360>(
    `SELECT i.id,
            e.id AS estudiante_id,
            e.nombre,
            i.estado,
            p.nombre AS periodo,
            i.ronda,
            i.nota::float8 AS nota,
            (SELECT round(avg(d.calificacion), 2)::float8
               FROM entrega_estudiante d
               JOIN asignacion a ON a.id = d.asignacion_id
              WHERE a.materia_360_id = $1
                AND d.estudiante_id = e.id
                AND d.calificacion IS NOT NULL) AS promedio_tareas,
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
      ORDER BY p.fecha_inicio DESC NULLS LAST, i.ronda, e.nombre`,
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
  /** La respuesta que el estudiante escribió en la plataforma. */
  texto_respuesta: string | null;
  calificacion: number | null;
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
