import type { PoolClient } from "pg";

import type { Partida } from "@/server/contabilidad/codigos-transaccion/asiento";
import { ErrorOperacion } from "@/server/contabilidad/operaciones/errores";

/**
 * Cálculo y partidas de la depreciación mensual. Vive aparte de `acciones.ts`
 * ("use server" solo admite funciones async exportadas) y lo comparten la
 * corrida real y la vista «Asiento», para que ambas armen lo mismo.
 */

export type LineaDepreciacion = {
  activoId: string;
  monto: number;
  deprecPrevia: number;
  nuevoValorLibros: number;
  totalmenteDepreciado: boolean;
  nuevosMeses: number;
};

export type PlanDepreciacion = { lineas: LineaDepreciacion[]; totalDepreciado: number };

/** Cuota de cada activo depreciable a la fecha; no escribe nada. */
export async function planDeDepreciacion(cliente: PoolClient, fechaAsiento: string): Promise<PlanDepreciacion> {
  const { rows: activos } = await cliente.query<{
    id: string;
    costo_adquisicion: string;
    valor_residual: string;
    depreciacion_acumulada: string;
    valor_en_libros: string;
    meses_depreciados: number;
    vida_util_meses: number;
  }>(
    `SELECT af.id,
            af.costo_adquisicion::text AS costo_adquisicion,
            af.valor_residual::text AS valor_residual,
            af.depreciacion_acumulada::text AS depreciacion_acumulada,
            af.valor_en_libros::text AS valor_en_libros,
            af.meses_depreciados,
            ca.vida_util_meses
       FROM contabilidad.activo_fijo af
       JOIN contabilidad.activo_categoria ca ON ca.id = af.categoria_id
      WHERE af.estado = 'activo'
        AND af.valor_en_libros > af.valor_residual
        AND af.fecha_adquisicion <= $1::date
      ORDER BY af.codigo ASC`,
    [fechaAsiento],
  );

  const lineas: LineaDepreciacion[] = [];
  let totalDepreciado = 0;
  for (const act of activos) {
    const costo = Number(act.costo_adquisicion);
    const residual = Number(act.valor_residual);
    const valorLibros = Number(act.valor_en_libros);

    const cuotaRedondeada = Math.round(((costo - residual) / act.vida_util_meses) * 100) / 100;
    const saldoDepreciable = valorLibros - residual;
    const cuotaEfectiva = Math.min(cuotaRedondeada, Math.max(0, saldoDepreciable));
    if (cuotaEfectiva <= 0) continue;

    const nuevoValorLibros = Math.round((valorLibros - cuotaEfectiva) * 100) / 100;
    lineas.push({
      activoId: act.id,
      monto: cuotaEfectiva,
      deprecPrevia: Number(act.depreciacion_acumulada),
      nuevoValorLibros,
      totalmenteDepreciado: nuevoValorLibros <= residual,
      nuevosMeses: act.meses_depreciados + 1,
    });
    totalDepreciado += cuotaEfectiva;
  }
  return { lineas, totalDepreciado: Math.round(totalDepreciado * 100) / 100 };
}

/**
 * Gasto de depreciación contra depreciación acumulada, por el total del mes.
 * Antes iban por el par de cuentas de cada categoría; ahora son dos códigos
 * globales (AF_DEPRECIACION_*), que la contadora asigna una sola vez.
 */
export function partidasDeDepreciacion(total: number, mes: number, anio: number): Partida[] {
  return [
    { codigo: "AF_DEPRECIACION_GASTO", monto: total, descripcion: `Gasto depreciación activos período ${mes}/${anio}` },
    { codigo: "AF_DEPRECIACION_ACUMULADA", monto: total, descripcion: `Depreciación acumulada activos período ${mes}/${anio}` },
  ];
}

/**
 * ¿Los dos códigos apuntan a la misma cuenta? Un asiento con la misma cuenta a
 * los dos lados no depreciaría nada: era lo que el catálogo viejo dejaba (todo
 * en 5.4.12) y por eso se rechaza en vez de contabilizar un engaño.
 */
export async function depreciacionConMismaCuenta(cliente: PoolClient): Promise<boolean> {
  const { rows } = await cliente.query<{ cuenta_id: string | null }>(
    `SELECT cuenta_id FROM contabilidad.codigo_transaccion
      WHERE codigo IN ('AF_DEPRECIACION_GASTO', 'AF_DEPRECIACION_ACUMULADA')`,
  );
  return rows.length === 2 && rows[0].cuenta_id !== null && rows[0].cuenta_id === rows[1].cuenta_id;
}

export async function exigirCuentasDistintas(cliente: PoolClient): Promise<void> {
  if (await depreciacionConMismaCuenta(cliente)) throw new ErrorOperacion("depreciacion_misma_cuenta");
}
