/**
 * Traducción entre la forma interna del asistente y la API REST de Gemini.
 *
 * Puro (sin red ni base): todo lo que puede romperse al hablar con el modelo
 * vive aquí para probarlo con `node --test` sin clave. El motor y los
 * clientes usan las formas «de mensajes» de abajo, y este archivo las convierte
 * a `generateContent` y de vuelta.
 *
 * Tres cosas que si se olvidan rompen la segunda vuelta de una herramienta:
 *
 *   1. **Las firmas de pensamiento (`thoughtSignature`).** Gemini 3 rechaza la
 *      petición siguiente si el `functionCall` que él mismo devolvió vuelve sin
 *      su firma. Por eso cada bloque guarda su `parte` cruda y, al reenviar el
 *      historial, se manda ESA parte tal cual, no una reconstruida.
 *   2. **Llamadas paralelas:** todas las `functionCall` en un mismo turno del
 *      modelo y todas las `functionResponse` en un solo turno siguiente.
 *   3. **El SSE llega partido:** un evento puede cortarse a mitad entre dos
 *      lecturas, así que se acumula en un búfer y solo se parsean eventos
 *      completos.
 */

// ── Formas internas (mismos nombres de campo que ya usaba el motor) ──────────

export type ParteGemini = Record<string, unknown>;

export type BloqueTexto = { type: "text"; text: string; parte?: ParteGemini };
export type BloqueLlamada = {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
  parte?: ParteGemini;
};
export type BloqueResultado = {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
};
export type BloqueDocumento = { type: "archivo"; mime: string; base64: string };

export type MensajeModelo = {
  role: "user" | "assistant";
  content: string | (BloqueTexto | BloqueLlamada | BloqueResultado | BloqueDocumento)[];
};

export type EsquemaHerramienta = {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
};

export type HerramientaModelo = {
  name: string;
  description: string;
  input_schema: EsquemaHerramienta;
};

export type ParametrosModelo = {
  model: string;
  max_tokens: number;
  system?: string;
  messages: MensajeModelo[];
  tools?: HerramientaModelo[];
  /** Obliga a llamar a esta herramienta (y solo a esa). */
  forzar?: string;
  /** Qué tipo de archivo trae el mensaje: solo se prueban proveedores que lo lean. */
  requiere?: "pdf" | "imagen";
};

export type RespuestaModelo = {
  content: (BloqueTexto | BloqueLlamada)[];
  stop_reason: "end_turn" | "tool_use" | "refusal" | "max_tokens";
  /** Modelo que de verdad respondió (con respaldo puede no ser el primero). */
  modelo?: string;
  usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number };
};

export type TipoErrorModelo = "limite" | "sin_clave" | "fallo";

export class ErrorModelo extends Error {
  // Campo explícito y no «parameter property»: Node, al ejecutar las pruebas,
  // quita los tipos sin compilar y no admite esa sintaxis.
  tipo: TipoErrorModelo;

  constructor(tipo: TipoErrorModelo, mensaje: string) {
    super(mensaje);
    this.tipo = tipo;
  }
}

// ── Esquemas de herramientas ─────────────────────────────────────────────────

/** Claves de JSON Schema que Gemini acepta en `parameters`; el resto da 400. */
const CLAVES_ESQUEMA = new Set([
  "type",
  "description",
  "enum",
  "properties",
  "required",
  "items",
  "format",
  "nullable",
  "minimum",
  "maximum",
  "minItems",
  "maxItems",
]);

/**
 * Quita de un esquema lo que Gemini no entiende (`additionalProperties`,
 * `$schema`, `default`, `examples`…). Un solo sitio y no editar cada
 * herramienta: las definiciones siguen escritas en JSON Schema normal.
 */
export function esquemaGemini(esquema: unknown): unknown {
  if (Array.isArray(esquema)) return esquema.map(esquemaGemini);
  if (!esquema || typeof esquema !== "object") return esquema;

  const salida: Record<string, unknown> = {};

  for (const [clave, valor] of Object.entries(esquema as Record<string, unknown>)) {
    if (clave === "properties" && valor && typeof valor === "object") {
      // Los nombres de propiedad son datos, no palabras clave: no se filtran.
      salida.properties = Object.fromEntries(
        Object.entries(valor as Record<string, unknown>).map(([n, v]) => [n, esquemaGemini(v)]),
      );
    } else if (CLAVES_ESQUEMA.has(clave)) {
      salida[clave] = esquemaGemini(valor);
    }
  }

  // `type: ["string", "null"]` → `type: "string", nullable: true`
  if (Array.isArray(salida.type)) {
    const tipos = salida.type.filter((t) => t !== "null");

    salida.nullable = salida.type.includes("null") || undefined;
    salida.type = tipos[0] ?? "string";
  }

  return salida;
}

// ── Petición ─────────────────────────────────────────────────────────────────

/** `id` → `{ nombre, conId }` de las llamadas que el modelo hizo antes. */
function llamadasPrevias(mensajes: readonly MensajeModelo[]) {
  const mapa = new Map<string, { nombre: string; conId: boolean }>();

  for (const m of mensajes) {
    if (!Array.isArray(m.content)) continue;

    for (const b of m.content) {
      if (b.type === "tool_use") {
        const llamada = b.parte?.functionCall as { id?: unknown } | undefined;

        mapa.set(b.id, { nombre: b.name, conId: typeof llamada?.id === "string" });
      }
    }
  }

  return mapa;
}

function partesDe(mensaje: MensajeModelo, previas: ReturnType<typeof llamadasPrevias>): ParteGemini[] {
  if (typeof mensaje.content === "string") return [{ text: mensaje.content }];

  const partes: ParteGemini[] = [];

  for (const b of mensaje.content) {
    if (b.type === "text") {
      // La parte cruda, si existe: lleva la firma si Gemini la puso.
      partes.push(b.parte ?? { text: b.text });
    } else if (b.type === "tool_use") {
      partes.push(b.parte ?? { functionCall: { name: b.name, args: b.input } });
    } else if (b.type === "tool_result") {
      const previa = previas.get(b.tool_use_id);

      partes.push({
        functionResponse: {
          name: previa?.nombre ?? b.tool_use_id,
          ...(previa?.conId ? { id: b.tool_use_id } : {}),
          response: b.is_error ? { error: b.content } : { result: b.content },
        },
      });
    } else {
      partes.push({ inlineData: { mimeType: b.mime, data: b.base64 } });
    }
  }

  return partes;
}

export function construirPeticion(p: ParametrosModelo): Record<string, unknown> {
  const previas = llamadasPrevias(p.messages);

  return {
    ...(p.system ? { systemInstruction: { parts: [{ text: p.system }] } } : {}),
    contents: p.messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: partesDe(m, previas),
    })),
    ...(p.tools?.length
      ? {
          tools: [
            {
              functionDeclarations: p.tools.map((h) => ({
                name: h.name,
                description: h.description,
                parameters: esquemaGemini(h.input_schema),
              })),
            },
          ],
          ...(p.forzar
            ? {
                toolConfig: {
                  functionCallingConfig: { mode: "ANY", allowedFunctionNames: [p.forzar] },
                },
              }
            : {}),
        }
      : {}),
    // Sin `thinkingConfig` a propósito: su sintaxis cambia por modelo y una
    // equivocada devuelve 400.
    generationConfig: { maxOutputTokens: p.max_tokens },
  };
}

// ── Respuesta ────────────────────────────────────────────────────────────────

const BLOQUEOS = new Set(["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION", "IMAGE_SAFETY"]);

/** Lo que va quedando de una respuesta mientras llegan los trozos del flujo. */
export type Acumulado = {
  partes: ParteGemini[];
  finishReason: string | null;
  bloqueo: string | null;
  usage: { prompt: number; candidatos: number; pensamiento: number; cache: number };
};

export const acumuladoVacio = (): Acumulado => ({
  partes: [],
  finishReason: null,
  bloqueo: null,
  usage: { prompt: 0, candidatos: 0, pensamiento: 0, cache: 0 },
});

type ChunkGemini = {
  candidates?: { content?: { parts?: ParteGemini[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
    cachedContentTokenCount?: number;
  };
};

/** Suma un trozo de respuesta al acumulado y devuelve el texto nuevo que traía. */
export function acumular(estado: Acumulado, trozo: unknown): string {
  const t = trozo as ChunkGemini;
  let nuevo = "";

  if (t.promptFeedback?.blockReason) estado.bloqueo = t.promptFeedback.blockReason;

  const candidato = t.candidates?.[0];

  if (candidato?.finishReason) estado.finishReason = candidato.finishReason;

  for (const parte of candidato?.content?.parts ?? []) {
    // Un pensamiento resumido no es respuesta ni se muestra.
    if (parte.thought === true) continue;

    if (typeof parte.text === "string") {
      nuevo += parte.text;

      const ultima = estado.partes.at(-1);

      // Trozos de texto seguidos se funden en uno; si alguno trae firma, se conserva.
      if (ultima && typeof ultima.text === "string" && !ultima.functionCall) {
        ultima.text += parte.text;
        if (parte.thoughtSignature) ultima.thoughtSignature = parte.thoughtSignature;
        continue;
      }
    }

    estado.partes.push({ ...parte });
  }

  const u = t.usageMetadata;

  if (u) {
    estado.usage = {
      prompt: u.promptTokenCount ?? estado.usage.prompt,
      candidatos: u.candidatesTokenCount ?? estado.usage.candidatos,
      pensamiento: u.thoughtsTokenCount ?? estado.usage.pensamiento,
      cache: u.cachedContentTokenCount ?? estado.usage.cache,
    };
  }

  return nuevo;
}

/** Del acumulado a la forma interna. Un bloqueo sin contenido es `refusal`. */
export function respuestaDeAcumulado(estado: Acumulado): RespuestaModelo {
  const content: (BloqueTexto | BloqueLlamada)[] = [];
  let n = 0;

  for (const parte of estado.partes) {
    const llamada = parte.functionCall as { id?: string; name?: string; args?: Record<string, unknown> } | undefined;

    if (llamada?.name) {
      content.push({
        type: "tool_use",
        id: typeof llamada.id === "string" ? llamada.id : `llamada_${n++}`,
        name: llamada.name,
        input: llamada.args ?? {},
        parte,
      });
    } else if (typeof parte.text === "string") {
      content.push({ type: "text", text: parte.text, parte });
    }
  }

  const bloqueada =
    estado.bloqueo !== null || (estado.finishReason !== null && BLOQUEOS.has(estado.finishReason));

  const stop_reason: RespuestaModelo["stop_reason"] = content.some((b) => b.type === "tool_use")
    ? "tool_use"
    : bloqueada && content.length === 0
      ? "refusal"
      : estado.finishReason === "MAX_TOKENS"
        ? "max_tokens"
        : "end_turn";

  return {
    content,
    stop_reason,
    usage: {
      input_tokens: estado.usage.prompt,
      // Los tokens de pensamiento se cobran y cuentan como salida.
      output_tokens: estado.usage.candidatos + estado.usage.pensamiento,
      cache_read_input_tokens: estado.usage.cache,
    },
  };
}

/** Respuesta completa (sin flujo) a la forma interna. */
export function respuestaDeJson(cuerpo: unknown): RespuestaModelo {
  const estado = acumuladoVacio();

  acumular(estado, cuerpo);

  return respuestaDeAcumulado(estado);
}

// ── Flujo SSE ────────────────────────────────────────────────────────────────

/**
 * Separa eventos `data: {...}` de un flujo que llega en trozos arbitrarios.
 * Devuelve los objetos completos de cada `push`; lo incompleto se guarda.
 */
export class AnalizadorSse {
  private bufer = "";

  push(trozo: string): unknown[] {
    this.bufer += trozo;

    const eventos = this.bufer.split(/\r?\n\r?\n/);

    this.bufer = eventos.pop() ?? "";

    return eventos.flatMap((evento) => this.datos(evento));
  }

  /** Al terminar el flujo puede quedar un último evento sin línea en blanco. */
  fin(): unknown[] {
    const resto = this.bufer;

    this.bufer = "";

    return resto.trim() ? this.datos(resto) : [];
  }

  private datos(evento: string): unknown[] {
    const texto = evento
      .split(/\r?\n/)
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trimStart())
      .join("\n");

    if (!texto || texto === "[DONE]") return [];

    try {
      return [JSON.parse(texto)];
    } catch {
      return [];
    }
  }
}

// ── Errores ──────────────────────────────────────────────────────────────────

/** Qué quiere decir un estado HTTP de Gemini para el resto del sistema. */
export function clasificarErrorHttp(estado: number, cuerpo: string): TipoErrorModelo {
  if (estado === 429) return "limite";
  if (/API key not valid|API_KEY_INVALID|API key expired|API_KEY_/i.test(cuerpo)) return "sin_clave";
  if (estado === 401 || estado === 403) return "sin_clave";

  return "fallo";
}
