import { consultar, consultarUna } from "@/lib/db";
import type {
  CargaPersona,
  PersonaTorre,
  ProyectoTorre,
  TareaTorre,
} from "@/lib/torre-control";

/**
 * Torre de control: lo que una persona tiene asignado y la carga del equipo.
 *
 * A diferencia del tablero, aquí manda la ASIGNACIÓN y no la visibilidad: una
 * tarea `visibilidad = 'todos'` la puede ver cualquiera, pero no es trabajo de
 * cualquiera. Si entrara, la torre de cada persona se llenaría de lo de los
 * demás y dejaría de decir qué le toca.
 *
 * `pendiente` es el estado viejo de la 0009 (la 0041 lo renombró a
 * `por_hacer`). Se normaliza en el SELECT para que una fila que se escapó a la
 * migración no rompa los contadores del cliente.
 */

/**
 * "Esta semana" es hasta el domingo, no los próximos siete días: así lo cuenta
 * la gente cuando planifica el lunes.
 */
const FIN_DE_SEMANA = `(date_trunc('week', CURRENT_DATE)::date + 6)`;
const ABIERTA = `t.estado IN ('por_hacer', 'pendiente', 'en_progreso', 'en_revision')`;

/**
 * Las tareas de una persona: todo lo abierto y lo cerrado en los últimos 14
 * días (para ver lo que se hizo sin arrastrar el histórico entero).
 */
export async function tareasDeUsuario(usuarioId: string): Promise<TareaTorre[]> {
  return consultar<TareaTorre>(
    `SELECT t.id,
            t.titulo,
            t.descripcion,
            CASE WHEN t.estado = 'pendiente' THEN 'por_hacer' ELSE t.estado END AS estado,
            coalesce(t.prioridad, 'media') AS prioridad,
            t.fecha_inicio::text AS fecha_inicio,
            t.fecha_limite::text AS fecha_limite,
            coalesce(t.progreso, 0)::int AS progreso,
            coalesce(t.horas_estimadas, 0)::float8 AS horas_estimadas,
            t.proyecto_id,
            p.nombre AS proyecto_nombre,
            (SELECT string_agg(u.nombre, ', ' ORDER BY u.nombre)
               FROM tarea_asignado x JOIN usuario u ON u.id = x.usuario_id
              WHERE x.tarea_id = t.id) AS asignados,
            coalesce((SELECT array_agg(x.usuario_id::text)
                        FROM tarea_asignado x WHERE x.tarea_id = t.id), '{}') AS asignados_ids,
            (SELECT count(*)::int FROM tarea_comentario c WHERE c.tarea_id = t.id) AS comentarios,
            (${ABIERTA} AND t.fecha_limite < CURRENT_DATE) AS vencida,
            (t.fecha_limite = CURRENT_DATE) AS es_hoy,
            (t.fecha_limite BETWEEN CURRENT_DATE AND ${FIN_DE_SEMANA}) AS esta_semana
       FROM tarea t
       JOIN tarea_asignado ta ON ta.tarea_id = t.id AND ta.usuario_id = $1
       LEFT JOIN proyecto p ON p.id = t.proyecto_id
      WHERE ${ABIERTA}
         OR (t.estado = 'completada' AND t.updated_at >= now() - interval '14 days')
      ORDER BY (t.estado = 'completada'),
               (${ABIERTA} AND t.fecha_limite < CURRENT_DATE) DESC,
               t.fecha_limite NULLS LAST,
               CASE coalesce(t.prioridad, 'media')
                 WHEN 'urgente' THEN 0 WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3
               END,
               t.created_at`,
    [usuarioId],
  );
}

/**
 * Los proyectos de una persona: los que lidera, en los que es miembro y en los
 * que tiene alguna tarea. El tercer caso cuenta porque asignar una tarea de un
 * proyecto ya es meter a alguien en él, aunque nadie lo haya hecho miembro.
 */
export async function proyectosDeUsuario(usuarioId: string): Promise<ProyectoTorre[]> {
  return consultar<ProyectoTorre>(
    `SELECT p.id,
            p.nombre,
            p.estado,
            p.fecha_fin::text AS fecha_fin,
            coalesce(r.nombre, p.responsable) AS responsable_nombre,
            (p.responsable_id = $1) AS es_responsable,
            (SELECT count(*)::int FROM tarea t
              WHERE t.proyecto_id = p.id AND t.estado <> 'cancelada') AS tareas,
            (SELECT count(*)::int FROM tarea t
              WHERE t.proyecto_id = p.id AND t.estado = 'completada') AS hechas,
            (SELECT count(*)::int FROM tarea t
               JOIN tarea_asignado ta ON ta.tarea_id = t.id AND ta.usuario_id = $1
              WHERE t.proyecto_id = p.id AND ${ABIERTA}) AS mis_abiertas
       FROM proyecto p
       LEFT JOIN usuario r ON r.id = p.responsable_id
      WHERE p.responsable_id = $1
         OR EXISTS (SELECT 1 FROM proyecto_miembro m
                     WHERE m.proyecto_id = p.id AND m.usuario_id = $1)
         OR EXISTS (SELECT 1 FROM tarea t
                      JOIN tarea_asignado ta ON ta.tarea_id = t.id AND ta.usuario_id = $1
                     WHERE t.proyecto_id = p.id)
      ORDER BY (p.estado = 'completado'), p.fecha_fin NULLS LAST, p.nombre`,
    [usuarioId],
  );
}

/**
 * La carga por persona para la torre de administración.
 *
 * Entran todas las cuentas activas salvo estudiantes, y los estudiantes solo
 * si tienen algo asignado: el reparto es del personal, pero si alguien le dio
 * una tarea a un becado, tiene que verse.
 */
export async function cargaPorPersona(): Promise<CargaPersona[]> {
  return consultar<CargaPersona>(
    `WITH asignadas AS (
       SELECT ta.usuario_id, t.*
         FROM tarea_asignado ta
         JOIN tarea t ON t.id = ta.tarea_id
     )
     SELECT u.id AS usuario_id,
            u.nombre,
            r.nombre AS rol,
            count(*) FILTER (WHERE ${ABIERTA})::int AS abiertas,
            count(*) FILTER (WHERE t.estado = 'en_progreso')::int AS en_progreso,
            count(*) FILTER (WHERE ${ABIERTA} AND t.fecha_limite < CURRENT_DATE)::int AS vencidas,
            count(*) FILTER (WHERE ${ABIERTA} AND t.fecha_limite = CURRENT_DATE)::int AS hoy,
            count(*) FILTER (WHERE ${ABIERTA}
                               AND t.fecha_limite BETWEEN CURRENT_DATE AND ${FIN_DE_SEMANA})::int AS semana,
            coalesce(sum(t.horas_estimadas) FILTER (WHERE ${ABIERTA}), 0)::float8 AS horas_pendientes,
            count(*) FILTER (WHERE t.estado = 'completada'
                               AND t.updated_at >= now() - interval '7 days')::int AS completadas_7d,
            coalesce(round(avg(coalesce(t.progreso, 0)) FILTER (WHERE ${ABIERTA})), 0)::int AS progreso_medio,
            (SELECT count(DISTINCT pid)::int FROM (
               SELECT m.proyecto_id AS pid FROM proyecto_miembro m WHERE m.usuario_id = u.id
               UNION
               SELECT p.id FROM proyecto p WHERE p.responsable_id = u.id
             ) s) AS proyectos
       FROM usuario u
       JOIN rol r ON r.id = u.rol_id
       LEFT JOIN asignadas t ON t.usuario_id = u.id
      WHERE u.activo
        AND (r.nombre <> 'estudiante'
             OR EXISTS (SELECT 1 FROM tarea_asignado x WHERE x.usuario_id = u.id))
      GROUP BY u.id, u.nombre, r.nombre
      ORDER BY count(*) FILTER (WHERE ${ABIERTA} AND t.fecha_limite < CURRENT_DATE) DESC,
               count(*) FILTER (WHERE ${ABIERTA}) DESC,
               u.nombre`,
  );
}

/** La persona cuya torre se abre. `null` si no existe o está inactiva. */
export async function personaTorre(usuarioId: string): Promise<PersonaTorre | null> {
  return consultarUna<PersonaTorre>(
    `SELECT u.id, u.nombre, r.nombre AS rol
       FROM usuario u JOIN rol r ON r.id = u.rol_id
      WHERE u.id = $1 AND u.activo`,
    [usuarioId],
  );
}

/**
 * Si la persona lidera el proyecto, es miembro o tiene alguna tarea en él: la
 * misma regla que `proyectosDeUsuario`. Abre la ficha del proyecto a quien no
 * tiene `operaciones.leer`, porque la torre y el aviso de «te sumaron a un
 * proyecto» lo mandan ahí.
 */
export async function participaEnProyecto(
  usuarioId: string,
  proyectoId: string,
): Promise<boolean> {
  const fila = await consultarUna<{ participa: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM proyecto p
        WHERE p.id = $2
          AND (p.responsable_id = $1
               OR EXISTS (SELECT 1 FROM proyecto_miembro m
                           WHERE m.proyecto_id = p.id AND m.usuario_id = $1)
               OR EXISTS (SELECT 1 FROM tarea t
                            JOIN tarea_asignado ta ON ta.tarea_id = t.id AND ta.usuario_id = $1
                           WHERE t.proyecto_id = p.id))
     ) AS participa`,
    [usuarioId, proyectoId],
  );
  return fila?.participa ?? false;
}

/** Si alguien tiene al menos una tarea asignada: decide si un estudiante entra. */
export async function tieneTareasAsignadas(usuarioId: string): Promise<boolean> {
  const fila = await consultarUna<{ hay: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM tarea_asignado WHERE usuario_id = $1) AS hay`,
    [usuarioId],
  );
  return fila?.hay ?? false;
}

export type EquipoProyecto = {
  responsable_id: string | null;
  miembros: string[];
};

/** Responsable y miembros de un proyecto, para el formulario de equipo. */
export async function equipoDeProyecto(proyectoId: string): Promise<EquipoProyecto> {
  const fila = await consultarUna<EquipoProyecto>(
    `SELECT p.responsable_id,
            coalesce((SELECT array_agg(m.usuario_id::text)
                        FROM proyecto_miembro m WHERE m.proyecto_id = p.id), '{}') AS miembros
       FROM proyecto p WHERE p.id = $1`,
    [proyectoId],
  );
  return fila ?? { responsable_id: null, miembros: [] };
}
