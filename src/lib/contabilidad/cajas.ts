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

/*
 * Las cuentas fijas del cuadre (caja chica por defecto, faltante y sobrante
 * de caja) ya no viven aquí: son códigos de transacción (CAJ_CAJA_CHICA,
 * CAJ_ARQUEO_FALTANTE, CAJ_ARQUEO_SOBRANTE) que la contadora asigna en
 * Configuración contable. El catálogo no trae cuenta de sobrante, así que
 * aprobar un arqueo con sobrante falla con «código sin cuenta» hasta que se
 * la asignen.
 */

export type ConteoDenominacion = {
  denominacion: number;
  tipo: "billete" | "moneda";
  cantidad: number;
};

/** Clave entera en centavos para indexar denominaciones sin errores de punto flotante. */
export function claveDenominacion(valor: number): number {
  return Math.round(Number(valor) * 100);
}

/**
 * Normaliza una lista cruda de `{ denominacion, cantidad }` contra las
 * denominaciones válidas de la moneda, sumando duplicados y descartando ceros/NaN.
 */
export function normalizarDesglose(
  moneda: "DOP" | "USD",
  entradas: readonly { denominacion: number; cantidad: number }[],
): ConteoDenominacion[] {
  const permitidas = denominacionesDe(moneda);
  const porClave = new Map(permitidas.map((d) => [claveDenominacion(d.valor), d]));
  const acumulado = new Map<number, number>();

  for (const e of entradas) {
    const numDenom = Number(e.denominacion);
    const numCant = Number(e.cantidad);
    if (!Number.isFinite(numDenom) || !Number.isFinite(numCant)) continue;
    const clave = claveDenominacion(numDenom);
    if (!porClave.has(clave)) continue;
    const entera = Math.max(0, Math.trunc(numCant));
    if (entera <= 0) continue;
    acumulado.set(clave, (acumulado.get(clave) ?? 0) + entera);
  }

  return permitidas
    .map((d) => ({
      denominacion: d.valor,
      tipo: d.tipo,
      cantidad: acumulado.get(claveDenominacion(d.valor)) ?? 0,
    }))
    .filter((item) => item.cantidad > 0);
}

/** Suma en centavos para que 0.1 + 0.2 no deje un descuadre de 0.0000001. */
export function totalContado(
  conteos: readonly { denominacion: number; cantidad: number }[],
): number {
  const centavos = conteos.reduce((suma, c) => {
    const denom = Number(c.denominacion);
    const cant = Number(c.cantidad);
    if (!Number.isFinite(denom) || !Number.isFinite(cant)) return suma;
    return suma + Math.round(denom * 100) * Math.max(0, Math.trunc(cant));
  }, 0);
  return centavos / 100;
}

export const redondear = (valor: number): number =>
  Number.isFinite(valor) ? Math.round(valor * 100) / 100 : 0;

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
  "codigo_sin_cuenta",
  "codigo_repetido",
  "periodo_cerrado",
  "solo_supervisor",
  "desglose_requerido",
  "desglose_no_coincide",
  "denominacion_insuficiente",
  "sin_comprobante_vigente",
  "comprobante_requerido",
  "entregado_requerido",
  "caja_cerrada",
  "caja_con_saldo",
  "cuenta_no_permitida",
  "error",
] as const;

export type ErrorCaja = (typeof ERRORES_CAJA)[number];

export type ResultadoCaja = { exito: true; id?: string } | { exito: false; error: ErrorCaja };
