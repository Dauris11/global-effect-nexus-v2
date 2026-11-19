import type { ParametrosModelo, RespuestaModelo } from "@/lib/gemini";
import { flujoGemini, hayClaveGemini, llamarGemini, modeloGemini } from "@/lib/gemini-cliente";
import { clienteGroq } from "@/lib/groq-cliente";
import { clienteOpenAI } from "@/lib/openai-cliente";

/**
 * La puerta única al modelo: elige el proveedor y el resto del sistema no sabe
 * cuál es. Las formas internas (mensajes, herramientas, respuestas) son las
 * mismas para todos, así que cambiar de proveedor es una variable de entorno.
 *
 * `IA_PROVEEDOR=openai|groq|gemini`. Sin ella, se usa el primero con clave
 * (OpenAI, Groq, Gemini).
 */

export type Proveedor = "openai" | "groq" | "gemini";

export function proveedorActivo(): Proveedor {
  const pedido = process.env.IA_PROVEEDOR?.trim().toLowerCase();

  if (pedido === "openai" || pedido === "groq" || pedido === "gemini") return pedido;

  if (clienteOpenAI.hayClave()) return "openai";
  if (clienteGroq.hayClave()) return "groq";

  return "gemini";
}

export function hayClaveIA(): boolean {
  switch (proveedorActivo()) {
    case "openai":
      return clienteOpenAI.hayClave();
    case "groq":
      return clienteGroq.hayClave();
    default:
      return hayClaveGemini();
  }
}

/** `vision`: el modelo que lee imágenes (solo Groq lo separa del de texto). */
export function modeloIA(solicitado?: string | null, opciones: { vision?: boolean } = {}): string {
  switch (proveedorActivo()) {
    case "openai":
      return clienteOpenAI.modelo(solicitado, opciones);
    case "groq":
      return clienteGroq.modelo(solicitado, opciones);
    default:
      return modeloGemini(solicitado);
  }
}

/** Qué archivos puede leer el proveedor activo (OCR). */
export function capacidadesIA(): { pdf: boolean; imagen: boolean } {
  switch (proveedorActivo()) {
    case "groq":
      return { pdf: clienteGroq.aceptaPdf, imagen: clienteGroq.aceptaImagen() };
    default:
      return { pdf: true, imagen: true };
  }
}

export const llamarModelo = (p: ParametrosModelo): Promise<RespuestaModelo> => {
  switch (proveedorActivo()) {
    case "openai":
      return clienteOpenAI.llamar(p);
    case "groq":
      return clienteGroq.llamar(p);
    default:
      return llamarGemini(p);
  }
};

export const flujoModelo = (p: ParametrosModelo) => {
  switch (proveedorActivo()) {
    case "openai":
      return clienteOpenAI.flujo(p);
    case "groq":
      return clienteGroq.flujo(p);
    default:
      return flujoGemini(p);
  }
};
