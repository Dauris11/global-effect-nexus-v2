/**
 * Periodo del tablero de Contabilidad. Va en la URL (`?periodo=` y `?ref=`)
 * para que un enlace compartido muestre lo mismo a quien lo abre.
 *
 * `ref` es un día cualquiera dentro del periodo que se mira: "trimestre" a
 * secas no decía CUÁL trimestre (Observaciones #1), así que el tablero
 * siempre nombra el periodo y deja ir al anterior o al siguiente.
 *
 * Todo el cálculo es en UTC sobre `YYYY-MM-DD`: el servidor vive en UTC y
 * la zona local correría el último día del mes al siguiente.
 */
export const PERIODOS_TABLERO = ["mes", "trimestre", "anio"] as const;
export type PeriodoTablero = (typeof PERIODOS_TABLERO)[number];

export type RangoTablero = { desde: string; hasta: string };

export function leerPeriodoTablero(valor: unknown): PeriodoTablero {
  return (PERIODOS_TABLERO as readonly unknown[]).includes(valor)
    ? (valor as PeriodoTablero)
    : "mes";
}

/** `YYYY-MM-DD` válido o `hoy`. */
export function leerReferencia(valor: unknown, hoy: string): string {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return hoy;
  const fecha = new Date(`${valor}T00:00:00Z`);
  return Number.isNaN(fecha.getTime()) ? hoy : valor;
}

const iso = (anio: number, mes0: number, dia: number) =>
  new Date(Date.UTC(anio, mes0, dia)).toISOString().slice(0, 10);

/** Mes (0-11) en que empieza el periodo que contiene `ref`. */
function mesInicial(periodo: PeriodoTablero, mes0: number): number {
  if (periodo === "anio") return 0;
  if (periodo === "trimestre") return mes0 - (mes0 % 3);
  return mes0;
}

const MESES_DEL_PERIODO: Record<PeriodoTablero, number> = { mes: 1, trimestre: 3, anio: 12 };

export function rangoTablero(periodo: PeriodoTablero, ref: string): RangoTablero {
  const anio = Number(ref.slice(0, 4));
  const inicio = mesInicial(periodo, Number(ref.slice(5, 7)) - 1);
  return {
    desde: iso(anio, inicio, 1),
    // Día 0 del mes siguiente al último = último día del periodo.
    hasta: iso(anio, inicio + MESES_DEL_PERIODO[periodo], 0),
  };
}

/** Primer día del periodo anterior (`-1`) o siguiente (`1`). */
export function desplazarPeriodo(periodo: PeriodoTablero, ref: string, paso: -1 | 1): string {
  const anio = Number(ref.slice(0, 4));
  const inicio = mesInicial(periodo, Number(ref.slice(5, 7)) - 1);
  return iso(anio, inicio + paso * MESES_DEL_PERIODO[periodo], 1);
}

/** Número del trimestre (1-4) que contiene `ref`. */
export function trimestreDe(ref: string): number {
  return Math.floor((Number(ref.slice(5, 7)) - 1) / 3) + 1;
}
