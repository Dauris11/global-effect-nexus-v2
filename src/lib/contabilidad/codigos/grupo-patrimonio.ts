import type { DefinicionCodigo } from "@/lib/contabilidad/codigos-transaccion";

/**
 * Códigos de transacción de: donaciones, fondos y cierres.
 * Cada entrada se escribe igual que las de nómina en `codigos-transaccion.ts`
 * (ver las instrucciones de ese archivo). Van en archivos por grupo para que
 * el archivo principal no crezca sin control.
 *
 * Lo que NO tiene código a propósito: la cuenta del banco que recibe una
 * donación (la elige quien registra), las cuentas de ingreso y gasto que el
 * cierre anual cancela (son las que tuvieron saldo ese año) y las promesas de
 * donación, que no contabilizan hasta que se cobran.
 */
export const CODIGOS_PATRIMONIO: readonly DefinicionCodigo[] = [
  // ── Donaciones: el ingreso se reconoce por origen ──
  {
    codigo: "DON_NACIONAL_BANCO",
    modulo: "donaciones",
    proceso: "nacional_banco",
    nombre: { es: "Donación nacional recibida en banco", en: "Domestic donation received in bank" },
    ayuda: {
      es: "Ingreso por una donación en pesos que entra a una cuenta bancaria. El débito va a la cuenta del banco elegida al registrarla.",
      en: "Income from a donation in pesos deposited into a bank account. The debit goes to the bank account chosen when registering it.",
    },
    naturaleza: "credito",
  },
  {
    codigo: "DON_INTERNACIONAL_BANCO",
    modulo: "donaciones",
    proceso: "internacional_banco",
    nombre: { es: "Donación internacional recibida en banco", en: "International donation received in bank" },
    ayuda: {
      es: "Ingreso por una donación en dólares que entra a una cuenta bancaria, llevada en pesos a la tasa del día.",
      en: "Income from a donation in dollars deposited into a bank account, recorded in pesos at the day's rate.",
    },
    naturaleza: "credito",
  },
  {
    codigo: "DON_ESPECIE_INGRESO",
    modulo: "donaciones",
    proceso: "especie_ingreso",
    nombre: { es: "Ingreso por donación en especie", en: "In-kind donation income" },
    ayuda: {
      es: "Ingreso por bienes recibidos sin costo. Sin cuenta asignada, las donaciones en especie no se pueden registrar.",
      en: "Income from goods received at no cost. Without an assigned account, in-kind donations cannot be registered.",
    },
    naturaleza: "credito",
  },
  {
    codigo: "DON_ESPECIE_BIEN_RECIBIDO",
    modulo: "donaciones",
    proceso: "especie_bien",
    nombre: { es: "Bien recibido en donación en especie", en: "Goods received as in-kind donation" },
    ayuda: {
      es: "Cuenta de inventario o activo que recibe el bien donado cuando no se elige otra al registrarla.",
      en: "Inventory or asset account that receives the donated goods when no other is chosen when registering.",
    },
    naturaleza: "debito",
  },
  // ── Fondos: liberar una restricción ──
  {
    codigo: "FON_LIBERACION_RESTRINGIDO",
    modulo: "fondos",
    proceso: "liberacion_restringido",
    nombre: { es: "Fondo restringido que se libera", en: "Restricted fund being released" },
    ayuda: {
      es: "Patrimonio con restricción que se reclasifica al liberar un fondo restringido.",
      en: "Restricted net assets reclassified when a restricted fund is released.",
    },
    naturaleza: "debito",
  },
  {
    codigo: "FON_LIBERACION_OPERATIVO",
    modulo: "fondos",
    proceso: "liberacion_operativo",
    nombre: { es: "Fondo liberado para operaciones", en: "Fund released for operations" },
    ayuda: {
      es: "Patrimonio sin restricción que recibe lo liberado de un fondo restringido.",
      en: "Unrestricted net assets that receive what is released from a restricted fund.",
    },
    naturaleza: "credito",
  },
  // ── Cierre anual: contrapartida de la cancelación de ingresos y gastos ──
  {
    codigo: "CIE_RESULTADOS_ACUMULADOS_SUPERAVIT",
    modulo: "cierre",
    proceso: "superavit_acumulado",
    nombre: { es: "Superávit del ejercicio a resultados acumulados", en: "Year surplus to accumulated results" },
    ayuda: {
      es: "Contrapartida del cierre anual cuando los ingresos superan a los gastos.",
      en: "Offsetting entry of the annual closing when income exceeds expenses.",
    },
    naturaleza: "credito",
  },
  {
    codigo: "CIE_RESULTADOS_ACUMULADOS_DEFICIT",
    modulo: "cierre",
    proceso: "deficit_acumulado",
    nombre: { es: "Déficit del ejercicio a resultados acumulados", en: "Year deficit to accumulated results" },
    ayuda: {
      es: "Contrapartida del cierre anual cuando los gastos superan a los ingresos.",
      en: "Offsetting entry of the annual closing when expenses exceed income.",
    },
    naturaleza: "debito",
  },
];
