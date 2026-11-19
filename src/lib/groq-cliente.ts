import { crearClienteChat } from "@/lib/openai-cliente";

/**
 * Groq: la misma API que OpenAI (Chat Completions) con otra dirección, otra
 * clave y modelos abiertos (Llama, gpt-oss). Tiene un plan gratuito; los límites
 * y el uso de los datos se consultan en la consola de Groq, no se suponen aquí.
 *
 * Dos limitaciones propias:
 *   · **No lee PDF** como parte del mensaje.
 *   · **Las imágenes solo con un modelo de visión**, que hay que indicar en
 *     `GROQ_MODEL_VISION`; sin él, el OCR de imágenes no está disponible.
 * El resto (chat con herramientas, cartas) funciona con el modelo de texto.
 */

/**
 * Modelo con llamadas a herramientas, VERIFICADO en vivo con la cuenta del
 * proyecto el 19 nov 2026 (`llama-3.3-70b-versatile` ya no existía allí: 404).
 * Se cambia con `GROQ_MODEL`; los disponibles se listan con
 * `GET https://api.groq.com/openai/v1/models`.
 */
export const MODELO_GROQ_POR_DEFECTO = "openai/gpt-oss-120b";

export const clienteGroq = crearClienteChat({
  nombre: "Groq",
  url: "https://api.groq.com/openai/v1/chat/completions",
  claveEnv: "GROQ_API_KEY",
  modeloEnv: "GROQ_MODEL",
  modeloDefecto: MODELO_GROQ_POR_DEFECTO,
  modeloVisionEnv: "GROQ_MODEL_VISION",
  esDeEsteProveedor: (m) => /^(llama|meta-llama\/|openai\/gpt-oss|qwen\/|moonshotai\/|gemma)/.test(m),
  aceptaPdf: false,
  // Los gpt-oss razonan, y ese razonamiento gasta el mismo presupuesto de salida
  // que la respuesta: en «low» queda sitio para el JSON del OCR y de las cartas.
  extraPorModelo: (m) => (m.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {}),
});
