import { getTranslations } from "next-intl/server";

import { ErrorCodigosTransaccion } from "@/server/contabilidad/codigos-transaccion/asiento";

/**
 * Texto traducido de un error del motor de códigos para las pantallas de
 * donaciones, fondos y cierre. Vive aparte de las `acciones.ts` porque un
 * archivo "use server" solo exporta funciones async de acciones. Devuelve
 * `null` si el error es de otra cosa, para que quien llama conserve su propio
 * manejo.
 */
export async function textoDeErrorCodigos(error: unknown): Promise<string | null> {
  if (!(error instanceof ErrorCodigosTransaccion)) return null;
  const t = await getTranslations("contab.patrimonio.errores");
  const codigos = error.codigos.join(", ");
  switch (error.clave) {
    case "codigo_sin_cuenta":
      return t("codigo_sin_cuenta", { codigos });
    case "cuenta_no_usable":
      return t("cuenta_no_usable", { codigos });
    case "asiento_descuadrado":
      return t("asiento_descuadrado");
    case "monto_invalido":
      return t("monto_invalido", { codigos });
    default:
      return t("codigo_desconocido", { codigos });
  }
}
