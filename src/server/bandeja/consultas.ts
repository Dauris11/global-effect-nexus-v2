import { usuarioTienePermiso, type UsuarioConPermisos } from "@/lib/rbac";
import type { ProyectoTorre, TareaTorre } from "@/lib/torre-control";
import type { Reunion } from "@/lib/reuniones";
import { claveDia } from "@/lib/fechas";
import { flujoFinanciero } from "@/server/dashboard/consultas";
import { misNotificaciones } from "@/server/notificaciones/consultas";
import type { Notificacion } from "@/server/notificaciones/consultas";
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
  reuniones: Reunion[] | null;
  notificaciones: Notificacion[];
  flujo: MesFinanciero[] | null;
};

const MAX_REUNIONES = 5;

export async function cargarBandeja(
  usuario: UsuarioConPermisos & { id: string },
): Promise<DatosBandeja> {
  const verOperaciones = usuarioTienePermiso(usuario, "operaciones.leer");
  const verReuniones = usuarioTienePermiso(usuario, "reuniones.leer");
  const verFinanzas = usuarioTienePermiso(usuario, "finanzas.leer");

  const [pendientes, solicitudes, tareas, proyectos, reuniones, notificaciones, flujo] =
    await Promise.all([
      verOperaciones ? pendientesDeLaFundacion() : null,
      // Las de ESTA persona: la separación de funciones saca de la cuenta lo
      // que pidió ella misma, que no le toca decidir.
      cuantasPorAtender(usuario),
      verOperaciones ? tareasDeUsuario(usuario.id) : null,
      verOperaciones ? proyectosDeUsuario(usuario.id) : null,
      verReuniones ? listarReuniones({ usuarioId: usuario.id, rol: usuario.rol }) : null,
      misNotificaciones(usuario.id, 8),
      verFinanzas ? flujoFinanciero(6) : null,
    ]);

  return {
    pendientes: pendientes ? { ...pendientes, solicitudes } : null,
    tareas,
    proyectos,
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
