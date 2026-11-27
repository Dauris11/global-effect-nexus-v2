import { consultar } from "@/lib/db";
import type { OrigenClase } from "@/lib/clases";

/**
 * Las clases del estudiante, sacadas de sus MATRÍCULAS y no de sus tareas: una
 * clase sin ninguna tarea todavía tiene que tener su tarjeta.
 *
 * Carrera: inscripción `activa`. Global Effect 360: `cursando` o
 * `prematriculada`, que son las mismas condiciones con las que
 * `asignacionesDelEstudiante` y `entregarTareaMoodleAction` dejan ver y entregar.
 * Si una de las tres cambia, cambian las tres.
 */

export type ClaseDelEstudiante = {
  origen: OrigenClase;
  id: string;
  nombre: string;
  codigo: string | null;
  docente: string | null;
  periodo: string | null;
  periodo_id: string | null;
  horario: string | null;
  aula: string | null;
};

const COLUMNAS_CLASE = `nombre, codigo, docente, periodo, periodo_id, horario, aula`;

export async function clasesDelEstudiante(
  estudianteId: string | null,
): Promise<ClaseDelEstudiante[]> {
  if (!estudianteId) return [];

  return consultar<ClaseDelEstudiante>(
    `SELECT origen, id, ${COLUMNAS_CLASE}
       FROM (
         SELECT 'universidad' AS origen, m.id, m.nombre, m.codigo,
                m.profesor_nombre AS docente, p.nombre AS periodo,
                p.id AS periodo_id, m.horario, m.aula,
                p.fecha_inicio
           FROM inscripcion i
           JOIN materia m ON m.id = i.materia_id
           JOIN periodo p ON p.id = i.periodo_id
          WHERE i.estudiante_id = $1 AND i.estado = 'activa'
         UNION ALL
         SELECT 'g360', m.id, m.nombre, m.codigo,
                d.nombre, p.nombre, p.id, NULL, NULL, p.fecha_inicio
           FROM inscripcion_360 i
           JOIN materia_360 m ON m.id = i.materia_id
           JOIN periodo p ON p.id = i.periodo_id
           LEFT JOIN usuario d ON d.id = m.docente_id
          WHERE i.estudiante_id = $1 AND i.estado IN ('cursando', 'prematriculada')
       ) c
      ORDER BY (origen = 'g360') DESC, fecha_inicio DESC NULLS LAST, nombre`,
    [estudianteId],
  );
}

/**
 * Una clase concreta, o `null` si el estudiante NO está matriculado en ella.
 * Es la puerta del detalle: con solo el id de la URL cualquiera vería la clase
 * (y la retroalimentación) de otra persona.
 */
export async function claseDelEstudiante(
  estudianteId: string | null,
  origen: OrigenClase,
  id: string,
): Promise<ClaseDelEstudiante | null> {
  if (!estudianteId) return null;
  const clases = await clasesDelEstudiante(estudianteId);

  return clases.find((c) => c.origen === origen && c.id === id) ?? null;
}

export type SesionDeAsistencia = {
  fecha: string;
  /** `null` = sesión sin marcar todavía: no es lo mismo que ausente. */
  presente: boolean | null;
};

/**
 * Sesiones de la clase en el período del estudiante con su marca. Las fechas
 * salen como texto (`to_char`): un DATE convertido a `Date` puede correrse un
 * día según la zona del proceso.
 */
export async function asistenciaDeClase(
  estudianteId: string,
  clase: ClaseDelEstudiante,
): Promise<SesionDeAsistencia[]> {
  if (!clase.periodo_id) return [];

  if (clase.origen === "g360") {
    return consultar<SesionDeAsistencia>(
      `SELECT to_char(s.fecha, 'YYYY-MM-DD') AS fecha, a.presente
         FROM inscripcion_360 i
         JOIN sesion_360 s ON s.materia_360_id = i.materia_id AND s.periodo_id = i.periodo_id
         LEFT JOIN asistencia_360 a ON a.sesion_id = s.id AND a.inscripcion_id = i.id
        WHERE i.estudiante_id = $1 AND i.materia_id = $2 AND i.periodo_id = $3
          AND i.estado IN ('cursando', 'prematriculada')
        ORDER BY s.fecha DESC`,
      [estudianteId, clase.id, clase.periodo_id],
    );
  }

  return consultar<SesionDeAsistencia>(
    `SELECT to_char(s.fecha, 'YYYY-MM-DD') AS fecha, a.presente
       FROM inscripcion i
       JOIN sesion_materia s ON s.materia_id = i.materia_id AND s.periodo_id = i.periodo_id
       LEFT JOIN asistencia_materia a ON a.sesion_id = s.id AND a.inscripcion_id = i.id
      WHERE i.estudiante_id = $1 AND i.materia_id = $2 AND i.periodo_id = $3
        AND i.estado = 'activa'
      ORDER BY s.fecha DESC`,
    [estudianteId, clase.id, clase.periodo_id],
  );
}
