import {
  usuarioTienePermiso,
  type UsuarioConPermisos,
} from "@/lib/rbac";
import type {
  EstadoTareaColaborador,
  PrioridadTarea,
  ProyectoTorre,
  TareaTorre,
} from "@/lib/torre-control";
import type { Reunion } from "@/lib/reuniones";
import { claveDia } from "@/lib/fechas";
import { flujoFinanciero } from "@/server/dashboard/consultas";
import { misNotificaciones } from "@/server/notificaciones/consultas";
import type { Notificacion } from "@/server/notificaciones/consultas";
import {
  proyectosConAvance,
  tareasDelTablero,
} from "@/server/operaciones/consultas";
import {
  proyectosDeUsuario,
  tareasDeUsuario,
} from "@/server/operaciones/torre-consultas";
import {
  pendientesDeLaFundacion,
  type PendientesFundacion,
} from "@/server/portales/administrativo";
import { listarReuniones } from "@/server/reuniones/consultas";
import { cuantasPorAtender } from "@/server/solicitudes/consultas";
import type { MesFinanciero } from "@/server/finanzas/consultas";

/**
 * Todo lo que la bandeja de administración necesita, en un solo viaje.
 *
 * CADA BLOQUE SE PIDE SOLO SI LA PERSONA TIENE EL PERMISO. No es esconder una
 * tarjeta: la consulta no se lanza, así que lo que el rol no puede ver ni
 * llega en la respuesta del servidor. Un bloque sin permiso vuelve `null` (y no
 * una lista vacía) para que la página distinga "no te toca" de "no hay nada".
 *
 * Los permisos se preguntan con `usuarioTienePermiso` y no con el rol: una
 * excepción en `usuario_permiso` tiene que contar aquí igual que en el menú.
 */
export type DatosBandeja = {
  /** Avisos de toda la Fundación más las solicitudes que esperan a esta persona. */
  pendientes: (PendientesFundacion & { solicitudes: number }) | null;
  tareas: TareaTorre[] | null;
  proyectos: ProyectoTorre[] | null;
  tareasGrafica: { prioridad: PrioridadTarea; estado: EstadoTareaColaborador }[] | null;
  proyectosGrafica: { nombre: string; avance: number }[] | null;
  reuniones: Reunion[] | null;
  notificaciones: Notificacion[];
  flujo: MesFinanciero[] | null;
};

const MAX_REUNIONES = 5;

export async function cargarBandeja(
  usuario: UsuarioConPermisos & { id: string },
): Promise<DatosBandeja> {
  const verOperaciones = usuarioTienePermiso(usuario, "operaciones.leer");
  const escribirOperaciones = usuarioTienePermiso(usuario, "operaciones.escribir");
  const verReuniones = usuarioTienePermiso(usuario, "reuniones.leer");
  const verFinanzas = usuarioTienePermiso(usuario, "finanzas.leer");

  const [
    pendientes,
    solicitudes,
    tareasPropias,
    proyectosPropios,
    tareasEquipo,
    proyectosEquipo,
    reuniones,
    notificaciones,
    flujo,
  ] = await Promise.all([
    verOperaciones ? pendientesDeLaFundacion() : null,
    // Las de ESTA persona: la separación de funciones saca de la cuenta lo
    // que pidió ella misma, que no le toca decidir.
    cuantasPorAtender(usuario),
    verOperaciones ? tareasDeUsuario(usuario.id) : null,
    verOperaciones ? proyectosDeUsuario(usuario.id) : null,
    verOperaciones
      ? tareasDelTablero({ usuarioId: usuario.id, puedeTodo: escribirOperaciones })
      : null,
    verOperaciones ? proyectosConAvance() : null,
    verReuniones ? listarReuniones({ usuarioId: usuario.id, rol: usuario.rol }) : null,
    misNotificaciones(usuario.id, 8),
    verFinanzas ? flujoFinanciero(6) : null,
  ]);

  // Si quien coordina no tiene tareas personales, mostramos las del equipo en
  // la tarjeta de bandeja para que pueda filtrar y completar desde aquí.
  const tareas =
    tareasPropias && tareasPropias.length > 0
      ? tareasPropias
      : tareasEquipo
        ? tareasEquipo.map((t) => ({
            id: t.id,
            titulo: t.titulo,
            descripcion: t.descripcion,
            estado: (t.estado as EstadoTareaColaborador) ?? "por_hacer",
            prioridad: (t.prioridad as PrioridadTarea) ?? "media",
            fecha_inicio: null,
            fecha_limite: t.fecha_limite,
            progreso: 0,
            horas_estimadas: 0,
            proyecto_id: t.proyecto_id,
            proyecto_nombre: t.proyecto,
            asignados: t.asignados,
            asignados_ids: [],
            comentarios: 0,
            vencida: t.vencida,
            es_hoy: false,
            esta_semana: false,
          }))
        : null;

  const tareasBaseGrafica =
    tareasEquipo && tareasEquipo.length > 0 ? tareasEquipo : tareasPropias;
  const tareasGrafica = tareasBaseGrafica
    ? tareasBaseGrafica.map((t) => ({
        prioridad: (t.prioridad as PrioridadTarea) ?? "media",
        estado: (t.estado as EstadoTareaColaborador) ?? "por_hacer",
      }))
    : null;

  const proyectosGrafica = proyectosEquipo
    ? proyectosEquipo
        .filter((p) => p.estado !== "completado" && p.estado !== "cancelado" && p.tareas > 0)
        .map((p) => ({
          nombre: p.nombre,
          avance: Math.round((p.hechas / p.tareas) * 100),
        }))
    : null;

  return {
    pendientes: pendientes ? { ...pendientes, solicitudes } : null,
    tareas,
    proyectos: proyectosPropios,
    tareasGrafica,
    proyectosGrafica,
    reuniones: reuniones ? proximasReuniones(reuniones) : null,
    notificaciones,
    flujo,
  };
}

/**
 * Lo programado de hoy en adelante, lo más cercano primero.
 *
 * `listarReuniones` devuelve lo más reciente primero y sin filtrar el futuro,
 * porque sirve a la pantalla de agenda; aquí interesa lo contrario. Se
 * compara la fecha como texto `YYYY-MM-DD`, que ordena igual que el calendario.
 */
function proximasReuniones(reuniones: Reunion[]): Reunion[] {
  const hoy = claveDia();

  return reuniones
    .filter((r) => r.estado === "programada" && r.fecha >= hoy)
    .sort((a, b) =>
      `${a.fecha} ${a.hora_inicio}`.localeCompare(`${b.fecha} ${b.hora_inicio}`),
    )
    .slice(0, MAX_REUNIONES);
}
