import { consultar, consultarUna } from "@/lib/db";
import type {
  BitacoraEntrada,
  ProyectoAsignadoRol,
  RendicionGastoItem,
  RolAsignableProyecto,
  TareaColaborador,
} from "@/lib/torre-control";

/**
 * Consultas para la Torre de Control del Colaborador y Rendición de Gastos.
 *
 * Sigue la regla de oro: las consultas usan SQL parametrizado y solo se
 * ejecutan en el servidor (`@/lib/db`). Los componentes de cliente solo
 * importan tipos de aquí o de `@/lib/torre-control`.
 */

/**
 * Obtiene las tareas asignadas o visibles para el colaborador en su jornada.
 */
export async function tareasColaborador(
  usuarioId: string,
): Promise<TareaColaborador[]> {
  return consultar<TareaColaborador>(
    `SELECT t.id,
            t.titulo,
            t.descripcion,
            t.estado,
            coalesce(t.prioridad, 'media') AS prioridad,
            t.visibilidad,
            t.fecha_limite::text AS fecha_limite,
            t.proyecto_id,
            p.nombre AS proyecto_nombre,
            (t.fecha_limite IS NOT NULL
             AND t.fecha_limite < CURRENT_DATE
             AND t.estado != 'completada') AS vencida,
            (t.fecha_limite IS NOT NULL
             AND t.fecha_limite = CURRENT_DATE) AS es_hoy,
            t.created_at::text AS creado_en
       FROM public.tarea t
       LEFT JOIN public.proyecto p ON p.id = t.proyecto_id
      WHERE (t.visibilidad = 'todos'
             OR EXISTS (SELECT 1 FROM public.tarea_asignado ta
                         WHERE ta.tarea_id = t.id
                           AND ta.usuario_id = $1))
      ORDER BY CASE coalesce(t.prioridad, 'media')
                 WHEN 'urgente' THEN 0
                 WHEN 'alta'    THEN 1
                 WHEN 'media'   THEN 2
                 ELSE 3
               END,
               t.fecha_limite NULLS LAST,
               t.created_at DESC`,
    [usuarioId],
  );
}

/**
 * Obtiene los proyectos o programas asignados al rol del colaborador por gobernanza de Superadmin.
 */
export async function proyectosPorRol(
  rol: string,
): Promise<{ id: string; nombre: string; descripcion: string | null; estado: string }[]> {
  return consultar<{ id: string; nombre: string; descripcion: string | null; estado: string }>(
    `SELECT p.id,
            p.nombre,
            p.descripcion,
            p.estado
       FROM public.proyecto p
       JOIN public.proyecto_rol pr ON pr.proyecto_id = p.id
      WHERE pr.rol = $1
      ORDER BY p.nombre ASC`,
    [rol],
  );
}

/**
 * Obtiene la bitácora de actividades registradas hoy por el colaborador.
 */
export async function bitacoraDeHoy(
  usuarioId: string,
): Promise<BitacoraEntrada[]> {
  return consultar<BitacoraEntrada>(
    `SELECT b.id,
            b.usuario_id,
            b.fecha::text AS fecha,
            b.descripcion,
            b.tarea_id,
            t.titulo AS tarea_titulo,
            b.minutos_dedicados,
            b.created_at::text AS creado_en
       FROM public.colaborador_bitacora_diaria b
       LEFT JOIN public.tarea t ON t.id = b.tarea_id
      WHERE b.usuario_id = $1
        AND b.fecha = CURRENT_DATE
      ORDER BY b.created_at DESC`,
    [usuarioId],
  );
}

/**
 * Resumen de indicadores para la cabecera de la jornada del colaborador.
 */
export async function resumenColaborador(
  usuarioId: string,
): Promise<{
  pendientes: number;
  enProgreso: number;
  completadasHoy: number;
  minutosHoy: number;
  rendicionesPendientes: number;
}> {
  const [tareas, bitacora, rendiciones] = await Promise.all([
    consultar<{ estado: string; completada_hoy: boolean }>(
      `SELECT t.estado,
              (t.estado = 'completada' AND t.updated_at::date = CURRENT_DATE) AS completada_hoy
         FROM public.tarea t
        WHERE (t.visibilidad = 'todos'
               OR EXISTS (SELECT 1 FROM public.tarea_asignado ta
                           WHERE ta.tarea_id = t.id AND ta.usuario_id = $1))`,
      [usuarioId],
    ),
    consultar<{ minutos: number }>(
      `SELECT coalesce(sum(minutos_dedicados), 0)::int AS minutos
         FROM public.colaborador_bitacora_diaria
        WHERE usuario_id = $1 AND fecha = CURRENT_DATE`,
      [usuarioId],
    ),
    consultar<{ conteo: number }>(
      `SELECT count(*)::int AS conteo
         FROM public.rendicion_gasto
        WHERE empleado_id = $1 AND estado IN ('enviada', 'en_revision')`,
      [usuarioId],
    ),
  ]);

  const pendientes = tareas.filter(
    (t) => t.estado === "por_hacer" || t.estado === "pendiente",
  ).length;
  const enProgreso = tareas.filter((t) => t.estado === "en_progreso").length;
  const completadasHoy = tareas.filter((t) => t.completada_hoy).length;
  const minutosHoy = bitacora[0]?.minutos ?? 0;
  const rendicionesPendientes = rendiciones[0]?.conteo ?? 0;

  return {
    pendientes,
    enProgreso,
    completadasHoy,
    minutosHoy,
    rendicionesPendientes,
  };
}

/**
 * Listado de rendiciones de gastos enviadas por el colaborador.
 */
export async function misRendiciones(
  usuarioId: string,
): Promise<RendicionGastoItem[]> {
  return consultar<RendicionGastoItem>(
    `SELECT rg.id,
            rg.codigo,
            rg.empleado_id,
            u.nombre AS empleado_nombre,
            u.email AS empleado_email,
            rg.programa_id,
            p.nombre AS programa_nombre,
            rg.proveedor_nombre,
            rg.proveedor_rnc,
            rg.ncf,
            rg.fecha_comprobante::text AS fecha_comprobante,
            rg.moneda,
            rg.monto_total::float AS monto_total,
            rg.monto_itbis::float AS monto_itbis,
            rg.concepto,
            rg.comprobante_url,
            rg.ocr_data,
            rg.estado,
            rg.motivo_rechazo,
            rev.nombre AS revisado_por_nombre,
            rg.revisado_en::text AS revisado_en,
            rg.created_at::text AS creado_en
       FROM public.rendicion_gasto rg
       JOIN public.usuario u ON u.id = rg.empleado_id
       LEFT JOIN public.proyecto p ON p.id = rg.programa_id
       LEFT JOIN public.usuario rev ON rev.id = rg.revisado_por
      WHERE rg.empleado_id = $1
      ORDER BY rg.created_at DESC`,
    [usuarioId],
  );
}

/**
 * Bandeja de rendiciones para Contabilidad y Superadmin.
 */
export async function todasRendiciones(filtros?: {
  estado?: string;
  programaId?: string;
}): Promise<RendicionGastoItem[]> {
  const condiciones: string[] = ["1=1"];
  const parametros: unknown[] = [];

  if (filtros?.estado && filtros.estado !== "todos") {
    parametros.push(filtros.estado);
    condiciones.push(`rg.estado = $${parametros.length}`);
  }

  if (filtros?.programaId && filtros.programaId !== "todos") {
    parametros.push(filtros.programaId);
    condiciones.push(`rg.programa_id = $${parametros.length}`);
  }

  return consultar<RendicionGastoItem>(
    `SELECT rg.id,
            rg.codigo,
            rg.empleado_id,
            u.nombre AS empleado_nombre,
            u.email AS empleado_email,
            rg.programa_id,
            p.nombre AS programa_nombre,
            rg.proveedor_nombre,
            rg.proveedor_rnc,
            rg.ncf,
            rg.fecha_comprobante::text AS fecha_comprobante,
            rg.moneda,
            rg.monto_total::float AS monto_total,
            rg.monto_itbis::float AS monto_itbis,
            rg.concepto,
            rg.comprobante_url,
            rg.ocr_data,
            rg.estado,
            rg.motivo_rechazo,
            rev.nombre AS revisado_por_nombre,
            rg.revisado_en::text AS revisado_en,
            rg.created_at::text AS creado_en
       FROM public.rendicion_gasto rg
       JOIN public.usuario u ON u.id = rg.empleado_id
       LEFT JOIN public.proyecto p ON p.id = rg.programa_id
       LEFT JOIN public.usuario rev ON rev.id = rg.revisado_por
      WHERE ${condiciones.join(" AND ")}
      ORDER BY rg.created_at DESC`,
    parametros,
  );
}

/**
 * Catálogo de programas institucionales activos para selección en rendición.
 */
export async function programasParaRendicion(): Promise<
  { id: string; nombre: string; codigo: string | null }[]
> {
  return consultar<{ id: string; nombre: string; codigo: string | null }>(
    `SELECT id, nombre, null AS codigo
       FROM public.proyecto
      ORDER BY nombre ASC`,
  );
}

/**
 * Matriz de proyectos y roles para la gobernanza exclusiva del Superadmin.
 */
export async function matrizProyectosRoles(): Promise<ProyectoAsignadoRol[]> {
  const proyectos = await consultar<{
    id: string;
    nombre: string;
    descripcion: string | null;
    estado: string;
  }>(
    `SELECT id, nombre, descripcion, estado
       FROM public.proyecto
      ORDER BY nombre ASC`,
  );

  const asignaciones = await consultar<{
    proyecto_id: string;
    rol: RolAsignableProyecto;
  }>(
    `SELECT proyecto_id, rol
       FROM public.proyecto_rol`,
  );

  return proyectos.map((p) => ({
    proyecto_id: p.id,
    proyecto_nombre: p.nombre,
    proyecto_descripcion: p.descripcion,
    proyecto_estado: p.estado,
    roles: asignaciones
      .filter((a) => a.proyecto_id === p.id)
      .map((a) => a.rol),
  }));
}

/** El comprobante de una rendición, para decidir si se puede entregar el archivo. */
export async function comprobanteDeRendicion(rendicionId: string) {
  return consultarUna<{ ruta: string | null; empleado_id: string }>(
    `SELECT comprobante_url AS ruta, empleado_id
       FROM public.rendicion_gasto
      WHERE id = $1`,
    [rendicionId],
  );
}
