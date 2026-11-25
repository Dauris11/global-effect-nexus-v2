/**
 * Los cuatro pilares del costo por estudiante becado (plan:
 * docs/estado/plan-costo-por-estudiante.md). Los comparten la base (`pilar` en
 * `v_estudiante_costo_detalle`), los formularios de factura y orden de compra,
 * la pestaña del expediente y el reporte.
 */
export const PILARES_COSTO = ["universidad", "materiales", "transporte", "tramites"] as const;

export type PilarCosto = (typeof PILARES_COSTO)[number];

export function esPilarCosto(valor: unknown): valor is PilarCosto {
  return typeof valor === "string" && (PILARES_COSTO as readonly string[]).includes(valor);
}
