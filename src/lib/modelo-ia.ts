import type { ParametrosModelo, RespuestaModelo } from "@/lib/gemini";
import { flujoGemini, hayClaveGemini, llamarGemini, modeloGemini } from "@/lib/gemini-cliente";
import { flujoOpenAI, hayClaveOpenAI, llamarOpenAI, modeloOpenAI } from "@/lib/openai-cliente";

/**
 * La puerta única al modelo: elige el proveedor y el resto del sistema no sabe
 * cuál es. Las formas internas (mensajes, herramientas, respuestas) son las
 * mismas para los dos, así que cambiar de proveedor es una variable de entorno.
 *
 * `IA_PROVEEDOR=openai|gemini`. Sin ella, se usa el que tenga clave (OpenAI
 * primero).
 */

export type Proveedor = "openai" | "gemini";

export function proveedorActivo(): Proveedor {
  const pedido = process.env.IA_PROVEEDOR?.trim().toLowerCase();

  if (pedido === "openai" || pedido === "gemini") return pedido;

  return hayClaveOpenAI() || !hayClaveGemini() ? "openai" : "gemini";
}

export const hayClaveIA = () => (proveedorActivo() === "openai" ? hayClaveOpenAI() : hayClaveGemini());

export const modeloIA = (solicitado?: string | null) =>
  proveedorActivo() === "openai" ? modeloOpenAI(solicitado) : modeloGemini(solicitado);

export const llamarModelo = (p: ParametrosModelo): Promise<RespuestaModelo> =>
  proveedorActivo() === "openai" ? llamarOpenAI(p) : llamarGemini(p);

export const flujoModelo = (p: ParametrosModelo) =>
  proveedorActivo() === "openai" ? flujoOpenAI(p) : flujoGemini(p);
