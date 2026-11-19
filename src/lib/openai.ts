/**
 * Traducción entre la forma interna del asistente y la API de Chat Completions
 * de OpenAI. Gemela de `gemini.ts` (que define las formas internas): puro, sin
 * red, para probarlo con `node --test` sin clave.
 *
 * Diferencias que importan frente a Gemini:
 *   · La respuesta de una herramienta es un mensaje propio `role: "tool"` que
 *     debe seguir INMEDIATAMENTE al mensaje del asistente con sus `tool_calls`.
 *   · Los argumentos de una llamada llegan como TEXTO JSON, y en el flujo
 *     llegan por trozos que hay que concatenar por `index` antes de parsear.
 *   · Los modelos nuevos exigen `max_completion_tokens` (no `max_tokens`).
 *   · Un 429 puede ser límite de frecuencia (esperar) o `insufficient_quota`
 *     (no hay saldo: esperar no sirve).
 */

import type {
  BloqueLlamada,
  BloqueTexto,
  MensajeModelo,
  ParametrosModelo,
  RespuestaModelo,
  TipoErrorModelo,
} from "@/lib/gemini";

type Mensaje = Record<string, unknown>;

function mensajesDe(p: ParametrosModelo): Mensaje[] {
  const salida: Mensaje[] = [];

  if (p.system) salida.push({ role: "system", content: p.system });

  for (const m of p.messages) salida.push(...mensajeDe(m));

  return salida;
}

function mensajeDe(m: MensajeModelo): Mensaje[] {
  if (typeof m.content === "string") return [{ role: m.role, content: m.content }];

  if (m.role === "assistant") {
    const texto = m.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    const llamadas = m.content.flatMap((b) =>
      b.type === "tool_use"
        ? [{ id: b.id, type: "function", function: { name: b.name, arguments: JSON.stringify(b.input) } }]
        : [],
    );

    return [{ role: "assistant", content: texto || null, ...(llamadas.length ? { tool_calls: llamadas } : {}) }];
  }

  // Turno del usuario: primero las respuestas de herramientas (cada una un
  // mensaje `tool`), después el contenido propio (texto, imagen, PDF).
  const salida: Mensaje[] = m.content.flatMap((b) =>
    b.type === "tool_result"
      ? [{ role: "tool", tool_call_id: b.tool_use_id, content: b.is_error ? `ERROR: ${b.content}` : b.content }]
      : [],
  );

  const partes = m.content.flatMap((b): Mensaje[] => {
    if (b.type === "text") return [{ type: "text", text: b.text }];
    if (b.type !== "archivo") return [];

    return b.mime === "application/pdf"
      ? [{ type: "file", file: { filename: "documento.pdf", file_data: `data:${b.mime};base64,${b.base64}` } }]
      : [{ type: "image_url", image_url: { url: `data:${b.mime};base64,${b.base64}` } }];
  });

  if (partes.length) salida.push({ role: "user", content: partes });

  return salida;
}

export function construirPeticionOpenAI(
  p: ParametrosModelo,
  flujo: boolean,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    ...extra,
    model: p.model,
    messages: mensajesDe(p),
    max_completion_tokens: p.max_tokens,
    ...(p.tools?.length
      ? {
          tools: p.tools.map((h) => ({
            type: "function",
            function: { name: h.name, description: h.description, parameters: h.input_schema },
          })),
          ...(p.forzar ? { tool_choice: { type: "function", function: { name: p.forzar } } } : {}),
        }
      : {}),
    ...(flujo ? { stream: true, stream_options: { include_usage: true } } : {}),
  };
}

// ── Respuesta ────────────────────────────────────────────────────────────────

type LlamadaAcumulada = { id: string; nombre: string; argumentos: string };

export type AcumuladoOpenAI = {
  texto: string;
  llamadas: Map<number, LlamadaAcumulada>;
  finish: string | null;
  rechazo: string | null;
  usage: { entrada: number; salida: number; cache: number };
};

export const acumuladoOpenAIVacio = (): AcumuladoOpenAI => ({
  texto: "",
  llamadas: new Map(),
  finish: null,
  rechazo: null,
  usage: { entrada: 0, salida: 0, cache: 0 },
});

type ChunkOpenAI = {
  choices?: {
    delta?: {
      content?: string | null;
      refusal?: string | null;
      tool_calls?: { index?: number; id?: string; function?: { name?: string; arguments?: string } }[];
    };
    message?: {
      content?: string | null;
      refusal?: string | null;
      tool_calls?: { id?: string; function?: { name?: string; arguments?: string } }[];
    };
    finish_reason?: string | null;
  }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } };
};

/** Suma un trozo (de flujo o respuesta completa) y devuelve el texto nuevo. */
export function acumularOpenAI(estado: AcumuladoOpenAI, trozo: unknown): string {
  const t = trozo as ChunkOpenAI;
  const eleccion = t.choices?.[0];
  let nuevo = "";

  if (eleccion) {
    if (eleccion.finish_reason) estado.finish = eleccion.finish_reason;

    // Flujo (`delta`) y respuesta completa (`message`) se tratan igual.
    const origen = eleccion.delta ?? eleccion.message;

    if (origen?.content) {
      nuevo = origen.content;
      estado.texto += origen.content;
    }
    if (origen?.refusal) estado.rechazo = (estado.rechazo ?? "") + origen.refusal;

    (origen?.tool_calls ?? []).forEach((l, i) => {
      const indice = "index" in l && typeof l.index === "number" ? l.index : i;
      const previa = estado.llamadas.get(indice) ?? { id: "", nombre: "", argumentos: "" };

      estado.llamadas.set(indice, {
        id: l.id ?? previa.id,
        nombre: l.function?.name ?? previa.nombre,
        argumentos: previa.argumentos + (l.function?.arguments ?? ""),
      });
    });
  }

  if (t.usage) {
    estado.usage = {
      entrada: t.usage.prompt_tokens ?? estado.usage.entrada,
      salida: t.usage.completion_tokens ?? estado.usage.salida,
      cache: t.usage.prompt_tokens_details?.cached_tokens ?? estado.usage.cache,
    };
  }

  return nuevo;
}

/** Argumentos de una llamada: JSON o, si llegó torcido, objeto vacío (la herramienta lo valida). */
function argumentosDe(texto: string): Record<string, unknown> {
  try {
    const v: unknown = JSON.parse(texto || "{}");

    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function respuestaDeAcumuladoOpenAI(estado: AcumuladoOpenAI): RespuestaModelo {
  const content: (BloqueTexto | BloqueLlamada)[] = [];

  if (estado.texto) content.push({ type: "text", text: estado.texto });

  [...estado.llamadas.entries()]
    .sort((a, b) => a[0] - b[0])
    .forEach(([indice, l]) => {
      if (l.nombre) {
        content.push({
          type: "tool_use",
          id: l.id || `llamada_${indice}`,
          name: l.nombre,
          input: argumentosDe(l.argumentos),
        });
      }
    });

  const hayLlamada = content.some((b) => b.type === "tool_use");

  return {
    content,
    stop_reason: hayLlamada
      ? "tool_use"
      : (estado.rechazo !== null || estado.finish === "content_filter") && content.length === 0
        ? "refusal"
        : estado.finish === "length"
          ? "max_tokens"
          : "end_turn",
    usage: {
      input_tokens: estado.usage.entrada,
      output_tokens: estado.usage.salida,
      cache_read_input_tokens: estado.usage.cache,
    },
  };
}

export function respuestaDeJsonOpenAI(cuerpo: unknown): RespuestaModelo {
  const estado = acumuladoOpenAIVacio();

  acumularOpenAI(estado, cuerpo);

  return respuestaDeAcumuladoOpenAI(estado);
}

/** Qué quiere decir un error HTTP de OpenAI para el resto del sistema. */
export function clasificarErrorOpenAI(estado: number, cuerpo: string): TipoErrorModelo {
  // Sin saldo: esperar no ayuda, hay que cargar crédito. Se trata como «no configurado».
  if (/insufficient_quota|billing_hard_limit|exceeded your current quota/i.test(cuerpo)) return "sin_clave";
  if (estado === 429) return "limite";
  if (estado === 401 || /invalid_api_key|Incorrect API key/i.test(cuerpo)) return "sin_clave";
  if (estado === 403) return "sin_clave";

  return "fallo";
}
