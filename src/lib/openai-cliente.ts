import { ErrorModelo, AnalizadorSse, type ParametrosModelo, type RespuestaModelo } from "@/lib/gemini";
import {
  acumularOpenAI,
  acumuladoOpenAIVacio,
  clasificarErrorOpenAI,
  construirPeticionOpenAI,
  respuestaDeAcumuladoOpenAI,
  respuestaDeJsonOpenAI,
} from "@/lib/openai";

/**
 * Cliente de OpenAI (Chat Completions) por REST con `fetch`, sin paquete. Misma
 * forma que `gemini-cliente.ts`; los llama `modelo-ia.ts`.
 *
 * La clave va en la cabecera `Authorization` y nunca en la URL ni en un registro.
 * OpenAI no usa por defecto lo enviado por API para entrenar sus modelos, a
 * diferencia de la capa gratuita de Gemini; aun así, es un tercero.
 */

const URL_CHAT = "https://api.openai.com/v1/chat/completions";

/** Barato, sin parámetros de razonamiento y con visión y PDF. Se cambia con `OPENAI_MODEL`. */
export const MODELO_OPENAI_POR_DEFECTO = "gpt-4o-mini";

export const hayClaveOpenAI = () => Boolean(process.env.OPENAI_API_KEY?.trim());

/** Un modelo guardado que no sea de OpenAI (p. ej. de Gemini) se ignora: daría 404. */
export function modeloOpenAI(solicitado?: string | null): string {
  if (solicitado && /^(gpt-|o\d|chatgpt-)/.test(solicitado)) return solicitado;

  return process.env.OPENAI_MODEL?.trim() || MODELO_OPENAI_POR_DEFECTO;
}

async function peticion(parametros: ParametrosModelo, flujo: boolean): Promise<Response> {
  const clave = process.env.OPENAI_API_KEY?.trim();

  if (!clave) throw new ErrorModelo("sin_clave", "Falta OPENAI_API_KEY");

  const cuerpoPeticion = JSON.stringify(construirPeticionOpenAI(parametros, flujo));

  // 500/502/503/504 son pasajeros: dos reintentos cortos. El 429 y los errores
  // de clave o de petición no se reintentan.
  for (let intento = 0; ; intento++) {
    const respuesta = await fetch(URL_CHAT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${clave}` },
      body: cuerpoPeticion,
      signal: AbortSignal.timeout(flujo ? 60_000 : 45_000),
    });

    if (respuesta.ok) return respuesta;

    const cuerpo = (await respuesta.text().catch(() => "")).slice(0, 500);

    if ([500, 502, 503, 504].includes(respuesta.status) && intento < 2) {
      await new Promise((r) => setTimeout(r, 1500 * (intento + 1)));
      continue;
    }

    throw new ErrorModelo(clasificarErrorOpenAI(respuesta.status, cuerpo), `OpenAI ${respuesta.status}: ${cuerpo}`);
  }
}

export async function llamarOpenAI(parametros: ParametrosModelo): Promise<RespuestaModelo> {
  return respuestaDeJsonOpenAI(await (await peticion(parametros, false)).json());
}

export function flujoOpenAI(parametros: ParametrosModelo): {
  alTexto: (aviso: (texto: string) => void) => void;
  final: () => Promise<RespuestaModelo>;
} {
  let aviso: ((texto: string) => void) | null = null;

  return {
    alTexto: (f) => {
      aviso = f;
    },
    async final() {
      const respuesta = await peticion(parametros, true);
      const lector = respuesta.body?.getReader();

      if (!lector) throw new ErrorModelo("fallo", "OpenAI no devolvió flujo");

      const analizador = new AnalizadorSse();
      const decodificador = new TextDecoder();
      const estado = acumuladoOpenAIVacio();

      const procesar = (trozos: unknown[]) => {
        for (const trozo of trozos) {
          const texto = acumularOpenAI(estado, trozo);

          if (texto) aviso?.(texto);
        }
      };

      for (;;) {
        const { done, value } = await lector.read();

        if (done) break;

        procesar(analizador.push(decodificador.decode(value, { stream: true })));
      }

      procesar(analizador.fin());

      return respuestaDeAcumuladoOpenAI(estado);
    },
  };
}
