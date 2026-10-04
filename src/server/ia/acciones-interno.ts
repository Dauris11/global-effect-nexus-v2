"use server";

import { revalidatePath } from "next/cache";

import { requerirUsuario } from "@/lib/auth";
import {
  conversar,
  MAXIMO_CARACTERES_PREGUNTA,
  type EstadoChat,
} from "@/lib/ia";
import { tienePermiso } from "@/lib/rbac";
import {
  asegurarConversacionInterna,
  conversacionInterna,
  guardarMensajeInterno,
  instruccionesInternas,
  mensajesInternos,
  preguntasInternasEnLaUltimaHora,
  turnosInternos,
} from "@/server/ia/interno";

/**
 * Pregunta del equipo al asistente interno.
 *
 * Va en su propio archivo y no junto a la del estudiante porque las dos son
 * `"use server"` y cada una cierra una puerta distinta: aquella exige el rol
 * `estudiante` y esta el permiso `ia.usar`, que tienen coordinación,
 * administración total y el propio estudiante. Mezclarlas
 * obligaría a que un solo archivo supiera de los dos mundos.
 *
 * Orden de las comprobaciones, que importa: primero la sesión, después el
 * permiso y solo al final el límite de uso. Así nadie descubre cuánto le queda
 * de cuota en un asistente que no debería poder usar.
 *
 * La pregunta se guarda DESPUÉS de que el modelo responda. Si la llamada falla,
 * la conversación queda como estaba y se puede reintentar, en vez de arrastrar
 * una pregunta sin respuesta en el historial.
 */

/** Preguntas por hora y por cuenta. Es un tope de gasto, no de abuso. */
const LIMITE_POR_HORA = 30;

export async function preguntarAlAsistenteInterno(
  _previo: EstadoChat,
  datos: FormData,
): Promise<EstadoChat> {
  const usuario = await requerirUsuario();

  if (!tienePermiso(usuario.rol, "ia.usar")) return { estado: "sin_permiso" };

  const pregunta = String(datos.get("pregunta") ?? "").trim();

  if (!pregunta) return { estado: "vacia" };
  if (pregunta.length > MAXIMO_CARACTERES_PREGUNTA) return { estado: "larga" };

  if ((await preguntasInternasEnLaUltimaHora(usuario.id)) >= LIMITE_POR_HORA) {
    return { estado: "limite" };
  }

  // El historial se lee antes de llamar al modelo y la pregunta nueva se añade
  // al final en memoria: es lo que el modelo necesita ver, sin haber escrito
  // todavía nada en la base.
  const previa = await conversacionInterna(usuario.id);
  const historial = previa ? await mensajesInternos(previa, 20) : [];

  // El contexto se arma con los permisos de ESTA cuenta: ver la cabecera de
  // `@/server/ia/interno`, regla 1.
  const instrucciones = await instruccionesInternas(usuario, usuario.idioma);

  const respuesta = await conversar(instrucciones, [
    ...turnosInternos(historial),
    { rol: "user", contenido: pregunta },
  ]);

  if (respuesta.estado === "sin_clave") return { estado: "sin_clave" };
  if (respuesta.estado === "rechazada") return { estado: "rechazada" };
  if (respuesta.estado === "fallo") return { estado: "error" };

  const conversacionId =
    previa ?? (await asegurarConversacionInterna(usuario.id, tituloDe(pregunta)));

  if (!conversacionId) return { estado: "error" };

  await guardarMensajeInterno(conversacionId, "user", pregunta);
  await guardarMensajeInterno(
    conversacionId,
    "assistant",
    respuesta.texto,
    respuesta.tokens,
  );

  revalidatePath("/[locale]/chat-ia", "page");

  return { estado: "ok" };
}

/** Título de la conversación: la primera pregunta, recortada. */
function tituloDe(pregunta: string): string {
  return pregunta.length <= 60 ? pregunta : `${pregunta.slice(0, 57)}...`;
}
