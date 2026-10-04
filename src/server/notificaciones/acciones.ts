"use server";

import { revalidatePath } from "next/cache";

import { requerirUsuario } from "@/lib/auth";
import { consultarUna } from "@/lib/db";

/**
 * Marcar avisos como leídos.
 *
 * NO HAY BORRADO, y es a propósito: un aviso es el rastro de que a alguien se
 * le dijo algo. Leído se queda en la lista, más abajo y sin resaltar; borrarlo
 * dejaría al asignado sin poder comprobar qué se le avisó y cuándo.
 *
 * El `WHERE usuario_id = $2` de las dos consultas es la única defensa que hay
 * aquí, y basta: un id de notificación ajeno no encuentra fila. No se comprueba
 * antes con un SELECT porque eso serían dos viajes y una rendija entre ambos.
 */

export type EstadoNotificaciones = { estado: "inicial" | "ok" | "error" };

/** Marca una sola. Se llama al pulsar el aviso, antes de seguir su enlace. */
export async function marcarLeida(datos: FormData): Promise<void> {
  const usuario = await requerirUsuario();
  const id = String(datos.get("id") ?? "").trim();

  if (!esUuid(id)) return;

  try {
    await consultarUna<{ id: string }>(
      `UPDATE notificacion
          SET leida = TRUE
        WHERE id = $1
          AND usuario_id = $2
          AND NOT leida
      RETURNING id`,
      [id, usuario.id],
    );
  } catch (error) {
    console.error("[notificaciones] no se pudo marcar como leída", error);
  }

  refrescar();
}

/** Marca todas las de la cuenta. */
export async function marcarTodasLeidas(): Promise<void> {
  const usuario = await requerirUsuario();

  try {
    await consultarUna<{ id: string }>(
      `UPDATE notificacion
          SET leida = TRUE
        WHERE usuario_id = $1
          AND NOT leida
      RETURNING id`,
      [usuario.id],
    );
  } catch (error) {
    console.error("[notificaciones] no se pudieron marcar todas", error);
  }

  refrescar();
}

/**
 * La campana vive en el armazón, así que lo que se refresca es el LAYOUT.
 *
 * Con `"page"` el contador se quedaría con el número viejo hasta la siguiente
 * navegación: la campana no está en la página, está por encima de ella.
 */
function refrescar(): void {
  revalidatePath("/[locale]", "layout");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function esUuid(valor: string): boolean {
  return UUID.test(valor);
}
