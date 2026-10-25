import { consultar, consultarUna } from "@/lib/db";

export type ComprobanteRetencionItem = {
  id: string;
  numero: number;
  secuenciaInterna: string;
  facturaId: string;
  facturaNumero: number;
  ncfFactura: string | null;
  proveedorId: string;
  proveedorNombre: string;
  proveedorRnc: string;
  proveedorDireccion: string | null;
  fechaEmision: string;
  periodoFiscal: string;
  montoFacturado: number;
  itbisFacturado: number;
  montoSujetoItbis: number;
  itbisRetenido: number;
  tasaItbisRetenido: number;
  montoSujetoIsr: number;
  isrRetenido: number;
  tasaIsrRetenido: number;
  concepto: string;
  estado: "emitido" | "anulado";
  emitidoPorNombre: string;
  creadoEn: string;
};

export async function listarComprobantesRetencion(opciones?: {
  periodo?: string;
  proveedorId?: string;
  limite?: number;
}): Promise<ComprobanteRetencionItem[]> {
  const params: unknown[] = [];
  let condiciones = "WHERE 1=1";

  if (opciones?.periodo) {
    params.push(opciones.periodo);
    condiciones += ` AND cr.periodo_fiscal = $${params.length}`;
  }
  if (opciones?.proveedorId) {
    params.push(opciones.proveedorId);
    condiciones += ` AND cr.proveedor_id = $${params.length}`;
  }

  const limite = opciones?.limite ?? 50;
  params.push(limite);

  const sql = `
    SELECT
      cr.id,
      cr.numero,
      cr.secuencia_interna AS "secuenciaInterna",
      cr.factura_id AS "facturaId",
      fp.numero AS "facturaNumero",
      fp.ncf AS "ncfFactura",
      cr.proveedor_id AS "proveedorId",
      pr.nombre AS "proveedorNombre",
      pr.identificacion AS "proveedorRnc",
      pr.direccion AS "proveedorDireccion",
      cr.fecha_emision::text AS "fechaEmision",
      cr.periodo_fiscal AS "periodoFiscal",
      cr.monto_facturado::float AS "montoFacturado",
      cr.itbis_facturado::float AS "itbisFacturado",
      cr.monto_sujeto_itbis::float AS "montoSujetoItbis",
      cr.itbis_retenido::float AS "itbisRetenido",
      cr.tasa_itbis_retenido::float AS "tasaItbisRetenido",
      cr.monto_sujeto_isr::float AS "montoSujetoIsr",
      cr.isr_retenido::float AS "isrRetenido",
      cr.tasa_isr_retenido::float AS "tasaIsrRetenido",
      cr.concepto,
      cr.estado,
      u.nombre_completo AS "emitidoPorNombre",
      cr.creado_en AS "creadoEn"
    FROM contabilidad.comprobante_retencion cr
    JOIN contabilidad.proveedor pr ON pr.id = cr.proveedor_id
    JOIN contabilidad.factura_proveedor fp ON fp.id = cr.factura_id
    JOIN public.usuario u ON u.id = cr.emitido_por
    ${condiciones}
    ORDER BY cr.fecha_emision DESC, cr.numero DESC
    LIMIT $${params.length}
  `;

  return consultar<ComprobanteRetencionItem>(sql, params);
}

export async function obtenerComprobanteRetencion(id: string): Promise<ComprobanteRetencionItem | null> {
  const sql = `
    SELECT
      cr.id,
      cr.numero,
      cr.secuencia_interna AS "secuenciaInterna",
      cr.factura_id AS "facturaId",
      fp.numero AS "facturaNumero",
      fp.ncf AS "ncfFactura",
      cr.proveedor_id AS "proveedorId",
      pr.nombre AS "proveedorNombre",
      pr.identificacion AS "proveedorRnc",
      pr.direccion AS "proveedorDireccion",
      cr.fecha_emision::text AS "fechaEmision",
      cr.periodo_fiscal AS "periodoFiscal",
      cr.monto_facturado::float AS "montoFacturado",
      cr.itbis_facturado::float AS "itbisFacturado",
      cr.monto_sujeto_itbis::float AS "montoSujetoItbis",
      cr.itbis_retenido::float AS "itbisRetenido",
      cr.tasa_itbis_retenido::float AS "tasaItbisRetenido",
      cr.monto_sujeto_isr::float AS "montoSujetoIsr",
      cr.isr_retenido::float AS "isrRetenido",
      cr.tasa_isr_retenido::float AS "tasaIsrRetenido",
      cr.concepto,
      cr.estado,
      u.nombre_completo AS "emitidoPorNombre",
      cr.creado_en AS "creadoEn"
    FROM contabilidad.comprobante_retencion cr
    JOIN contabilidad.proveedor pr ON pr.id = cr.proveedor_id
    JOIN contabilidad.factura_proveedor fp ON fp.id = cr.factura_id
    JOIN public.usuario u ON u.id = cr.emitido_por
    WHERE cr.id = $1
  `;
  return consultarUna<ComprobanteRetencionItem>(sql, [id]);
}
