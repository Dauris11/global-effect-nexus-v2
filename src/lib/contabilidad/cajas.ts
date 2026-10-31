/**
 * Valores compartidos del cuadre de caja chica (fondo fijo).
 *
 * Viven aquí y no en `src/server/contabilidad/cajas` porque los usan a la vez
 * el contador del arqueo (cliente) y la acción que lo guarda (servidor): si
 * cada lado tuviera su lista de denominaciones, un billete nuevo se contaría en
 * pantalla y se perdería al guardar.
 *
 * El modelo es el de fondo fijo (imprest): en todo momento
 *   efectivo + vales por liquidar + gastos por reponer = fondo fijo.
 * Por eso el saldo esperado de un arqueo no se toma de un campo editable, sino
 * de esa ecuación, y la reposición propone exactamente lo gastado.
 */

export type Denominacion = { valor: number; tipo: "billete" | "moneda" };

/** Billetes y monedas en circulación del Banco Central (RD$). */
export const DENOMINACIONES_DOP: readonly Denominacion[] = [
  { valor: 2000, tipo: "billete" },
  { valor: 1000, tipo: "billete" },
  { valor: 500, tipo: "billete" },
  { valor: 200, tipo: "billete" },
  { valor: 100, tipo: "billete" },
  { valor: 50, tipo: "billete" },
  { valor: 25, tipo: "moneda" },
  { valor: 10, tipo: "moneda" },
  { valor: 5, tipo: "moneda" },
  { valor: 1, tipo: "moneda" },
];

export const DENOMINACIONES_USD: readonly Denominacion[] = [
  { valor: 100, tipo: "billete" },
  { valor: 50, tipo: "billete" },
  { valor: 20, tipo: "billete" },
  { valor: 10, tipo: "billete" },
  { valor: 5, tipo: "billete" },
  { valor: 1, tipo: "billete" },
  { valor: 0.25, tipo: "moneda" },
  { valor: 0.1, tipo: "moneda" },
  { valor: 0.05, tipo: "moneda" },
  { valor: 0.01, tipo: "moneda" },
];

export function denominacionesDe(moneda: "DOP" | "USD"): readonly Denominacion[] {
  return moneda === "USD" ? DENOMINACIONES_USD : DENOMINACIONES_DOP;
}

/**
 * Por debajo de este porcentaje del fondo la caja pide reposición. Es el mismo
 * umbral del inicio de Contabilidad: si cambia aquí, cambia en los dos sitios.
 */
export const UMBRAL_CAJA_BAJA = 0.25;

/** Diferencia de arqueo a partir de la cual se levanta una alerta contable. */
export const UMBRAL_ALERTA_DIFERENCIA = 200;

/** Justificación mínima cuando el arqueo no cuadra (lo exige la tabla). */
export const JUSTIFICACION_MINIMA = 5;

/** Cuentas del catálogo que usa el cuadre. Se buscan por código. */
export const CUENTA_CAJA_CHICA = "1.1.01.02";
export const CUENTA_FALTANTE_CAJA = "5.9.01.99";
export const CUENTA_SOBRANTE_CAJA = "4.9.01.99";

/** Suma en centavos para que 0.1 + 0.2 no deje un descuadre de 0.0000001. */
export function totalContado(
  conteos: readonly { denominacion: number; cantidad: number }[],
): number {
  const centavos = conteos.reduce(
    (suma, c) => suma + Math.round(c.denominacion * 100) * Math.max(0, Math.trunc(c.cantidad)),
    0,
  );
  return centavos / 100;
}

export const redondear = (valor: number): number => Math.round(valor * 100) / 100;

/**
 * Errores que las acciones de caja devuelven como clave de
 * `contab.cajas.errores`: la pantalla traduce, el servidor no escribe texto.
 */
export const ERRORES_CAJA = [
  "datos_invalidos",
  "no_permitido",
  "no_encontrada",
  "inactiva",
  "saldo_insuficiente",
  "falta_adjunto",
  "archivo_invalido",
  "falta_categoria",
  "falta_persona",
  "falta_justificacion",
  "arqueo_pendiente",
  "mismo_usuario",
  "ya_aprobado",
  "excede_fondo",
  "moneda_distinta",
  "sin_cuenta_contable",
  "codigo_repetido",
  "periodo_cerrado",
  "error",
] as const;

export type ErrorCaja = (typeof ERRORES_CAJA)[number];

export type ResultadoCaja = { exito: true; id?: string } | { exito: false; error: ErrorCaja };
