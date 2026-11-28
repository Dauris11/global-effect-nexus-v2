"use server";

import { revalidatePath, updateTag } from "next/cache";

import { requerirPermiso, requerirUsuario } from "@/lib/auth";
import { consultar, consultarUna, enTransaccion } from "@/lib/db";
import { diaEnRD } from "@/lib/fechas";
import { TIPOS_TECNICOS } from "@/lib/prioridades/catalogo";
import { MARCADOR_CONFIGURADO } from "@/lib/prioridades/defaults";
import { TIPOS_PRIORIDAD } from "@/lib/prioridades/types";
import { esAccionSolicitud } from "@/lib/solicitudes";
import { procesarAsientos } from "@/server/contabilidad/asientos/acciones";
import { moverTarea } from "@/server/operaciones/acciones";
import { avanzarSolicitud } from "@/server/solicitudes/acciones";

import { etiquetaDePrioridades } from "./motor";

/**
 * Acciones para resolver un ítem SIN salir del inicio. Cada una reutiliza la acción real del módulo
 * (que vuelve a comprobar permisos y estado en el servidor): aquí solo se traduce `accion` → llamada.
 * Esconder el botón no es control de acceso; la puerta es la acción del módulo.
 */
export type ResultadoPrioridad = { ok: boolean; error?: "no_permitido" | "ya_cambio" | "falta_motivo" | "invalido" | "error" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Tras actuar: la lista de quien actuó se recalcula ya y el conteo del menú lateral se vuelve a leer. */
function refrescar(userId: string) {
  updateTag(etiquetaDePrioridades(userId));
  revalidatePath("/[locale]", "layout");
}

export async function resolverPrioridad(
  itemId: string,
  accion: string,
  extra: { motivo?: string } = {},
): Promise<ResultadoPrioridad> {
  const usuario = await requerirUsuario();
  const [, entidadId] = itemId.split(":");

  if (!entidadId || !UUID.test(entidadId)) return { ok: false, error: "invalido" };

  try {
    if (accion.startsWith("solicitud:")) {
      const paso = accion.slice("solicitud:".length);
      if (!esAccionSolicitud(paso)) return { ok: false, error: "invalido" };
      if (paso === "rechazar" && !extra.motivo?.trim()) return { ok: false, error: "falta_motivo" };

      const datos = new FormData();
      datos.set("id", entidadId);
      datos.set("accion", paso);
      datos.set("comentario", extra.motivo?.trim() ?? "");
      const r = await avanzarSolicitud({ estado: "inicial" }, datos);

      if (r.estado !== "ok") return { ok: false, error: r.estado === "ya_cambio" ? "ya_cambio" : r.estado === "no_permitido" ? "no_permitido" : "error" };
    } else if (accion === "tarea:hecha") {
      const datos = new FormData();
      datos.set("id", entidadId);
      datos.set("estado", "completada");
      const r = await moverTarea({ estado: "inicial" } as never, datos);

      if (r.estado !== "ok") return { ok: false, error: r.estado === "no_permitido" ? "no_permitido" : "error" };
    } else if (accion === "asiento:procesar") {
      const datos = new FormData();
      datos.append("ids", entidadId);
      const r = await procesarAsientos({ estado: "inicial" } as never, datos);

      if (r.estado !== "ok") return { ok: false, error: r.estado === "no_permitido" ? "no_permitido" : "error" };
    } else {
      return { ok: false, error: "invalido" };
    }
  } catch (error) {
    console.error("[prioridades] no se pudo resolver", itemId, accion, error);

    return { ok: false, error: "error" };
  }

  refrescar(usuario.id);

  return { ok: true };
}

/** «Posponer»: el ítem sale de MI lista hasta esa fecha. No toca la entidad (otros la siguen viendo). */
export async function posponerPrioridad(itemId: string, cuando: "manana" | "semana"): Promise<ResultadoPrioridad> {
  const usuario = await requerirUsuario();
  if (!/^[a-z_]+:[0-9a-f-]{36}$/i.test(itemId)) return { ok: false, error: "invalido" };

  const dias = cuando === "manana" ? 1 : 7;
  const hasta = diaEnRD(new Date(Date.now() + dias * 86_400_000));

  await consultar(
    `INSERT INTO prioridad_pospuesta (user_id, item_id, hasta) VALUES ($1, $2, $3::date)
     ON CONFLICT (user_id, item_id) DO UPDATE SET hasta = EXCLUDED.hasta, creada_en = now()`,
    [usuario.id, itemId, hasta],
  );
  refrescar(usuario.id);

  return { ok: true };
}

export async function deshacerPosponer(itemId: string): Promise<ResultadoPrioridad> {
  const usuario = await requerirUsuario();

  await consultar(`DELETE FROM prioridad_pospuesta WHERE user_id = $1 AND item_id = $2`, [usuario.id, itemId]);
  refrescar(usuario.id);

  return { ok: true };
}

/**
 * «Qué atiende»: guarda los tipos de pendiente de una persona. Solo quien administra al personal
 * (`usuarios.administrar`). La fila marcador permite desmarcarlo todo sin volver al reparto del rol.
 */
export async function guardarResponsabilidades(userId: string, tipos: string[]): Promise<ResultadoPrioridad> {
  await requerirPermiso("usuarios.administrar");
  if (!UUID.test(userId)) return { ok: false, error: "invalido" };

  const persona = await consultarUna<{ rol: string }>(
    `SELECT r.nombre AS rol FROM usuario u JOIN rol r ON r.id = u.rol_id WHERE u.id = $1`,
    [userId],
  );
  if (!persona) return { ok: false, error: "invalido" };

  // Los tipos técnicos solo se le pueden marcar a un developer.
  const validos = [...new Set(tipos)].filter(
    (t) =>
      (TIPOS_PRIORIDAD as readonly string[]).includes(t) &&
      (persona.rol === "developer" || !(TIPOS_TECNICOS as readonly string[]).includes(t)),
  );

  await enTransaccion(async (cliente) => {
    await cliente.query(`DELETE FROM responsabilidades_personal WHERE user_id = $1`, [userId]);
    await cliente.query(
      `INSERT INTO responsabilidades_personal (user_id, tipo_prioridad) SELECT $1, unnest($2::text[])`,
      [userId, [MARCADOR_CONFIGURADO, ...validos]],
    );
  });
  updateTag(etiquetaDePrioridades(userId));

  return { ok: true };
}

/** Quita la personalización: la persona vuelve al reparto de fábrica de su rol. */
export async function restablecerResponsabilidades(userId: string): Promise<ResultadoPrioridad> {
  await requerirPermiso("usuarios.administrar");
  if (!UUID.test(userId)) return { ok: false, error: "invalido" };

  await consultar(`DELETE FROM responsabilidades_personal WHERE user_id = $1`, [userId]);
  updateTag(etiquetaDePrioridades(userId));

  return { ok: true };
}
