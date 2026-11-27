/**
 * Señal de vencimiento de una cuenta por pagar. Vive aquí y no en `server/` porque la
 * pinta un componente cliente; el SQL de `server/contabilidad/cxp/consultas.ts` usa la
 * misma ventana para que el chip «Por vencer» y la fila digan lo mismo.
 */

/** Ventana de «por vencer»: lo que vence de hoy a 7 días. */
export const DIAS_POR_VENCER = 7;

/**
 * `dias_vencida` ya viene calculado en la base con la fecha de la Fundación (negativo:
 * faltan). Solo lo abierto vence: una cuenta pagada o anulada no lleva señal.
 */
export function senalVencimiento(estado: string, diasVencida: number): "vencida" | "por_vencer" | null {
  if (estado === "pagada" || estado === "anulada") return null;
  if (diasVencida > 0) return "vencida";
  if (diasVencida >= -DIAS_POR_VENCER) return "por_vencer";
  return null;
}
