import type { DefinicionCodigo } from "@/lib/contabilidad/codigos-transaccion";

/**
 * Códigos de transacción de: inventario, activos fijos y calculadoras.
 * Cada entrada se escribe igual que las de nómina en `codigos-transaccion.ts`
 * (ver las instrucciones de ese archivo). Van en archivos por grupo para que
 * el archivo principal no crezca sin control.
 *
 * Solo `CALC_FACTURA_GASTO` arranca con cuenta (5.4.12, migración 0120): es la
 * única cuenta de las que usaba el código viejo que existe en el catálogo de
 * 88. El resto queda sin asignar a propósito, porque el catálogo no tiene
 * cuenta de inventario, de depreciación, de ITBIS adelantado ni de
 * retenciones/proveedores con movimiento. Hasta que la contadora las cree y
 * las asigne, el proceso se detiene con «código sin cuenta» y «Asiento» dice
 * cuál falta; inventar una cuenta aquí o apuntar todo a «Otros gastos» sería
 * contabilizar mal en silencio.
 *
 * Un código tiene UN lado: por eso el mismo saldo de existencias son dos
 * códigos distintos según salga (crédito) o entre (débito). Pueden apuntar a
 * la misma cuenta.
 */
export const CODIGOS_OPERACIONES: readonly DefinicionCodigo[] = [
  // ── Inventario: salida por consumo ──
  {
    codigo: "INV_CONSUMO_GASTO",
    modulo: "inventario",
    proceso: "salida_consumo",
    nombre: { es: "Gasto por consumo de inventario", en: "Inventory consumption expense" },
    ayuda: {
      es: "Al registrar una salida por consumo: el costo de lo consumido, imputado al centro de costo. Se debita.",
      en: "When a consumption issue is recorded: the cost of what was consumed, charged to the cost center. Debited.",
    },
    naturaleza: "debito",
  },
  {
    codigo: "INV_CONSUMO_EXISTENCIAS",
    modulo: "inventario",
    proceso: "salida_consumo",
    nombre: { es: "Existencias de inventario (salida)", en: "Inventory on hand (issue)" },
    ayuda: {
      es: "Al registrar una salida por consumo: baja el valor de las existencias del almacén. Se acredita.",
      en: "When a consumption issue is recorded: reduces the value of warehouse stock. Credited.",
    },
    naturaleza: "credito",
  },
  // ── Inventario: ajuste por toma física ──
  {
    codigo: "INV_SOBRANTE_EXISTENCIAS",
    modulo: "inventario",
    proceso: "ajuste_conteo",
    nombre: { es: "Existencias por sobrante de toma física", en: "Inventory on hand (count surplus)" },
    ayuda: {
      es: "Al aplicar una toma física con sobrante neto: sube el valor de las existencias. Se debita.",
      en: "When a physical count with a net surplus is applied: raises the value of stock. Debited.",
    },
    naturaleza: "debito",
  },
  {
    codigo: "INV_SOBRANTE_GANANCIA",
    modulo: "inventario",
    proceso: "ajuste_conteo",
    nombre: { es: "Ganancia por sobrante de inventario", en: "Inventory surplus gain" },
    ayuda: {
      es: "Contrapartida del sobrante de una toma física: lo que se reconoce como ganancia. Se acredita.",
      en: "Counterpart of a physical count surplus: what is recognised as a gain. Credited.",
    },
    naturaleza: "credito",
  },
  {
    codigo: "INV_FALTANTE_PERDIDA",
    modulo: "inventario",
    proceso: "ajuste_conteo",
    nombre: { es: "Pérdida por faltante de inventario", en: "Inventory shortage loss" },
    ayuda: {
      es: "Al aplicar una toma física con faltante neto: lo que se reconoce como pérdida o gasto. Se debita.",
      en: "When a physical count with a net shortage is applied: what is recognised as a loss or expense. Debited.",
    },
    naturaleza: "debito",
  },
  {
    codigo: "INV_FALTANTE_EXISTENCIAS",
    modulo: "inventario",
    proceso: "ajuste_conteo",
    nombre: { es: "Existencias por faltante de toma física", en: "Inventory on hand (count shortage)" },
    ayuda: {
      es: "Contrapartida del faltante de una toma física: baja el valor de las existencias. Se acredita.",
      en: "Counterpart of a physical count shortage: reduces the value of stock. Credited.",
    },
    naturaleza: "credito",
  },
  // ── Activos fijos: depreciación mensual ──
  {
    codigo: "AF_DEPRECIACION_GASTO",
    modulo: "activos_fijos",
    proceso: "depreciacion_mensual",
    nombre: { es: "Gasto de depreciación", en: "Depreciation expense" },
    ayuda: {
      es: "En la depreciación mensual: la cuota del mes de todos los activos. Se debita. Debe ser otra cuenta distinta a la de depreciación acumulada.",
      en: "In monthly depreciation: the month's charge for all assets. Debited. Must be a different account from accumulated depreciation.",
    },
    naturaleza: "debito",
  },
  {
    codigo: "AF_DEPRECIACION_ACUMULADA",
    modulo: "activos_fijos",
    proceso: "depreciacion_mensual",
    nombre: { es: "Depreciación acumulada", en: "Accumulated depreciation" },
    ayuda: {
      es: "En la depreciación mensual: lo que se suma a la depreciación acumulada de los activos. Se acredita.",
      en: "In monthly depreciation: what is added to the assets' accumulated depreciation. Credited.",
    },
    naturaleza: "credito",
  },
  // ── Calculadoras: asiento de una factura ──
  {
    codigo: "CALC_FACTURA_GASTO",
    modulo: "calculadoras",
    proceso: "factura",
    nombre: { es: "Gasto de la factura (calculadora)", en: "Invoice expense (calculator)" },
    ayuda: {
      es: "Asiento de una factura desde la calculadora: el subtotal neto, sin ITBIS. Se debita.",
      en: "Invoice entry from the calculator: the net subtotal, excluding ITBIS. Debited.",
    },
    naturaleza: "debito",
  },
  {
    codigo: "CALC_FACTURA_ITBIS_ADELANTADO",
    modulo: "calculadoras",
    proceso: "factura",
    nombre: { es: "ITBIS pagado por adelantado (calculadora)", en: "ITBIS paid in advance (calculator)" },
    ayuda: {
      es: "Asiento de una factura desde la calculadora: el ITBIS de la factura. Se debita.",
      en: "Invoice entry from the calculator: the invoice's ITBIS. Debited.",
    },
    naturaleza: "debito",
  },
  {
    codigo: "CALC_FACTURA_ISR_RETENIDO",
    modulo: "calculadoras",
    proceso: "factura",
    nombre: { es: "ISR retenido por pagar (calculadora)", en: "Income tax withheld payable (calculator)" },
    ayuda: {
      es: "Asiento de una factura desde la calculadora: la retención de ISR. Se acredita; sin retención no se usa.",
      en: "Invoice entry from the calculator: the income tax withholding. Credited; unused when there is none.",
    },
    naturaleza: "credito",
  },
  {
    codigo: "CALC_FACTURA_ITBIS_RETENIDO",
    modulo: "calculadoras",
    proceso: "factura",
    nombre: { es: "ITBIS retenido por pagar (calculadora)", en: "ITBIS withheld payable (calculator)" },
    ayuda: {
      es: "Asiento de una factura desde la calculadora: la retención de ITBIS. Se acredita; sin retención no se usa.",
      en: "Invoice entry from the calculator: the ITBIS withholding. Credited; unused when there is none.",
    },
    naturaleza: "credito",
  },
  {
    codigo: "CALC_FACTURA_CXP_NETO",
    modulo: "calculadoras",
    proceso: "factura",
    nombre: { es: "Cuentas por pagar, neto (calculadora)", en: "Accounts payable, net (calculator)" },
    ayuda: {
      es: "Asiento de una factura desde la calculadora: el neto a pagar al proveedor. Se acredita.",
      en: "Invoice entry from the calculator: the net amount payable to the supplier. Credited.",
    },
    naturaleza: "credito",
  },
];
