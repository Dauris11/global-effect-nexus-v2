import { consultar, consultarUna } from "@/lib/db";

export type FaseProyecto = {
  id: string;
  proyecto_id: string;
  nombre: string;
  orden: number;
  color: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
};

export type HitoProyecto = {
  id: string;
  proyecto_id: string;
  nombre: string;
  descripcion: string | null;
  fecha: string;
  alcanzado: boolean;
};

export type TareaGantt = {
  id: string;
  proyecto_id: string;
  fase_id: string | null;
  fase_nombre: string | null;
  tarea_padre_id: string | null;
  titulo: string;
  descripcion: string | null;
  estado: string;
  prioridad: string;
  fecha_inicio: string;
  fecha_limite: string;
  progreso: number;
  horas_estimadas: number;
  horas_reales: number;
  es_hito: boolean;
  asignados: string | null;
  dependencias_ids: string[];
};

export type ProyectoDetalleGantt = {
  id: string;
  nombre: string;
  descripcion: string | null;
  responsable: string | null;
  estado: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  fases: FaseProyecto[];
  hitos: HitoProyecto[];
  tareas: TareaGantt[];
};

/**
 * Obtiene el detalle completo de un proyecto estructurado para Gantt.
 */
export async function proyectoParaGantt(proyectoId: string): Promise<ProyectoDetalleGantt | null> {
  const proyecto = await consultarUna<{
    id: string;
    nombre: string;
    descripcion: string | null;
    responsable: string | null;
    estado: string;
    fecha_inicio: string | null;
    fecha_fin: string | null;
  }>(
    `SELECT id, nombre, descripcion, responsable, estado,
            fecha_inicio::text, fecha_fin::text
       FROM public.proyecto
      WHERE id = $1`,
    [proyectoId],
  );

  if (!proyecto) return null;

  const [fases, hitos, tareas, dependencias] = await Promise.all([
    consultar<FaseProyecto>(
      `SELECT id, proyecto_id, nombre, orden, color,
              fecha_inicio::text, fecha_fin::text
         FROM public.proyecto_fase
        WHERE proyecto_id = $1
        ORDER BY orden ASC`,
      [proyectoId],
    ),
    consultar<HitoProyecto>(
      `SELECT id, proyecto_id, nombre, descripcion,
              fecha::text, alcanzado
         FROM public.proyecto_hito
        WHERE proyecto_id = $1
        ORDER BY fecha ASC`,
      [proyectoId],
    ),
    consultar<{
      id: string;
      proyecto_id: string;
      fase_id: string | null;
      fase_nombre: string | null;
      tarea_padre_id: string | null;
      titulo: string;
      descripcion: string | null;
      estado: string;
      prioridad: string;
      fecha_inicio: string | null;
      fecha_limite: string | null;
      progreso: number;
      horas_estimadas: number;
      horas_reales: number;
      es_hito: boolean;
      created_at: string;
      asignados: string | null;
    }>(
      `SELECT t.id,
              t.proyecto_id,
              t.fase_id,
              pf.nombre AS fase_nombre,
              t.tarea_padre_id,
              t.titulo,
              t.descripcion,
              t.estado,
              coalesce(t.prioridad, 'media') AS prioridad,
              coalesce(t.fecha_inicio::text, t.created_at::date::text) AS fecha_inicio,
              coalesce(t.fecha_limite::text, (coalesce(t.fecha_inicio, t.created_at::date) + interval '7 days')::date::text) AS fecha_limite,
              coalesce(t.progreso, 0) AS progreso,
              coalesce(t.horas_estimadas, 0)::float AS horas_estimadas,
              coalesce(t.horas_reales, 0)::float AS horas_reales,
              t.es_hito,
              t.created_at::text AS created_at,
              (
                SELECT string_agg(u.nombre, ', ')
                  FROM public.tarea_asignado ta
                  JOIN public.usuario u ON u.id = ta.usuario_id
                 WHERE ta.tarea_id = t.id
              ) AS asignados
         FROM public.tarea t
         LEFT JOIN public.proyecto_fase pf ON pf.id = t.fase_id
        WHERE t.proyecto_id = $1
          AND t.estado <> 'cancelada'
        ORDER BY pf.orden ASC NULLS LAST, t.fecha_inicio ASC NULLS LAST, t.created_at ASC`,
      [proyectoId],
    ),
    consultar<{ tarea_destino_id: string; tarea_origen_id: string }>(
      `SELECT td.tarea_destino_id, td.tarea_origen_id
         FROM public.tarea_dependencia td
         JOIN public.tarea t ON t.id = td.tarea_destino_id
        WHERE t.proyecto_id = $1`,
      [proyectoId],
    ),
  ]);

  // Mapear dependencias a cada tarea
  const depMap = new Map<string, string[]>();
  for (const dep of dependencias) {
    const arr = depMap.get(dep.tarea_destino_id) ?? [];
    arr.push(dep.tarea_origen_id);
    depMap.set(dep.tarea_destino_id, arr);
  }

  const tareasGantt: TareaGantt[] = tareas.map((t) => ({
    id: t.id,
    proyecto_id: t.proyecto_id,
    fase_id: t.fase_id,
    fase_nombre: t.fase_nombre,
    tarea_padre_id: t.tarea_padre_id,
    titulo: t.titulo,
    descripcion: t.descripcion,
    estado: t.estado,
    prioridad: t.prioridad,
    fecha_inicio: t.fecha_inicio ?? new Date().toISOString().slice(0, 10),
    fecha_limite: t.fecha_limite ?? new Date().toISOString().slice(0, 10),
    progreso: t.progreso,
    horas_estimadas: t.horas_estimadas,
    horas_reales: t.horas_reales,
    es_hito: t.es_hito,
    asignados: t.asignados,
    dependencias_ids: depMap.get(t.id) ?? [],
  }));

  return {
    id: proyecto.id,
    nombre: proyecto.nombre,
    descripcion: proyecto.descripcion,
    responsable: proyecto.responsable,
    estado: proyecto.estado,
    fecha_inicio: proyecto.fecha_inicio,
    fecha_fin: proyecto.fecha_fin,
    fases,
    hitos,
    tareas: tareasGantt,
  };
}
