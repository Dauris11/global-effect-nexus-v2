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
