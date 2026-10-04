/**
 * Vocabulario y formato del módulo de contabilidad.
 *
 * Vive en `src/lib` porque lo usan componentes cliente (formularios y
 * filtros): importarlo desde `@/server/contabilidad` arrastraría `pg` al
 * navegador. Las listas copian los CHECK de la migración 0036; si cambian
 * allí, cambian aquí.
 *
 * LOS MONTOS VIAJAN COMO TEXTO. `pg` entrega NUMERIC como cadena para no
 * perder precisión, y así se quedan hasta la base. Solo se convierten a
 * número para PINTARLOS (`formatearMonto`), nunca para sumar ni guardar.
 */

export const MONEDAS = ["DOP", "USD"] as const;
export type Moneda = (typeof MONEDAS)[number];

export const TIPOS_RECIBO = ["ingreso", "egreso"] as const;
export type TipoRecibo = (typeof TIPOS_RECIBO)[number];

export const FORMAS_PAGO = ["transferencia", "cheque", "efectivo", "tarjeta"] as const;
export type FormaPago = (typeof FORMAS_PAGO)[number];

export const ESTADOS_RECIBO = ["borrador", "contabilizado", "anulado"] as const;
export type EstadoRecibo = (typeof ESTADOS_RECIBO)[number];

export const TIPOS_MOVIMIENTO_BANCO = [
  "deposito",
  "cheque",
  "transferencia_enviada",
  "transferencia_recibida",
  "debito",
  "credito",
  "comision",
] as const;
export type TipoMovimientoBanco = (typeof TIPOS_MOVIMIENTO_BANCO)[number];

/** Serie de numeración de cada tipo de recibo (secuencias RI y CE). */
export const SERIE_RECIBO: Record<TipoRecibo, string> = {
  ingreso: "RI",
  egreso: "CE",
};

function incluido<T extends string>(lista: readonly T[], valor: unknown): valor is T {
  return typeof valor === "string" && (lista as readonly string[]).includes(valor);
}

export const esMoneda = (v: unknown): v is Moneda => incluido(MONEDAS, v);
export const esTipoRecibo = (v: unknown): v is TipoRecibo => incluido(TIPOS_RECIBO, v);
export const esFormaPago = (v: unknown): v is FormaPago => incluido(FORMAS_PAGO, v);
export const esEstadoRecibo = (v: unknown): v is EstadoRecibo => incluido(ESTADOS_RECIBO, v);
export const esTipoMovimientoBanco = (v: unknown): v is TipoMovimientoBanco =>
  incluido(TIPOS_MOVIMIENTO_BANCO, v);

/** "RI-000042": el número como va impreso. Seis cifras alcanzan un siglo de recibos. */
export function numeroDocumento(serie: string, numero: number | string): string {
  return `${serie}-${String(numero).padStart(6, "0")}`;
}

/**
 * Solo los cuatro últimos dígitos. El número completo está en la base y en
 * Configuración; en una pantalla que se proyecta en una reunión, no.
 */
export function enmascararCuenta(numero: string): string {
  const limpio = numero.replace(/\s/g, "");
  return `•••• ${limpio.slice(-4)}`;
}

/**
 * Monto para mostrar, en la moneda de la cuenta.
 *
 * `en-US` fijo por la misma razón que `montoUsd` en `src/lib/finanzas.ts`:
 * la cifra no cambia de forma con el idioma de la interfaz. El símbolo sí
 * distingue la moneda (RD$ / US$), que en un libro con dos cuentas es lo
 * que no se puede confundir.
 */
export function formatearMonto(valor: string | number, moneda: Moneda): string {
  const cifra = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(valor));
  const prefijo = moneda === "DOP" ? "RD$" : "US$";
  return cifra.startsWith("-") ? `−${prefijo}${cifra.slice(1)}` : `${prefijo}${cifra}`;
}

/** Hasta 12 enteros y 2 decimales: lo que cabe en NUMERIC(14,2). */
const MONTO = /^\d{1,12}(\.\d{1,2})?$/;

/**
 * Normaliza lo que escribió la persona ("1,500.5" → "1500.5") y dice si
 * es un monto válido y positivo. Devuelve el texto o null; no hay float
 * en ningún paso.
 */
export function montoValido(texto: string): string | null {
  const limpio = texto.trim().replace(/,/g, "");
  if (!MONTO.test(limpio) || /^0+(\.0+)?$/.test(limpio)) return null;
  return limpio;
}

/** Tasa DOP por USD: hasta 8 enteros y 4 decimales, NUMERIC(12,4). */
export function tasaValida(texto: string): string | null {
  const limpio = texto.trim().replace(/,/g, "");
  if (!/^\d{1,8}(\.\d{1,4})?$/.test(limpio) || Number(limpio) <= 0) return null;
  return limpio;
}

/**
 * `YYYY-MM-DD` y además un día que existe: "2026-02-31" cumple el patrón
 * y no es una fecha.
 */
export function esFechaIso(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const fecha = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function esUuid(valor: unknown): valor is string {
  return typeof valor === "string" && UUID.test(valor);
}

/**
 * Suma montos en texto ("-12.50", "100") en centavos enteros. Para cuadrar
 * una conciliación en pantalla con cifras que ya calculó la base: sumar
 * esos textos como float podría dar 0.0000001 y decir "no cuadra".
 */
export function sumarMontos(valores: readonly string[]): string {
  const centavos = valores.reduce((total, valor) => {
    const negativo = valor.trim().startsWith("-");
    const [entero, decimales = ""] = valor.trim().replace("-", "").split(".");
    const c = BigInt(entero || "0") * 100n + BigInt((decimales + "00").slice(0, 2));
    return total + (negativo ? -c : c);
  }, 0n);
  const absoluto = centavos < 0n ? -centavos : centavos;
  return `${centavos < 0n ? "-" : ""}${absoluto / 100n}.${String(absoluto % 100n).padStart(2, "0")}`;
}

export function restarMontos(a: string, b: string): string {
  const opuesto = b.trim().startsWith("-") ? b.trim().slice(1) : `-${b.trim()}`;
  return sumarMontos([a, opuesto]);
}

/** Lo que admite un adjunto contable: el comprobante escaneado o su PDF. */
export const TIPOS_ADJUNTO = ["application/pdf", "image/jpeg", "image/png"] as const;
export const MAXIMO_ADJUNTO = 10 * 1024 * 1024;
