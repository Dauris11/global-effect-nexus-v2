import type { DefinicionCodigo } from "@/lib/contabilidad/codigos-transaccion";

/**
 * Códigos de transacción de: facturas y pagos a proveedores.
 * Cada entrada se escribe igual que las de nómina en `codigos-transaccion.ts`
 * (ver las instrucciones de ese archivo). Van en archivos por grupo para que
 * el archivo principal no crezca sin control.
 *
 * Ninguno arranca con cuenta: el catálogo vigente (88 cuentas) no tiene
 * proveedores con movimiento (2.1.1 es agrupadora y sin hijas) ni cuentas de
 * retenciones de ISR/ITBIS (migración 0118). La contadora crea las cuentas de
 * detalle y las asigna aquí; hasta entonces aprobar facturas y pagar a
 * proveedores se detiene con «código sin cuenta» y «Asiento» dice cuál falta.
 *
 * Son dos códigos distintos para «cuentas por pagar»: una misma cuenta se
 * acredita al aprobar la factura y se debita al pagarla, y el lado es
 * propiedad del código. Pueden apuntar a la MISMA cuenta.
 */
export const CODIGOS_PROVEEDORES: readonly DefinicionCodigo[] = [
  {
    codigo: "PROV_CXP_FACTURA",
    modulo: "proveedores",
    proceso: "aprobar_factura",
    nombre: { es: "Cuentas por pagar a proveedores", en: "Accounts payable to suppliers" },
    ayuda: {
      es: "Al aprobar una factura de proveedor: lo que se le debe (total menos retenciones). Se acredita.",
      en: "When a supplier invoice is approved: what is owed to the supplier (total minus withholdings). Credited.",
    },
    naturaleza: "credito",
  },
  {
    codigo: "PROV_ISR_RETENIDO_X_PAGAR",
    modulo: "proveedores",
    proceso: "aprobar_factura",
    nombre: { es: "ISR retenido por pagar", en: "Income tax withheld payable" },
    ayuda: {
      es: "Al aprobar una factura con retención de ISR: lo retenido al proveedor que se debe a la DGII. Se acredita; sin retención no se usa.",
      en: "When approving an invoice with income tax withholding: the amount withheld from the supplier and owed to the tax authority. Credited; unused without a withholding.",
    },
    naturaleza: "credito",
  },
  {
    codigo: "PROV_ITBIS_RETENIDO_X_PAGAR",
    modulo: "proveedores",
    proceso: "aprobar_factura",
    nombre: { es: "ITBIS retenido por pagar", en: "VAT withheld payable" },
    ayuda: {
      es: "Al aprobar una factura con retención de ITBIS: lo retenido al proveedor que se debe a la DGII. Se acredita; sin retención no se usa.",
      en: "When approving an invoice with VAT withholding: the amount withheld from the supplier and owed to the tax authority. Credited; unused without a withholding.",
    },
    naturaleza: "credito",
  },
  {
    codigo: "PROV_PAGO_CXP",
    modulo: "proveedores",
    proceso: "pagar_cxp",
    nombre: { es: "Pago de cuentas por pagar a proveedores", en: "Payment of supplier accounts payable" },
    ayuda: {
      es: "Al pagar una deuda que nació de una factura: cancela lo que se le debía al proveedor. Siempre se debita (lo fija el recibo de egreso); normalmente va a la misma cuenta que «Cuentas por pagar a proveedores».",
      en: "When paying a debt that came from an invoice: clears what was owed to the supplier. Always debited (the disbursement receipt fixes this); normally the same account as “Accounts payable to suppliers”.",
    },
    naturaleza: "debito",
  },
];
