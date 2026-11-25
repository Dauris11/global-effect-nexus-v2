import { getLocale, getTranslations } from "next-intl/server";

import { definicionDe, textoEn } from "@/lib/contabilidad/codigos-transaccion";
import { ErrorCodigosTransaccion } from "@/server/contabilidad/codigos-transaccion/asiento";
import { estadoDeError } from "@/server/contabilidad/sesion";

/**
 * Errores de los procesos de operaciones (inventario, activos fijos,
 * calculadoras) listos para mostrar.
 *
 * POR QUÉ no se lanzan tal cual al cliente: en producción Next oculta el
 * mensaje de un `throw` dentro de una acción de servidor, así que «código sin
 * cuenta» nunca llegaba a la pantalla. Las acciones atrapan aquí y devuelven
 * `{ ok: false, error }` con el texto ya traducido al idioma de la petición.
 */

export type ClaveErrorOperacion =
  | "cantidad_invalida"
  | "costo_negativo"
  | "articulo_no_encontrado"
  | "stock_insuficiente"
  | "conteo_no_encontrado"
  | "conteo_no_aplicable"
  | "depreciacion_ya_ejecutada"
  | "sin_activos_depreciables"
  | "depreciacion_misma_cuenta"
  | "calculo_invalido"
  | "calculo_descuadrado";

/** Error propio de una regla del proceso; `params` rellena los huecos del texto. */
export class ErrorOperacion extends Error {
  constructor(
    public readonly clave: ClaveErrorOperacion,
    public readonly params: Record<string, string | number> = {},
  ) {
    super(clave);
    this.name = "ErrorOperacion";
  }
}

/** Resultado que devuelven las acciones de operaciones en lugar de lanzar. */
export type ResultadoOperacion<T = Record<never, never>> = ({ ok: true } & T) | { ok: false; error: string };

/** Texto legible (en el idioma de la petición) para cualquier error de un proceso. */
export async function textoDeErrorOperacion(error: unknown): Promise<string> {
  const t = await getTranslations("contab.operaciones.errores");
  if (error instanceof ErrorOperacion) return t(error.clave, error.params);
  if (error instanceof ErrorCodigosTransaccion) {
    const idioma = await getLocale();
    const nombres = error.codigos
      .map((c) => {
        const d = definicionDe(c);
        return d ? `${c} (${textoEn(d.nombre, idioma)})` : c;
      })
      .join(", ");
    return t(`codigos.${error.clave}`, { codigos: nombres, detalle: error.message });
  }
  // Lo demás (período cerrado, etc.) lo reconoce `estadoDeError`, que además lo anota en el log.
  const estado = estadoDeError(error);
  return estado === "periodo_cerrado" ? t("periodo_cerrado") : t("generico");
}
