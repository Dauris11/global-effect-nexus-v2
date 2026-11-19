/**
 * Respaldo entre proveedores del modelo: si el primero falla, se prueba el
 * siguiente. Puro (sin red) para poder probarlo con proveedores falsos.
 *
 * Dos reglas que importan:
 *   · Cualquier error pasa al siguiente (límite de frecuencia, sin saldo, caída,
 *     una llamada a herramienta mal formada…). El último error es el que sale.
 *   · En un flujo, si ya se mostró texto a la persona NO se cambia de proveedor a
 *     mitad: no se puede «desescribir» lo ya enviado y se mezclarían dos voces.
 */

export async function conRespaldo<P, T>(
  cadena: readonly P[],
  intentar: (proveedor: P) => Promise<T>,
  alFallar?: (proveedor: P, error: unknown, siguiente: P) => void,
): Promise<T> {
  if (cadena.length === 0) throw new Error("No hay proveedor de IA configurado");

  let ultimo: unknown;

  for (const [i, proveedor] of cadena.entries()) {
    try {
      return await intentar(proveedor);
    } catch (error) {
      ultimo = error;

      const siguiente = cadena[i + 1];

      if (siguiente !== undefined) alFallar?.(proveedor, error, siguiente);
    }
  }

  throw ultimo;
}

export function flujoConRespaldo<P, R>(
  cadena: readonly P[],
  crear: (proveedor: P) => { alTexto: (aviso: (texto: string) => void) => void; final: () => Promise<R> },
  alFallar?: (proveedor: P, error: unknown, siguiente: P) => void,
): { alTexto: (aviso: (texto: string) => void) => void; final: () => Promise<R> } {
  let aviso: ((texto: string) => void) | null = null;

  return {
    alTexto: (f) => {
      aviso = f;
    },
    async final() {
      if (cadena.length === 0) throw new Error("No hay proveedor de IA configurado");

      let ultimo: unknown;

      for (const [i, proveedor] of cadena.entries()) {
        const flujo = crear(proveedor);
        let emitidos = 0;

        flujo.alTexto((texto) => {
          emitidos += texto.length;
          aviso?.(texto);
        });

        try {
          return await flujo.final();
        } catch (error) {
          ultimo = error;

          const siguiente = cadena[i + 1];

          if (emitidos > 0 || siguiente === undefined) throw error;

          alFallar?.(proveedor, error, siguiente);
        }
      }

      throw ultimo;
    },
  };
}
