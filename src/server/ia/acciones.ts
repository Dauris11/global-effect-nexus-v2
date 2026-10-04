"use server";

import { revalidatePath } from "next/cache";

import { requerirRol } from "@/lib/auth";
import {
  conversar,
  MAXIMO_CARACTERES_PREGUNTA,
  type EstadoChat,
} from "@/lib/ia";
import { tienePermiso } from "@/lib/rbac";
import { estudianteDeUsuario } from "@/server/estudiantes/portal";
import {
  asegurarConversacion,
  conversacionDelEstudiante,
  guardarMensaje,
  instruccionesPara,
  mensajesDeConversacion,
  preguntasEnLaUltimaHora,
  turnosDe,
} from "@/server/ia/estudiante";

/**
 * Pregunta del estudiante al asistente.
 *
 * Orden de las comprobaciones, que importa: primero el rol, después el permiso
 * `ia.usar`, después la ficha y solo al final el límite de uso. Así nadie
 * descubre cuánto le queda de cuota en un portal al que no debería entrar.
 *
 * La pregunta se guarda DESPUÉS de que el modelo responda, no antes: si la
 * llamada falla, la conversación queda como estaba y el estudiante puede
 * reintentar, en vez de arrastrar una pregunta sin respuesta en el historial.
 */

/** Preguntas por hora y por estudiante. Es un tope de gasto, no de abuso. */
const LIMITE_POR_HORA = 20;

/**
 * El estado vive en `@/lib/ia` y aquí solo se reexporta.
 *
 * Lo comparten los dos chats, y el componente que los dibuja necesita un solo
 * tipo (ver su cabecera allí). Se reexporta para no romper a quien ya lo
 * importaba desde aquí.
 */
export type { EstadoChat } from "@/lib/ia";

export async function preguntarAlAsistente(
  _previo: EstadoChat,
  datos: FormData,
): Promise<EstadoChat> {
  const usuario = await requerirRol(["estudiante"]);

  if (!tienePermiso(usuario.rol, "ia.usar")) return { estado: "sin_permiso" };

  const estudiante = await estudianteDeUsuario(usuario.id);
  if (!estudiante) return { estado: "sin_expediente" };

  const pregunta = String(datos.get("pregunta") ?? "").trim();

  if (!pregunta) return { estado: "vacia" };
  if (pregunta.length > MAXIMO_CARACTERES_PREGUNTA) return { estado: "larga" };

  if ((await preguntasEnLaUltimaHora(usuario.id)) >= LIMITE_POR_HORA) {
    return { estado: "limite" };
  }

  // El historial se lee antes de llamar al modelo y la pregunta nueva se añade
  // al final en memoria: es lo que el modelo necesita ver, sin haber escrito
  // todavía nada en la base.
  const conversacionPrevia = await conversacionDelEstudiante(usuario.id);
  const historial = conversacionPrevia
    ? await mensajesDeConversacion(conversacionPrevia, 20)
    : [];

  const instrucciones = await instruccionesPara(estudiante, usuario.idioma);
  const respuesta = await conversar(instrucciones, [
    ...turnosDe(historial),
    { rol: "user", contenido: pregunta },
  ]);

  if (respuesta.estado === "sin_clave") return { estado: "sin_clave" };
  if (respuesta.estado === "rechazada") return { estado: "rechazada" };
  if (respuesta.estado === "fallo") return { estado: "error" };

  const conversacionId =
    conversacionPrevia ??
    (await asegurarConversacion(usuario.id, tituloDe(pregunta)));

  if (!conversacionId) return { estado: "error" };

  await guardarMensaje(conversacionId, "user", pregunta);
  await guardarMensaje(
    conversacionId,
    "assistant",
    respuesta.texto,
    respuesta.tokens,
  );

  revalidatePath("/portal/estudiante/chat");

  return { estado: "ok" };
}

/** Título de la conversación: la primera pregunta, recortada. */
function tituloDe(pregunta: string): string {
  return pregunta.length <= 60 ? pregunta : `${pregunta.slice(0, 57)}...`;
}
