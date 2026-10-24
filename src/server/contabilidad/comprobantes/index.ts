import { ComprobanteExterno } from "./externo";
import type { ComprobanteProvider } from "./proveedor";

export type { Comprobante, ComprobanteProvider, DatosEmision } from "./proveedor";
export { ComprobanteInvalido, EmisionDeshabilitada } from "./externo";

/**
 * El proveedor de comprobantes que toca.
 *
 * Hoy siempre es el externo, porque no hay facturador homologado conectado.
 * Cuando lo haya, este es el único sitio que cambia: se lee
 * `contabilidad.entidad.emision_comprobantes_habilitada` y, si está en `true`,
 * se devuelve el facturador. La bandera no se consulta todavía a propósito:
 * encenderla sin facturador no puede, por sí sola, ponerse a emitir.
 */
export function proveedorDeComprobantes(): ComprobanteProvider {
  return ComprobanteExterno;
}
