/**
 * Punto de extensión para comprobantes fiscales (NCF / e-CF).
 *
 * La Fundación NO emite facturas (decisión de alcance del plan del ERP): no hay
 * XML, ni firma digital, ni envío a la DGII, ni TrackID. Pero si mañana una
 * actividad gravada exige emitir, el facturador homologado se conecta aquí
 * implementando esta interfaz, y nada del resto del módulo cambia: recibos y
 * donaciones siguen pidiendo "el comprobante" a quien esté detrás.
 *
 * Hoy solo existe `ComprobanteExterno`, que no emite: registra el número de un
 * comprobante emitido FUERA del sistema y comprueba que tenga forma de NCF o
 * e-CF. Lo elige `comprobantes/index.ts` según
 * `contabilidad.entidad.emision_comprobantes_habilitada`.
 */

export type Comprobante = {
  /** NCF (B + 2 + 8 = 11) o e-CF (E + 2 + 10 = 13), en mayúsculas. */
  numero: string;
  /** Tipo de comprobante: los dos dígitos tras la letra (01, 02, 14, 15, 31…). */
  tipo: string;
  /** Quién lo emitió: "externo" si vino de fuera del sistema. */
  origen: "externo" | "emitido";
};

export type DatosEmision = {
  tipo: string;
  rncCliente: string | null;
  fecha: string;
  /** Montos en cadena decimal exacta, nunca en `number`. */
  subtotal: string;
  itbis: string;
  total: string;
};

export interface ComprobanteProvider {
  /** Nombre del proveedor, para la bitácora. */
  readonly clave: string;
  /** Si este proveedor puede emitir. `false` en `ComprobanteExterno`. */
  readonly emite: boolean;
  /** Emite un comprobante nuevo. Lanza `emision_deshabilitada` si no emite. */
  emitir(datos: DatosEmision): Promise<Comprobante>;
  /** Valida y normaliza un número emitido fuera del sistema. */
  registrarExterno(numero: string): Comprobante;
}
