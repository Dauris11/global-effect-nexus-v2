import type { PoolClient } from "pg";

import {
  construirLineasPorCodigo,
  previsualizarLineasPorCodigo,
  type LineaAsiento,
  type Partida,
} from "@/server/contabilidad/codigos-transaccion/asiento";

/**
 * Partidas del asiento de inventario. Viven aparte de `acciones.ts`
 * ("use server" solo admite funciones async exportadas) y las comparten el
 * movimiento real, la toma física y sus vistas «Asiento», para que ambos
 * armen exactamente lo mismo.
 */

/** Salida por consumo: gasto contra existencias, al costo promedio. */
export function partidasDeConsumo(nombreArticulo: string, costoTotal: number): Partida[] {
  return [
    { codigo: "INV_CONSUMO_GASTO", monto: costoTotal, descripcion: `Consumo de ${nombreArticulo}` },
    { codigo: "INV_CONSUMO_EXISTENCIAS", monto: costoTotal, descripcion: `Salida de almacén ${nombreArticulo}` },
  ];
}

/**
 * Ajuste de una toma física. El impacto neto positivo es sobrante (sube las
 * existencias contra una ganancia); el negativo, faltante (pérdida contra
 * existencias). Son códigos distintos porque cada código tiene un solo lado.
 * Con impacto cero no hay asiento.
 */
export function partidasDeAjusteConteo(impactoNeto: number): Partida[] {
  const monto = Math.abs(Math.round(impactoNeto * 100) / 100);
  if (monto === 0) return [];
  return impactoNeto > 0
    ? [
        { codigo: "INV_SOBRANTE_EXISTENCIAS", monto, descripcion: "Ajuste sobrante de inventario físico" },
        { codigo: "INV_SOBRANTE_GANANCIA", monto, descripcion: "Ganancia por ajuste sobrante físico" },
      ]
    : [
        { codigo: "INV_FALTANTE_PERDIDA", monto, descripcion: "Gasto / pérdida por faltante de inventario" },
        { codigo: "INV_FALTANTE_EXISTENCIAS", monto, descripcion: "Ajuste faltante de inventario físico" },
      ];
}

/**
 * Líneas definitivas del consumo, más cuál lleva el centro de costo.
 *
 * `crear_asiento` no acepta centro de costo en sus líneas, y el gasto debe
 * imputarse a un programa; por eso el consumo inserta sus líneas a mano. El
 * motor las devuelve en el mismo orden que la previa (mismo algoritmo), así
 * que el índice de la previa que contiene el código de gasto es el de la línea
 * que lleva el centro. `construirLineasPorCodigo` falla si falta una cuenta.
 */
export async function lineasDeConsumo(
  cliente: PoolClient,
  partidas: Partida[],
): Promise<{ lineas: LineaAsiento[]; indiceGasto: number }> {
  const previa = await previsualizarLineasPorCodigo(cliente, partidas);
  const lineas = await construirLineasPorCodigo(cliente, partidas);
  const indiceGasto = previa.lineas.findIndex((l) => l.codigos.includes("INV_CONSUMO_GASTO"));
  return { lineas, indiceGasto };
}
