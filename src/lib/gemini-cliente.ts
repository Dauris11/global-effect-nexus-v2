import {
  acumular,
  acumuladoVacio,
  AnalizadorSse,
  clasificarErrorHttp,
  construirPeticion,
  ErrorModelo,
  respuestaDeAcumulado,
  respuestaDeJson,
  type ParametrosModelo,
  type RespuestaModelo,
} from "@/lib/gemini";

/**
 * Cliente de Gemini por REST con `fetch`, sin paquete.
 *
 * La clave va en la cabecera `x-goog-api-key` y nunca en la URL: las URL acaban
 * en registros de acceso. Pasar a un plan de pago es lo mismo con facturación
 * activada; no hay dos proveedores que mantener.
 */

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Modelo estable y barato, VERIFICADO en vivo con la clave del proyecto el
 * 19 nov 2026 (los Flash grandes daban 503 por alta demanda ese día). Para más
 * calidad se sube con `GEMINI_MODEL` (p. ej. `gemini-3.6-flash`) sin tocar código.
 */
export const MODELO_GEMINI_POR_DEFECTO = "gemini-3.1-flash-lite";

export const hayClaveGemini = () => Boolean(process.env.GEMINI_API_KEY?.trim());

/**
 * El modelo a usar. Un valor guardado que no sea de Gemini (un nombre viejo en
 * la configuración de un agente) se ignora: daría 404 en cada pregunta.
 */
export function modeloGemini(solicitado?: string | null): string {
  if (solicitado?.startsWith("gemini-")) return solicitado;

  return process.env.GEMINI_MODEL?.trim() || MODELO_GEMINI_POR_DEFECTO;
}

async function peticion(parametros: ParametrosModelo, flujo: boolean): Promise<Response> {
  const clave = process.env.GEMINI_API_KEY?.trim();

  if (!clave) throw new ErrorModelo("sin_clave", "Falta GEMINI_API_KEY");

  const operacion = flujo ? "streamGenerateContent?alt=sse" : "generateContent";

  const cuerpoPeticion = JSON.stringify(construirPeticion(parametros));

  // «Alta demanda» (503) y errores del servidor son pasajeros: dos reintentos
  // cortos antes de rendirse. El 429 NO se reintenta aquí (hay que esperar un
  // minuto) y un error de clave o de petición tampoco.
  for (let intento = 0; ; intento++) {
    const respuesta = await fetch(`${BASE}/${encodeURIComponent(parametros.model)}:${operacion}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": clave },
      body: cuerpoPeticion,
      signal: AbortSignal.timeout(flujo ? 60_000 : 45_000),
    });

    if (respuesta.ok) return respuesta;

    const cuerpo = (await respuesta.text().catch(() => "")).slice(0, 500);

    if ([500, 503, 504].includes(respuesta.status) && intento < 2) {
      await new Promise((r) => setTimeout(r, 1500 * (intento + 1)));
      continue;
    }

    throw new ErrorModelo(clasificarErrorHttp(respuesta.status, cuerpo), `Gemini ${respuesta.status}: ${cuerpo}`);
  }
}

/** Una llamada completa, sin flujo. Lanza `ErrorModelo` con el tipo de fallo. */
export async function llamarGemini(parametros: ParametrosModelo): Promise<RespuestaModelo> {
  return respuestaDeJson(await (await peticion(parametros, false)).json());
}

/** Una llamada con flujo: avisa del texto a medida que llega y entrega la respuesta final. */
export function flujoGemini(parametros: ParametrosModelo): {
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

      if (!lector) throw new ErrorModelo("fallo", "Gemini no devolvió flujo");

      const analizador = new AnalizadorSse();
      const decodificador = new TextDecoder();
      const estado = acumuladoVacio();

      const procesar = (trozos: unknown[]) => {
        for (const trozo of trozos) {
          const texto = acumular(estado, trozo);

          if (texto) aviso?.(texto);
        }
      };

      for (;;) {
        const { done, value } = await lector.read();

        if (done) break;

        procesar(analizador.push(decodificador.decode(value, { stream: true })));
      }

      procesar(analizador.fin());

      return respuestaDeAcumulado(estado);
    },
  };
}
