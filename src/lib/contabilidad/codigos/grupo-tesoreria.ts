import type { DefinicionCodigo } from "@/lib/contabilidad/codigos-transaccion";

/**
 * Códigos de transacción de: bancos, cajas y recibos.
 *
 * Solo llevan código las líneas cuya cuenta es FIJA del proceso (la ganancia
 * o pérdida cambiaria de una transferencia, el faltante de un arqueo). Las
 * líneas que dependen de lo que la persona elige NO son códigos:
 *   · Recibos (`contabilizar_recibo`): el banco sale de la cuenta bancaria
 *     elegida y la contrapartida de la categoría del recibo (o de la cuenta de
 *     contrapartida que se fije, como hace la reposición de caja). Un recibo
 *     no tiene líneas fijas, por eso no tiene códigos.
 *   · Gasto de caja: la contrapartida es la de la categoría del gasto y el
 *     haber es la cuenta de la caja.
 *   · Transferencia: las dos cuentas contables son las de las cuentas
 *     bancarias elegidas.
 * Esas líneas aparecen igual en «Asiento», sin código de transacción.
 */
export const CODIGOS_TESORERIA: readonly DefinicionCodigo[] = [
  // ── Bancos: transferencia entre cuentas propias ──
  {
    codigo: "BAN_TRANSFER_GANANCIA_CAMBIARIA",
    modulo: "bancos",
    proceso: "transferencia_ganancia_cambiaria",
    nombre: { es: "Ganancia cambiaria en transferencias", en: "Exchange gain on transfers" },
    ayuda: {
      es: "Lo que entra de más al pasar dinero entre cuentas de monedas distintas: el banco abonó más pesos de los que salieron al valorar ambos lados con la tasa de referencia.",
      en: "The extra amount received when moving money between accounts in different currencies: the bank credited more pesos than left, valuing both sides at the reference rate.",
    },
    naturaleza: "credito",
  },
  {
    codigo: "BAN_TRANSFER_PERDIDA_CAMBIARIA",
    modulo: "bancos",
    proceso: "transferencia_perdida_cambiaria",
    nombre: { es: "Pérdida cambiaria en transferencias", en: "Exchange loss on transfers" },
    ayuda: {
      es: "Lo que se pierde al pasar dinero entre cuentas de monedas distintas: el banco cobró en el cambio (o dio menos pesos) frente a la tasa de referencia.",
      en: "What is lost when moving money between accounts in different currencies: the bank charged in the exchange (or gave fewer pesos) against the reference rate.",
    },
    naturaleza: "debito",
  },
  // ── Cajas y arqueos ──
  {
    codigo: "CAJ_CAJA_CHICA",
    modulo: "cajas",
    proceso: "caja_chica",
    nombre: { es: "Caja chica (cuenta por defecto)", en: "Petty cash (default account)" },
    ayuda: {
      es: "Cuenta que usa una caja que no tiene cuenta contable propia. Solo importa su cuenta, no su lado: el lado depende de si la caja recibe o entrega dinero.",
      en: "Account used by a cash box that has no ledger account of its own. Only its account matters, not its side: the side depends on whether the box receives or pays out cash.",
    },
    naturaleza: "debito",
  },
  {
    codigo: "CAJ_ARQUEO_FALTANTE",
    modulo: "cajas",
    proceso: "arqueo_faltante",
    nombre: { es: "Faltante de caja en el arqueo", en: "Cash shortage at the count" },
    ayuda: {
      es: "Al aprobar un arqueo con menos efectivo del que dice el sistema, la diferencia se carga a este gasto y se acredita la caja.",
      en: "When a count is approved with less cash than the system shows, the difference is charged to this expense and the cash box is credited.",
    },
    naturaleza: "debito",
  },
  {
    codigo: "CAJ_ARQUEO_SOBRANTE",
    modulo: "cajas",
    proceso: "arqueo_sobrante",
    nombre: { es: "Sobrante de caja en el arqueo", en: "Cash overage at the count" },
    ayuda: {
      es: "Al aprobar un arqueo con más efectivo del que dice el sistema, la diferencia se acredita a esta cuenta y se carga la caja. El catálogo no trae una cuenta de sobrante: asígnala aquí cuando la contadora la defina.",
      en: "When a count is approved with more cash than the system shows, the difference is credited to this account and the cash box is debited. The chart has no overage account: assign one here once the accountant defines it.",
    },
    naturaleza: "credito",
  },
];
