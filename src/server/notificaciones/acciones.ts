"use server";

import { revalidatePath } from "next/cache";

import { registrar } from "@/lib/auditoria";
import { requerirUsuario } from "@/lib/auth";
import { consultar, consultarUna } from "@/lib/db";
import { esRol, usuarioTienePermiso } from "@/lib/rbac";

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

export type EstadoAviso =
  | { estado: "inicial" }
  | { estado: "ok"; enviados: number }
  | { estado: "no_permitido" | "vacio" | "sin_destinatarios" | "error" };

/**
 * Envía un aviso dentro del sistema a todo el personal, a quienes tienen un rol
 * o a los estudiantes. Sale en la campana de cada destinatario.
 *
 * Es de `operaciones.escribir` (coordinación): un aviso masivo no es para todo
 * el personal, y la pantalla lo repite en el servidor porque esconder el botón
 * no es control de acceso. Es solo aviso interno: no manda correo.
 */
export async function enviarAviso(
  _previo: EstadoAviso,
  datos: FormData,
): Promise<EstadoAviso> {
  const usuario = await requerirUsuario();

  if (!usuarioTienePermiso(usuario, "operaciones.escribir")) {
    return { estado: "no_permitido" };
  }

  const titulo = String(datos.get("titulo") ?? "").trim().slice(0, 120);
  const mensaje = String(datos.get("mensaje") ?? "").trim().slice(0, 500);
  const audiencia = String(datos.get("audiencia") ?? "personal");

  if (!titulo || !mensaje) return { estado: "vacio" };

  // `personal` = todos menos estudiantes; `rol:<rol>` = ese rol, y el estudiante
  // es un rol más. Un valor desconocido no manda a nadie.
  const rol = audiencia.startsWith("rol:") ? audiencia.slice(4) : null;

  if (audiencia !== "personal" && !(rol && esRol(rol))) return { estado: "vacio" };

  try {
    const filas = await consultar<{ id: string }>(
      `INSERT INTO notificacion (usuario_id, titulo, mensaje, tipo)
       SELECT u.id, $1, $2, 'info'
         FROM usuario u
         JOIN rol r ON r.id = u.rol_id
        WHERE u.activo
          AND u.id <> $3
          AND (($4::text IS NULL AND r.nombre <> 'estudiante') OR r.nombre = $4)
       RETURNING id`,
      [titulo, mensaje, usuario.id, rol],
    );

    if (filas.length === 0) return { estado: "sin_destinatarios" };

    await registrar({
      usuarioId: usuario.id,
      accion: "aviso.enviado",
      entidad: "notificacion",
      datos: { audiencia, destinatarios: filas.length, titulo },
    });

    revalidatePath("/[locale]", "layout");

    return { estado: "ok", enviados: filas.length };
  } catch (error) {
    console.error("[notificaciones] no se pudo enviar el aviso", error);

    return { estado: "error" };
  }
}
