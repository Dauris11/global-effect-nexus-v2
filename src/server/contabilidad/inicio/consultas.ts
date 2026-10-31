import { consultarUna } from "@/lib/db";

/**
 * Lo que espera a alguien del departamento, en una sola ida a la base.
 *
 * Es la primera sección del inicio porque es la decisión que se toma al
 * entrar: qué atender hoy. Cada cifra es un conteo real con su destino; la
 * pantalla dibuja solo las que no están en cero, porque un "0 por revisar" en
 * la lista de trabajo esconde al que sí tiene número.
 *
 * Las cuentas por pagar cuentan solo las que tienen saldo (`pendiente`,
 * `programada`, `pagada_parcial`), y la fecha la pone `CURRENT_DATE` de la base,
 * la misma que decide el período de cada documento.
 */
export type PendientesContables = {
  recibos_borrador: number;
  facturas_borrador: number;
  cxp_vencidas: number;
  cxp_semana: number;
  rendiciones: number;
  arqueos_abiertos: number;
  conciliaciones_abiertas: number;
};

export type ResumenFinancieroFundacion = {
  ingresosMesDop: string;
  egresosMesDop: string;
  disponibleBancosDop: string;
  disponibleCajasDop: string;
  totalLiquidezDop: string;
  compromisosPendientesDop: string;
  requiereFondos: boolean;
  cajasBajasCount: number;
  totalCajas: number;
};

export async function resumenFinancieroFundacion(): Promise<ResumenFinancieroFundacion> {
  const fila = await consultarUna<{
    ingresos_mes_dop: string;
    egresos_mes_dop: string;
    disponible_bancos_dop: string;
    disponible_cajas_dop: string;
    compromisos_pendientes_dop: string;
    cajas_bajas_count: number;
    total_cajas: number;
  }>(
    `SELECT
       COALESCE((
         SELECT SUM(COALESCE(r.monto_dop, r.monto, 0))
         FROM contabilidad.recibo r
         WHERE r.tipo = 'ingreso'
           AND r.estado = 'aprobado'
           AND date_trunc('month', r.fecha) = date_trunc('month', CURRENT_DATE)
       ), 0)::text AS ingresos_mes_dop,

       (
         COALESCE((
           SELECT SUM(COALESCE(r.monto_dop, r.monto, 0))
           FROM contabilidad.recibo r
           WHERE r.tipo = 'egreso'
             AND r.estado = 'aprobado'
             AND date_trunc('month', r.fecha) = date_trunc('month', CURRENT_DATE)
         ), 0) +
         COALESCE((
           SELECT SUM(cm.monto)
           FROM contabilidad.caja_movimiento cm
           WHERE cm.tipo IN ('gasto', 'vale')
             AND cm.estado = 'completado'
             AND date_trunc('month', cm.fecha) = date_trunc('month', CURRENT_DATE)
         ), 0)
       )::text AS egresos_mes_dop,

       COALESCE((
         SELECT SUM(COALESCE(cb.saldo_dop, cb.saldo, 0))
         FROM contabilidad.cuenta_bancaria cb
         WHERE cb.estado = 'activa'
       ), 0)::text AS disponible_bancos_dop,

       COALESCE((
         SELECT SUM(c.saldo_actual)
         FROM contabilidad.caja c
         WHERE c.estado = 'activa'
       ), 0)::text AS disponible_cajas_dop,

       COALESCE((
         SELECT SUM(cxp.saldo)
         FROM contabilidad.cuenta_por_pagar cxp
         WHERE cxp.estado IN ('pendiente', 'programada', 'pagada_parcial')
       ), 0)::text AS compromisos_pendientes_dop,

       COALESCE((
         SELECT count(*)::int
         FROM contabilidad.caja c
         WHERE c.estado = 'activa'
           AND c.saldo_actual < (c.fondo_fijo * 0.25)
       ), 0) AS cajas_bajas_count,

       COALESCE((
         SELECT count(*)::int
         FROM contabilidad.caja c
         WHERE c.estado = 'activa'
       ), 0) AS total_cajas`,
  );

  const bancos = Number(fila?.disponible_bancos_dop ?? 0);
  const cajas = Number(fila?.disponible_cajas_dop ?? 0);
  const totalLiquidez = bancos + cajas;
  const compromisos = Number(fila?.compromisos_pendientes_dop ?? 0);
  const cajasBajas = fila?.cajas_bajas_count ?? 0;

  // Se sugiere solicitar fondos si los compromisos superan la liquidez,
  // o si el saldo total de la fundación está bajo (menor a 50,000 DOP),
  // o si las cajas operativas están desprovistas.
  const requiereFondos = totalLiquidez < compromisos || totalLiquidez < 50000 || cajasBajas > 0;

  return {
    ingresosMesDop: fila?.ingresos_mes_dop ?? "0",
    egresosMesDop: fila?.egresos_mes_dop ?? "0",
    disponibleBancosDop: fila?.disponible_bancos_dop ?? "0",
    disponibleCajasDop: fila?.disponible_cajas_dop ?? "0",
    totalLiquidezDop: totalLiquidez.toFixed(2),
    compromisosPendientesDop: fila?.compromisos_pendientes_dop ?? "0",
    requiereFondos,
    cajasBajasCount: cajasBajas,
    totalCajas: fila?.total_cajas ?? 0,
  };
}

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
            (SELECT count(*)::int FROM contabilidad.arqueo WHERE estado = 'abierto') AS arqueos_abiertos,
            (SELECT count(*)::int FROM contabilidad.conciliacion WHERE estado = 'abierta') AS conciliaciones_abiertas`,
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
    }
  );
}
