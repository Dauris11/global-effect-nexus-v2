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
 * Cliente de Chat Completions por REST con `fetch`, sin paquete. Sirve para
 * OpenAI y para cualquier proveedor con la misma API (Groq): `crearClienteChat`
 * recibe la dirección, la variable de la clave y el modelo. Misma forma que
 * `gemini-cliente.ts`; los llama `modelo-ia.ts`.
 *
 * La clave va en la cabecera `Authorization` y nunca en la URL ni en un registro.
 * OpenAI no usa por defecto lo enviado por API para entrenar sus modelos, a
 * diferencia de la capa gratuita de Gemini; aun así, es un tercero.
 */

export type ConfigProveedorChat = {
  nombre: string;
  url: string;
  claveEnv: string;
  modeloEnv: string;
  modeloDefecto: string;
  /** Modelo para leer imágenes (OCR). Sin él, el proveedor no lee imágenes. */
  modeloVisionEnv?: string;
  /** ¿Un modelo guardado en la configuración de un agente es de este proveedor? */
  esDeEsteProveedor: (modelo: string) => boolean;
  /** Admite PDF como parte del mensaje (`file`). */
  aceptaPdf: boolean;
  /** Parámetros propios de ciertos modelos (p. ej. esfuerzo de razonamiento). */
  extraPorModelo?: (modelo: string) => Record<string, unknown>;
};

export function crearClienteChat(c: ConfigProveedorChat) {
  const hayClave = () => Boolean(process.env[c.claveEnv]?.trim());

  /** Un modelo guardado de otro proveedor se ignora: daría 404 en cada pregunta. */
  function modelo(solicitado?: string | null, opciones: { vision?: boolean } = {}): string {
    if (opciones.vision && c.modeloVisionEnv) {
      return process.env[c.modeloVisionEnv]?.trim() || c.modeloDefecto;
    }

    if (solicitado && c.esDeEsteProveedor(solicitado)) return solicitado;

    return process.env[c.modeloEnv]?.trim() || c.modeloDefecto;
  }

  async function peticion(parametros: ParametrosModelo, flujo: boolean): Promise<Response> {
    const clave = process.env[c.claveEnv]?.trim();

    if (!clave) throw new ErrorModelo("sin_clave", `Falta ${c.claveEnv}`);

    const cuerpoPeticion = JSON.stringify(
      construirPeticionOpenAI(parametros, flujo, c.extraPorModelo?.(parametros.model)),
    );

    // 500/502/503/504 son pasajeros: dos reintentos cortos. El 429 y los errores
    // de clave o de petición no se reintentan.
    for (let intento = 0; ; intento++) {
      const respuesta = await fetch(c.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${clave}` },
        body: cuerpoPeticion,
        signal: AbortSignal.timeout(flujo ? 60_000 : 45_000),
      });

      if (respuesta.ok) return respuesta;

      const texto = (await respuesta.text().catch(() => "")).slice(0, 500);

      if ([500, 502, 503, 504].includes(respuesta.status) && intento < 2) {
        await new Promise((r) => setTimeout(r, 1500 * (intento + 1)));
        continue;
      }

      throw new ErrorModelo(clasificarErrorOpenAI(respuesta.status, texto), `${c.nombre} ${respuesta.status}: ${texto}`);
    }
  }

  async function llamar(parametros: ParametrosModelo): Promise<RespuestaModelo> {
    return respuestaDeJsonOpenAI(await (await peticion(parametros, false)).json());
  }

  function flujo(parametros: ParametrosModelo): {
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

        if (!lector) throw new ErrorModelo("fallo", `${c.nombre} no devolvió flujo`);

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

  return {
    hayClave,
    modelo,
    llamar,
    flujo,
    aceptaPdf: c.aceptaPdf,
    aceptaImagen: () => (c.modeloVisionEnv ? Boolean(process.env[c.modeloVisionEnv]?.trim()) : true),
  };
}

/** Barato, sin parámetros de razonamiento y con visión y PDF. Se cambia con `OPENAI_MODEL`. */
export const MODELO_OPENAI_POR_DEFECTO = "gpt-4o-mini";

export const clienteOpenAI = crearClienteChat({
  nombre: "OpenAI",
  url: "https://api.openai.com/v1/chat/completions",
  claveEnv: "OPENAI_API_KEY",
  modeloEnv: "OPENAI_MODEL",
  modeloDefecto: MODELO_OPENAI_POR_DEFECTO,
  esDeEsteProveedor: (m) => /^(gpt-|o\d|chatgpt-)/.test(m),
  aceptaPdf: true,
});

export const hayClaveOpenAI = clienteOpenAI.hayClave;
export const modeloOpenAI = clienteOpenAI.modelo;
export const llamarOpenAI = clienteOpenAI.llamar;
export const flujoOpenAI = clienteOpenAI.flujo;
