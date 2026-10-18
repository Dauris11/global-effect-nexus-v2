import { consultar, consultarUna } from "@/lib/db";
import type {
  AsignacionMoodleDetalle,
  FilaEntregaDocente,
  Materia360Matricula,
  VentanaMatricula360,
} from "@/lib/moodle";

/**
 * Consultas para el Aula Virtual estilo Moodle y Matrícula Global 360.
 */

/**
 * Obtiene el detalle completo de una asignación con restricciones Moodle
 * y el estado de entrega del estudiante.
 */
export async function asignacionMoodlePorId(
  asignacionId: string,
  estudianteId?: string,
): Promise<AsignacionMoodleDetalle | null> {
  const query = `
    SELECT a.id,
           a.titulo,
           a.descripcion,
           a.tipo::text AS tipo,
           a.archivo_url,
           a.fecha_publicacion::text AS fecha_publicacion,
           a.fecha_vencimiento::text AS fecha_vencimiento,
           coalesce(a.limite_mb, 10)::int AS limite_mb,
           coalesce(a.formatos_permitidos, ARRAY['pdf', 'docx', 'zip'])::text[] AS formatos_permitidos,
           coalesce(a.puntaje_maximo, 100.00)::float AS puntaje_maximo,
           coalesce(a.permite_entregas_tardias, true) AS permite_entregas_tardias,
           a.instrucciones_entrega,
           coalesce(m.nombre, c.nombre, m360.nombre, 'Materia') AS materia_nombre,
           coalesce(m.codigo, c.codigo, m360.codigo) AS materia_codigo,
           doc.nombre AS docente_nombre,
           (a.fecha_vencimiento IS NOT NULL AND a.fecha_vencimiento < now()) AS vencida,
           e.id AS entrega_id,
           coalesce(e.estado::text, 'pendiente') AS entrega_estado,
           e.archivo_url AS entrega_archivo_url,
           e.archivo_nombre AS entrega_archivo_nombre,
           e.archivo_tamano_mb::float AS entrega_archivo_tamano_mb,
           e.archivo_formato AS entrega_archivo_formato,
           e.fecha_entrega::text AS entrega_fecha,
           e.comentario_estudiante AS entrega_comentario_estudiante,
           e.calificacion::float AS calificacion,
           e.comentario_profesor,
           rev.nombre AS revisada_por_nombre,
           e.revisada_en::text AS revisada_en
      FROM public.asignacion a
      LEFT JOIN public.materia m ON m.id = a.materia_id
      LEFT JOIN public.curso c ON c.id = a.curso_id
      LEFT JOIN public.materia_360 m360 ON m360.id = a.materia_360_id
      LEFT JOIN public.usuario doc ON doc.id = a.creada_por_id
      LEFT JOIN public.entrega_estudiante e
        ON e.asignacion_id = a.id
       AND e.estudiante_id = $2
     WHERE a.id = $1
     LIMIT 1
  `;

  return consultarUna<AsignacionMoodleDetalle>(query, [
    asignacionId,
    estudianteId || "00000000-0000-0000-0000-000000000000",
  ]);
}

/**
 * Obtiene todas las entregas de una asignación para revisión y calificación del docente.
 */
export async function entregasDeAsignacionDocente(
  asignacionId: string,
): Promise<FilaEntregaDocente[]> {
  return consultar<FilaEntregaDocente>(
    `SELECT e.id AS entrega_id,
            est.id AS estudiante_id,
            u.nombre AS estudiante_nombre,
            est.matricula AS estudiante_matricula,
            u.email AS estudiante_email,
            e.estado::text AS estado,
            e.archivo_url,
            e.archivo_nombre,
            e.archivo_tamano_mb::float AS archivo_tamano_mb,
            e.archivo_formato,
            e.fecha_entrega::text AS fecha_entrega,
            e.comentario_estudiante,
            e.calificacion::float AS calificacion,
            e.comentario_profesor,
            (a.fecha_vencimiento IS NOT NULL AND e.fecha_entrega > a.fecha_vencimiento) AS es_tarde
       FROM public.entrega_estudiante e
       JOIN public.asignacion a ON a.id = e.asignacion_id
       JOIN public.estudiante est ON est.id = e.estudiante_id
       JOIN public.usuario u ON u.id = est.usuario_id
      WHERE e.asignacion_id = $1
      ORDER BY e.fecha_entrega DESC NULLS LAST`,
    [asignacionId],
  );
}

/**
 * Catálogo de materias de Global 360 para matrícula cuatrimestral con cupos, horarios y docentes.
 */
export async function catalogoMatricula360(
  estudianteId: string,
): Promise<Materia360Matricula[]> {
  const query = `
    SELECT m.id,
           m.nombre,
           m.codigo,
           m.descripcion,
           m.obligatoria,
           m.creditos,
           m.horas,
           coalesce(m.horario, 'Por coordinar') AS horario,
           coalesce(m.aula, 'Aula Virtual') AS aula,
           coalesce(m.cupo_maximo, 30)::int AS cupo_maximo,
           (SELECT count(*)::int
              FROM public.inscripcion_360 i
             WHERE i.materia_id = m.id
               AND i.estado IN ('prematriculada', 'cursando')) AS cupo_ocupado,
           u.nombre AS docente_nombre,
           (i_actual.id IS NOT NULL) AS inscrita,
           i_actual.id AS inscripcion_id,
           i_actual.ronda::int AS ronda_inscrita,
           i_actual.estado AS estado_inscripcion
      FROM public.materia_360 m
      LEFT JOIN public.usuario u ON u.id = m.docente_id
      LEFT JOIN public.inscripcion_360 i_actual
        ON i_actual.materia_id = m.id
       AND i_actual.estudiante_id = $1
       AND i_actual.estado IN ('prematriculada', 'cursando')
     WHERE m.activa = true
     ORDER BY m.obligatoria DESC, m.orden ASC, m.nombre ASC
  `;

  return consultar<Materia360Matricula>(query, [estudianteId]);
}

/**
 * Obtiene la ventana de matrícula cuatrimestral activa para Global 360.
 */
export async function ventanaMatriculaActiva(): Promise<VentanaMatricula360 | null> {
  const query = `
    SELECT v.id,
           v.periodo_id,
           p.nombre AS periodo_nombre,
           v.abre::text AS abre,
           v.cierra::text AS cierra,
           v.mensaje,
           v.activa,
           coalesce(v.ronda, 1)::int AS ronda,
           (v.activa AND now() >= v.abre AND now() <= v.cierra) AS abierta
      FROM public.ventana_prematricula v
      JOIN public.periodo p ON p.id = v.periodo_id
     WHERE v.activa = true
     ORDER BY (now() >= v.abre AND now() <= v.cierra) DESC, v.cierra DESC
     LIMIT 1
  `;

  return consultarUna<VentanaMatricula360>(query, []);
}
