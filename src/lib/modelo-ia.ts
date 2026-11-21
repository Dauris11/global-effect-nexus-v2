import { ErrorModelo, type ParametrosModelo, type RespuestaModelo } from "@/lib/gemini";
import { flujoGemini, hayClaveGemini, llamarGemini, modeloGemini } from "@/lib/gemini-cliente";
import { clienteGroq } from "@/lib/groq-cliente";
import { clienteOpenAI } from "@/lib/openai-cliente";
import { conRespaldo, flujoConRespaldo } from "@/lib/respaldo";

/**
 * La puerta única al modelo: elige el proveedor y el resto del sistema no sabe
 * cuál es. Las formas internas (mensajes, herramientas, respuestas) son las
 * mismas para todos, así que cambiar de proveedor es una variable de entorno.
 *
 * `IA_PROVEEDOR` es una LISTA ORDENADA: `groq,openai` usa Groq y, si falla
 * (límite, sin saldo, caída, una llamada a herramienta mal formada), prueba con
 * OpenAI. Los que no tengan clave se saltan. Sin la variable, se usa el primero
 * con clave (OpenAI, Groq, Gemini).
 */

export type Proveedor = "openai" | "groq" | "gemini";

const VALIDOS: readonly Proveedor[] = ["groq", "gemini", "openai"];

const hayClave = (p: Proveedor) =>
  p === "openai" ? clienteOpenAI.hayClave() : p === "groq" ? clienteGroq.hayClave() : hayClaveGemini();

/** Proveedores a probar, en orden, solo los que tienen clave. */
export function cadenaIA(): Proveedor[] {
  const pedidos = (process.env.IA_PROVEEDOR ?? "")
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter((p): p is Proveedor => (VALIDOS as readonly string[]).includes(p));

  const lista = pedidos.length > 0 ? [...new Set(pedidos)] : (["openai", "groq", "gemini"] as Proveedor[]);

  return lista.filter(hayClave);
}

/** El primero de la cadena (o el primero pedido si ninguno tiene clave). */
export function proveedorActivo(): Proveedor {
  return cadenaIA()[0] ?? "gemini";
}

export const hayClaveIA = () => cadenaIA().length > 0;

function modeloDe(p: Proveedor, solicitado?: string | null, opciones: { vision?: boolean } = {}): string {
  return p === "openai"
    ? clienteOpenAI.modelo(solicitado, opciones)
    : p === "groq"
      ? clienteGroq.modelo(solicitado, opciones)
      : modeloGemini(solicitado);
}

/** Modelo del primer proveedor de la cadena. `vision`: el que lee imágenes (solo Groq lo separa). */
export const modeloIA = (solicitado?: string | null, opciones: { vision?: boolean } = {}) =>
  modeloDe(proveedorActivo(), solicitado, opciones);

function admite(p: Proveedor, requiere?: "pdf" | "imagen"): boolean {
  if (p !== "groq" || !requiere) return true;

  return requiere === "pdf" ? clienteGroq.aceptaPdf : clienteGroq.aceptaImagen();
}

/** Qué archivos puede leer alguno de los proveedores de la cadena (OCR). */
export function capacidadesIA(): { pdf: boolean; imagen: boolean } {
  const cadena = cadenaIA();

  return {
    pdf: cadena.some((p) => admite(p, "pdf")),
    imagen: cadena.some((p) => admite(p, "imagen")),
  };
}

function alFallar(de: Proveedor, error: unknown, a: Proveedor) {
  const tipo = error instanceof ErrorModelo ? error.tipo : "fallo";

  console.warn(`[ia] ${de} falló (${tipo}); se prueba ${a}`);
}

/** Cadena de esta petición: los que tienen clave y saben leer lo que trae. */
function candidatos(p: ParametrosModelo): Proveedor[] {
  const base = cadenaIA().filter((pr) => admite(pr, p.requiere));

  if (!p.requiere) return base;

  // Leer un PDF o una foto (OCR) no puede quedarse sin respaldo porque el único
  // proveedor de la cadena que ve documentos se quedó sin saldo: se añaden al final
  // los demás con clave que sí lo leen. Pasó con OpenAI sin créditos y Groq (que no
  // lee PDF) delante, y Gemini con clave sin usarse.
  const extra = VALIDOS.filter((pr) => !base.includes(pr) && hayClave(pr) && admite(pr, p.requiere));

  return [...base, ...extra];
}

/** El modelo de cada proveedor sale de SU configuración: el pedido solo vale si es suyo. */
function paraProveedor(p: ParametrosModelo, pr: Proveedor): ParametrosModelo {
  return { ...p, model: modeloDe(pr, p.model, { vision: p.requiere === "imagen" }) };
}

export function llamarModelo(p: ParametrosModelo): Promise<RespuestaModelo> {
  return conRespaldo(
    candidatos(p),
    async (pr) => {
      const q = paraProveedor(p, pr);
      const r =
        pr === "openai" ? await clienteOpenAI.llamar(q) : pr === "groq" ? await clienteGroq.llamar(q) : await llamarGemini(q);

      return { ...r, modelo: q.model };
    },
    alFallar,
  );
}

export function flujoModelo(p: ParametrosModelo) {
  return flujoConRespaldo(
    candidatos(p),
    (pr) => {
      const q = paraProveedor(p, pr);
      const f = pr === "openai" ? clienteOpenAI.flujo(q) : pr === "groq" ? clienteGroq.flujo(q) : flujoGemini(q);

      return { alTexto: f.alTexto, final: () => f.final().then((r) => ({ ...r, modelo: q.model })) };
    },
    alFallar,
  );
}
