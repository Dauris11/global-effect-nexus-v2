/**
 * Periodo del tablero de Contabilidad. Va en la URL (`?periodo=`) para que un
 * enlace compartido muestre lo mismo a quien lo abre.
 */
export const PERIODOS_TABLERO = ["mes", "trimestre", "anio"] as const;
export type PeriodoTablero = (typeof PERIODOS_TABLERO)[number];

export function leerPeriodoTablero(valor: unknown): PeriodoTablero {
  return (PERIODOS_TABLERO as readonly unknown[]).includes(valor)
    ? (valor as PeriodoTablero)
    : "mes";
}
