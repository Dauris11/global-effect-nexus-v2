import { consultar, consultarUna } from "@/lib/db";
import { UMBRAL_CAJA_BAJA } from "@/lib/contabilidad/cajas";
import type { PeriodoTablero } from "@/lib/contabilidad/tablero";

/**
 * Lecturas del tablero de Contabilidad.
 *
 * Lo que cuenta como ingreso o egreso es lo CONTABILIZADO: un borrador todavía
 * puede cambiar y la reposición de una caja chica no es gasto, es dinero que
 * pasa del banco a la caja; el gasto real es el comprobante que se pagó con
 * ese efectivo. Por eso los egresos suman recibos de egreso que no repusieron
 * una caja, más los gastos de caja chica.
 */

export type PendientesContables = {
  recibos_borrador: number;
  facturas_borrador: number;
  cxp_vencidas: number;
  cxp_semana: number;
  rendiciones: number;
  arqueos_abiertos: number;
  conciliaciones_abiertas: number;
  comprobantes_por_validar: number;
  cajas_bajas: number;
  compras_pendientes: number;
};

export type FlujoMes = { mes: string; ingresos: number; egresos: number };

export type ResumenFlujo = {
  ingresosDop: number;
  egresosDop: number;
  compromisosDop: number;
  cxpPorVencerDop: number;
  serie: FlujoMes[];
};

// El inicio de cada periodo lo calcula la base con su propio CURRENT_DATE,
// el mismo reloj que decide el periodo contable de cada documento.
const DESDE: Record<PeriodoTablero, string> = {
  mes: "date_trunc('month', CURRENT_DATE)",
  trimestre: "date_trunc('quarter', CURRENT_DATE)",
  anio: "date_trunc('year', CURRENT_DATE)",
};

/** Meses que dibuja la gráfica: nunca menos de seis, para que haya tendencia. */
const MESES_GRAFICA: Record<PeriodoTablero, number> = { mes: 6, trimestre: 6, anio: 12 };

export async function resumenFlujo(periodo: PeriodoTablero): Promise<ResumenFlujo> {
  // DESDE es una expresión fija elegida por clave, no un valor del usuario.
  const desde = DESDE[periodo];
  const meses = MESES_GRAFICA[periodo];

  const [totales, serie] = await Promise.all([
    consultarUna<{ ingresos: string; egresos: string; compromisos: string; por_vencer: string }>(
      `SELECT
         COALESCE((SELECT SUM(COALESCE(r.monto_dop, r.monto)) FROM contabilidad.recibo r
                    WHERE r.tipo = 'ingreso' AND r.estado = 'contabilizado'
                      AND r.fecha >= ${desde}), 0)::text AS ingresos,
         (COALESCE((SELECT SUM(COALESCE(r.monto_dop, r.monto)) FROM contabilidad.recibo r
                     WHERE r.tipo = 'egreso' AND r.estado = 'contabilizado'
                       AND r.fecha >= ${desde}
                       AND NOT EXISTS (SELECT 1 FROM contabilidad.caja_movimiento m
                                        WHERE m.recibo_id = r.id)), 0)
          + COALESCE((SELECT SUM(m.monto) FROM contabilidad.caja_movimiento m
                       WHERE m.tipo = 'gasto' AND m.estado <> 'anulado'
                         AND m.fecha >= ${desde}), 0))::text AS egresos,
         COALESCE((SELECT SUM(saldo) FROM contabilidad.cuenta_por_pagar
                    WHERE estado IN ('pendiente', 'programada', 'pagada_parcial')), 0)::text AS compromisos,
         COALESCE((SELECT SUM(saldo) FROM contabilidad.cuenta_por_pagar
                    WHERE estado IN ('pendiente', 'programada', 'pagada_parcial')
                      AND fecha_vencimiento <= CURRENT_DATE + 7), 0)::text AS por_vencer`,
    ),
    consultar<{ mes: string; ingresos: string; egresos: string }>(
      `WITH meses AS (
         SELECT generate_series(date_trunc('month', CURRENT_DATE) - ($1::int - 1) * interval '1 month',
                                date_trunc('month', CURRENT_DATE), interval '1 month')::date AS mes
       )
       SELECT to_char(meses.mes, 'YYYY-MM') AS mes,
              COALESCE((SELECT SUM(COALESCE(r.monto_dop, r.monto)) FROM contabilidad.recibo r
                         WHERE r.tipo = 'ingreso' AND r.estado = 'contabilizado'
                           AND date_trunc('month', r.fecha) = meses.mes), 0)::text AS ingresos,
              (COALESCE((SELECT SUM(COALESCE(r.monto_dop, r.monto)) FROM contabilidad.recibo r
                          WHERE r.tipo = 'egreso' AND r.estado = 'contabilizado'
                            AND date_trunc('month', r.fecha) = meses.mes
                            AND NOT EXISTS (SELECT 1 FROM contabilidad.caja_movimiento m
                                             WHERE m.recibo_id = r.id)), 0)
               + COALESCE((SELECT SUM(m.monto) FROM contabilidad.caja_movimiento m
                            WHERE m.tipo = 'gasto' AND m.estado <> 'anulado'
                              AND date_trunc('month', m.fecha) = meses.mes), 0))::text AS egresos
         FROM meses
        ORDER BY meses.mes`,
      [meses],
    ),
  ]);

  return {
    ingresosDop: Number(totales?.ingresos ?? 0),
    egresosDop: Number(totales?.egresos ?? 0),
    compromisosDop: Number(totales?.compromisos ?? 0),
    cxpPorVencerDop: Number(totales?.por_vencer ?? 0),
    serie: serie.map((f) => ({ mes: f.mes, ingresos: Number(f.ingresos), egresos: Number(f.egresos) })),
  };
}

/**
 * Lo que espera a alguien del departamento, en una sola ida a la base. La
 * pantalla dibuja solo lo que no está en cero.
 */
export async function pendientesDelDepartamento(): Promise<PendientesContables> {
  const fila = await consultarUna<PendientesContables>(
    `SELECT (SELECT count(*)::int FROM contabilidad.recibo WHERE estado = 'borrador') AS recibos_borrador,
            (SELECT count(*)::int FROM contabilidad.factura_proveedor WHERE estado = 'borrador') AS facturas_borrador,
            (SELECT count(*)::int FROM contabilidad.cuenta_por_pagar
              WHERE estado IN ('pendiente', 'programada', 'pagada_parcial')
                AND fecha_vencimiento < CURRENT_DATE) AS cxp_vencidas,
            (SELECT count(*)::int FROM contabilidad.cuenta_por_pagar
              WHERE estado IN ('pendiente', 'programada', 'pagada_parcial')
                AND fecha_vencimiento BETWEEN CURRENT_DATE AND CURRENT_DATE + 7) AS cxp_semana,
            (SELECT count(*)::int FROM public.rendicion_gasto
              WHERE estado IN ('enviada', 'en_revision')) AS rendiciones,
            (SELECT count(*)::int FROM contabilidad.arqueo
              WHERE estado IN ('abierto', 'cerrado')) AS arqueos_abiertos,
            (SELECT count(*)::int FROM contabilidad.conciliacion WHERE estado = 'abierta') AS conciliaciones_abiertas,
            (SELECT count(*)::int FROM contabilidad.comprobante_recibido
              WHERE estado IN ('recibido', 'observado')) AS comprobantes_por_validar,
            (SELECT count(*)::int FROM contabilidad.caja
              WHERE estado = 'activa' AND saldo_actual < fondo_fijo * $1) AS cajas_bajas,
            -- Los mismos estados que la bandeja de solicitudes trae para quien
            -- aprueba en contabilidad. 'pendiente' no es un estado de
            -- solicitud: con él las compras recién enviadas nunca se contaban.
            (SELECT count(*)::int FROM public.solicitud
              WHERE tipo IN ('compra', 'gasto')
                AND estado IN ('enviada', 'en_revision', 'aprobada')) AS compras_pendientes`,
    [UMBRAL_CAJA_BAJA],
  );

  return (
    fila ?? {
      recibos_borrador: 0,
      facturas_borrador: 0,
      cxp_vencidas: 0,
      cxp_semana: 0,
      rendiciones: 0,
      arqueos_abiertos: 0,
      conciliaciones_abiertas: 0,
      comprobantes_por_validar: 0,
      cajas_bajas: 0,
      compras_pendientes: 0,
    }
  );
}
