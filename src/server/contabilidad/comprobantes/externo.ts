import { limpiarIdentificacion, ncfValido } from "@/lib/contabilidad/identificacion";

import type { Comprobante, ComprobanteProvider } from "./proveedor";

/** Lo que se lanza cuando alguien intenta emitir sin facturador conectado. */
export class EmisionDeshabilitada extends Error {
  constructor() {
    super("emision_deshabilitada");
    this.name = "EmisionDeshabilitada";
  }
}

/** Lo que se lanza cuando el número no tiene forma de NCF ni de e-CF. */
export class ComprobanteInvalido extends Error {
  constructor() {
    super("comprobante_invalido");
    this.name = "ComprobanteInvalido";
  }
}

/**
 * El único proveedor de hoy: no emite, solo registra números de fuera.
 *
 * Emitir lanza en vez de devolver un número vacío: un comprobante inventado
 * en un formato 607 es peor que un error visible.
 */
export const ComprobanteExterno: ComprobanteProvider = {
  clave: "externo",
  emite: false,

  async emitir() {
    throw new EmisionDeshabilitada();
  },

  registrarExterno(numero: string): Comprobante {
    const limpio = limpiarIdentificacion(numero).toUpperCase();

    if (!ncfValido(limpio)) throw new ComprobanteInvalido();

    return { numero: limpio, tipo: limpio.slice(1, 3), origen: "externo" };
  },
};
