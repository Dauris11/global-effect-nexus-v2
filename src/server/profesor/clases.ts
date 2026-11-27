import { consultar } from "@/lib/db";
import { SQL_HOY_RD } from "@/lib/fecha-rd";
import type { OrigenClase } from "@/lib/clases";

/**
 * Las clases del docente en una sola lista: las de Global Effect 360 y las
 * materias de la carrera que coordinación le asignó. Lo que cambia respecto a
 * `clases360` y `materiasDelDocente` es que aquí vienen JUNTAS y con lo que el
 * docente necesita ver en la tarjeta: cuántas entregas esperan nota y cuándo es
 * la próxima sesión.
 *
 * `docenteId = null` es TODO (quien tiene `academico.escribir`); con un id, solo
 * lo suyo. Es la misma frontera de `consultas.ts` y se decide en quien llama.
 */

export type ClaseDelDocente = {
  origen: OrigenClase;
  id: string;
  nombre: string;
  codigo: string | null;
  periodo: string | null;
  periodo_id: string | null;
  horario: string | null;
  aula: string | null;
  estudiantes: number;
  /** Entregas en estado entregado/tarde: lo que espera nota. */
  sin_calificar: number;
  /** Día `YYYY-MM-DD` de la próxima sesión programada, o `null`. */
  proxima_sesion: string | null;
};

export async function clasesDelDocente(docenteId: string | null): Promise<ClaseDelDocente[]> {
  return consultar<ClaseDelDocente>(
    `SELECT * FROM (
       SELECT 'g360' AS origen, m.id, m.nombre, m.codigo,
              pv.nombre AS periodo, pv.id AS periodo_id, m.horario, m.aula,
              (SELECT count(*)::int FROM inscripcion_360 i
                WHERE i.materia_id = m.id AND i.estado IN ('prematriculada', 'cursando')) AS estudiantes,
              (SELECT count(*)::int FROM entrega_estudiante d
                 JOIN asignacion a ON a.id = d.asignacion_id
                WHERE a.materia_360_id = m.id AND d.estado IN ('entregado', 'tarde')) AS sin_calificar,
              (SELECT to_char(min(s.fecha), 'YYYY-MM-DD') FROM sesion_360 s
                WHERE s.materia_360_id = m.id AND s.fecha >= ${SQL_HOY_RD}) AS proxima_sesion,
              m.activa AS vigente, 0 AS orden
         FROM materia_360 m
         LEFT JOIN LATERAL (
              SELECT p.id, p.nombre FROM inscripcion_360 i
                JOIN periodo p ON p.id = i.periodo_id
               WHERE i.materia_id = m.id AND i.estado <> 'retirada'
               ORDER BY p.fecha_inicio DESC LIMIT 1) pv ON TRUE
        WHERE ($1::uuid IS NULL OR m.docente_id = $1)
       UNION ALL
       SELECT 'universidad', m.id, m.nombre, m.codigo,
              p.nombre, p.id, m.horario, m.aula,
              (SELECT count(*)::int FROM inscripcion i
                WHERE i.materia_id = m.id AND i.estado <> 'retirada'),
              (SELECT count(*)::int FROM entrega_estudiante d
                 JOIN asignacion a ON a.id = d.asignacion_id
                WHERE a.materia_id = m.id AND d.estado IN ('entregado', 'tarde')),
              (SELECT to_char(min(s.fecha), 'YYYY-MM-DD') FROM sesion_materia s
                WHERE s.materia_id = m.id AND s.fecha >= ${SQL_HOY_RD}),
              (m.estado = 'activa'), 1
         FROM materia m
         LEFT JOIN periodo p ON p.id = m.periodo_id
        WHERE ($1::uuid IS NULL OR m.profesor_usuario_id = $1)
     ) c
     ORDER BY vigente DESC, sin_calificar DESC, orden, nombre`,
    [docenteId],
  );
}

/** Una clase concreta, o `null` si no es de este docente (o no existe). */
export async function claseDelDocente(
  docenteId: string | null,
  origen: OrigenClase,
  id: string,
): Promise<ClaseDelDocente | null> {
  const clases = await clasesDelDocente(docenteId);

  return clases.find((c) => c.origen === origen && c.id === id) ?? null;
}

export type SesionConMarcas = {
  id: string;
  fecha: string;
  presentes: number;
  ausentes: number;
  tardes: number;
  total: number;
};

export type EstudianteParaAsistencia = {
  inscripcion_id: string;
  nombre: string;
  /** Marca de HOY si ya existía; `null` = sin marcar (por defecto se propone Presente). */
  marca_hoy: "presente" | "ausente" | "tarde" | null;
};

/** Sesiones ya dadas de la clase, de la más reciente, con sus conteos. */
export async function sesionesDeLaClase(clase: ClaseDelDocente): Promise<SesionConMarcas[]> {
  const g = clase.origen === "g360";

  return consultar<SesionConMarcas>(
    `SELECT s.id, to_char(s.fecha, 'YYYY-MM-DD') AS fecha,
            count(*) FILTER (WHERE a.presente IS TRUE AND a.tarde IS FALSE)::int AS presentes,
            count(*) FILTER (WHERE a.presente IS FALSE)::int AS ausentes,
            count(*) FILTER (WHERE a.tarde IS TRUE)::int AS tardes,
            count(i.id)::int AS total
       FROM ${g ? "sesion_360" : "sesion_materia"} s
       LEFT JOIN ${g ? "inscripcion_360" : "inscripcion"} i
              ON i.materia_id = s.${g ? "materia_360_id" : "materia_id"}
             AND i.periodo_id = s.periodo_id AND i.estado <> 'retirada'
       LEFT JOIN ${g ? "asistencia_360" : "asistencia_materia"} a
              ON a.sesion_id = s.id AND a.inscripcion_id = i.id
      WHERE s.${g ? "materia_360_id" : "materia_id"} = $1
        ${clase.periodo_id ? "AND s.periodo_id = $2" : ""}
      GROUP BY s.id
      ORDER BY s.fecha DESC
      LIMIT 30`,
    clase.periodo_id ? [clase.id, clase.periodo_id] : [clase.id],
  );
}

/** El roster para pasar lista hoy: inscritos del período vigente, con su marca de hoy. */
export async function estudiantesParaAsistencia(
  clase: ClaseDelDocente,
): Promise<EstudianteParaAsistencia[]> {
  if (!clase.periodo_id) return [];
  const g = clase.origen === "g360";

  return consultar<EstudianteParaAsistencia>(
    `SELECT i.id AS inscripcion_id, e.nombre,
            CASE WHEN a.sesion_id IS NULL THEN NULL
                 WHEN a.tarde THEN 'tarde'
                 WHEN a.presente THEN 'presente'
                 ELSE 'ausente' END AS marca_hoy
       FROM ${g ? "inscripcion_360" : "inscripcion"} i
       JOIN estudiante e ON e.id = i.estudiante_id
       LEFT JOIN ${g ? "sesion_360" : "sesion_materia"} s
              ON s.${g ? "materia_360_id" : "materia_id"} = i.materia_id
             AND s.periodo_id = i.periodo_id AND s.fecha = ${SQL_HOY_RD}
       LEFT JOIN ${g ? "asistencia_360" : "asistencia_materia"} a
              ON a.sesion_id = s.id AND a.inscripcion_id = i.id
      WHERE i.materia_id = $1 AND i.periodo_id = $2 AND i.estado <> 'retirada'
      ORDER BY e.nombre`,
    [clase.id, clase.periodo_id],
  );
}

/** Entregas que esperan nota, por tarea, de UNA clase (para el contador de cada fila). */
export async function pendientesPorTarea(clase: ClaseDelDocente): Promise<Record<string, number>> {
  const filas = await consultar<{ asignacion_id: string; n: number }>(
    `SELECT d.asignacion_id, count(*)::int AS n
       FROM entrega_estudiante d
       JOIN asignacion a ON a.id = d.asignacion_id
      WHERE a.${clase.origen === "g360" ? "materia_360_id" : "materia_id"} = $1
        AND d.estado IN ('entregado', 'tarde')
      GROUP BY d.asignacion_id`,
    [clase.id],
  );

  return Object.fromEntries(filas.map((f) => [f.asignacion_id, f.n]));
}
