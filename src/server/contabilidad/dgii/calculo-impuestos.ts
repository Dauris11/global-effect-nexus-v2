import { consultar, consultarUna } from "@/lib/db";

export type ResumenIt1 = {
  periodo: string;
  ingresosExentosAsfl: number;
  ingresosGravados: number;
  itbisFacturado: number;
  itbisDeducibleCompras: number;
  itbisRetenidoProveedores: number;
  saldoAPagar: number;
  saldoAFavor: number;
};

export type ResumenIr17 = {
  periodo: string;
  baseServiciosHonorarios: number;
  retencionHonorarios: number;
  baseAlquileres: number;
  retencionAlquileres: number;
  otrasRetenciones: number;
  totalRetenidoAPagar: number;
};

export type ResumenIsfl01 = {
  ejercicio: number;
  donacionesEfectivoExentas: number;
  donacionesEspecieExentas: number;
  ingresosActividadesGravadas: number;
  totalIngresos: number;
  gastosProgramasSociales: number;
  gastosOperativos: number;
  totalGastos: number;
  superavitDeficit: number;
};

export async function calcularIt1(periodoIso: string): Promise<ResumenIt1> {
  // Donaciones exentas del período
  const don = await consultarUna<{ total: string }>(
    `SELECT COALESCE(SUM(d.monto_dop), 0)::text AS total
     FROM contabilidad.donacion d
     JOIN contabilidad.periodo_contable pc ON pc.id = d.periodo_id
     WHERE to_char(make_date(pc.anio, pc.mes, 1), 'YYYY-MM') = $1 AND d.estado = 'confirmada' AND d.tratamiento = 'exento'`,
    [periodoIso]
  );
  const ingresosExentos = Number(don?.total ?? 0);

  // Donaciones o ventas gravadas
  const grav = await consultarUna<{ total: string }>(
    `SELECT COALESCE(SUM(d.monto_dop), 0)::text AS total
     FROM contabilidad.donacion d
     JOIN contabilidad.periodo_contable pc ON pc.id = d.periodo_id
     WHERE to_char(make_date(pc.anio, pc.mes, 1), 'YYYY-MM') = $1 AND d.estado = 'confirmada' AND d.tratamiento = 'gravado'`,
    [periodoIso]
  );
  const ingresosGravados = Number(grav?.total ?? 0);

  // Compras y retenciones del período
  const fac = await consultarUna<{ itbis: string; ret_itbis: string }>(
    `SELECT COALESCE(SUM(fp.itbis), 0)::text AS itbis,
            COALESCE(SUM(fp.retencion_itbis), 0)::text AS ret_itbis
     FROM contabilidad.factura_proveedor fp
     JOIN contabilidad.periodo_contable pc ON pc.id = fp.periodo_id
     WHERE to_char(make_date(pc.anio, pc.mes, 1), 'YYYY-MM') = $1 AND fp.estado = 'aprobada'`,
    [periodoIso]
  );

  const itbisCompras = Number(fac?.itbis ?? 0);
  const itbisRetenido = Number(fac?.ret_itbis ?? 0);

  // Para una ASFL el ITBIS pagado en compras suele llevarse al costo, y se paga a la DGII el ITBIS retenido a terceros
  const saldoAPagar = itbisRetenido;

  return {
    periodo: periodoIso,
    ingresosExentosAsfl: ingresosExentos,
    ingresosGravados,
    itbisFacturado: 0,
    itbisDeducibleCompras: itbisCompras,
    itbisRetenidoProveedores: itbisRetenido,
    saldoAPagar,
    saldoAFavor: 0,
  };
}

export async function calcularIr17(periodoIso: string): Promise<ResumenIr17> {
  const res = await consultarUna<{ base: string; ret: string }>(
    `SELECT
       COALESCE(SUM(fp.subtotal), 0)::text AS base,
       COALESCE(SUM(fp.retencion_isr), 0)::text AS ret
     FROM contabilidad.factura_proveedor fp
     JOIN contabilidad.periodo_contable pc ON pc.id = fp.periodo_id
     WHERE to_char(make_date(pc.anio, pc.mes, 1), 'YYYY-MM') = $1 AND fp.estado = 'aprobada' AND fp.retencion_isr > 0`,
    [periodoIso]
  );

  const base = Number(res?.base ?? 0);
  const ret = Number(res?.ret ?? 0);

  return {
    periodo: periodoIso,
    baseServiciosHonorarios: base,
    retencionHonorarios: ret,
    baseAlquileres: 0,
    retencionAlquileres: 0,
    otrasRetenciones: 0,
    totalRetenidoAPagar: ret,
  };
}

export async function calcularIsfl01(ejercicio: number): Promise<ResumenIsfl01> {
  const anioStr = String(ejercicio);

  const donEfectivo = await consultarUna<{ total: string }>(
    `SELECT COALESCE(SUM(d.monto_dop), 0)::text AS total
     FROM contabilidad.donacion d
     WHERE d.fecha >= '${anioStr}-01-01' AND d.fecha <= '${anioStr}-12-31'
       AND d.clase = 'efectivo' AND d.estado = 'confirmada'`
  );

  const donEspecie = await consultarUna<{ total: string }>(
    `SELECT COALESCE(SUM(d.monto_dop), 0)::text AS total
     FROM contabilidad.donacion d
     WHERE d.fecha >= '${anioStr}-01-01' AND d.fecha <= '${anioStr}-12-31'
       AND d.clase = 'especie' AND d.estado = 'confirmada'`
  );

  const gastos = await consultarUna<{ total: string }>(
    `SELECT COALESCE(SUM(fp.subtotal), 0)::text AS total
     FROM contabilidad.factura_proveedor fp
     WHERE fp.fecha_emision >= '${anioStr}-01-01' AND fp.fecha_emision <= '${anioStr}-12-31'
       AND fp.estado = 'aprobada'`
  );

  const ef = Number(donEfectivo?.total ?? 0);
  const es = Number(donEspecie?.total ?? 0);
  const gst = Number(gastos?.total ?? 0);
  const totalIng = ef + es;

  return {
    ejercicio,
    donacionesEfectivoExentas: ef,
    donacionesEspecieExentas: es,
    ingresosActividadesGravadas: 0,
    totalIngresos: totalIng,
    gastosProgramasSociales: Number((gst * 0.85).toFixed(2)),
    gastosOperativos: Number((gst * 0.15).toFixed(2)),
    totalGastos: gst,
    superavitDeficit: Number((totalIng - gst).toFixed(2)),
  };
}
