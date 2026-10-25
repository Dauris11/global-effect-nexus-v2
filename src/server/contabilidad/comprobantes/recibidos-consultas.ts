import { consultar, consultarUna } from "@/lib/db";

export type ComprobanteRecibidoFila = {
  id: string;
  folio: number;
  mensaje_id: string | null;
  remitente_id: string;
  remitente_nombre: string;
  remitente_email: string;
  documento_id: string | null;
  archivo_url: string | null;
  archivo_sha256: string | null;
  monto: number;
  moneda: "DOP" | "USD";
  itbis: number;
  proveedor_nombre: string | null;
  proveedor_rnc: string | null;
  ncf: string | null;
  tipo_ncf: string | null;
  fecha_comprobante: string;
  concepto: string;
  categoria: string;
  centro_costo_id: string | null;
  centro_costo_nombre: string | null;
  fondo_id: string | null;
  fondo_nombre: string | null;
  proyecto_id: string | null;
  proyecto_nombre: string | null;
  caja_id: string | null;
  caja_nombre: string | null;
  ocr_datos: Record<string, unknown> | null;
  estado: "recibido" | "validado" | "observado" | "rechazado" | "contabilizado";
  asiento_id: string | null;
  asiento_numero: number | null;
  observaciones: string | null;
  revisado_por: string | null;
  revisado_por_nombre: string | null;
  revisado_en: string | null;
  created_at: string;
};

/**
 * Lista los comprobantes recibidos con filtros de estado y búsqueda.
 */
export async function listarComprobantesRecibidos(filtros?: {
  estado?: string;
  categoria?: string;
  busqueda?: string;
  limite?: number;
}): Promise<ComprobanteRecibidoFila[]> {
  const condiciones: string[] = [];
  const params: unknown[] = [];

  if (filtros?.estado && filtros.estado !== "todos") {
    params.push(filtros.estado);
    condiciones.push(`cr.estado = $${params.length}`);
  }

  if (filtros?.categoria && filtros.categoria !== "todas") {
    params.push(filtros.categoria);
    condiciones.push(`cr.categoria = $${params.length}`);
  }

  if (filtros?.busqueda) {
    params.push(`%${filtros.busqueda.trim()}%`);
    condiciones.push(
      `(cr.concepto ILIKE $${params.length} OR cr.proveedor_nombre ILIKE $${params.length} OR cr.ncf ILIKE $${params.length} OR u.nombre ILIKE $${params.length})`,
    );
  }

  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";
  const limite = filtros?.limite ?? 50;
  params.push(limite);

  return consultar<ComprobanteRecibidoFila>(
    `SELECT cr.id,
            cr.folio,
            cr.mensaje_id,
            cr.remitente_id,
            u.nombre AS remitente_nombre,
            u.email::text AS remitente_email,
            cr.documento_id,
            cr.archivo_url,
            cr.archivo_sha256,
            cr.monto,
            cr.moneda,
            cr.itbis,
            cr.proveedor_nombre,
            cr.proveedor_rnc,
            cr.ncf,
            cr.tipo_ncf,
            cr.fecha_comprobante::text,
            cr.concepto,
            cr.categoria,
            cr.centro_costo_id,
            cc.nombre AS centro_costo_nombre,
            cr.fondo_id,
            f.nombre AS fondo_nombre,
            cr.proyecto_id,
            p.nombre AS proyecto_nombre,
            cr.caja_id,
            cj.nombre AS caja_nombre,
            cr.ocr_datos,
            cr.estado,
            cr.asiento_id,
            a.numero AS asiento_numero,
            cr.observaciones,
            cr.revisado_por,
            rev.nombre AS revisado_por_nombre,
            cr.revisado_en::text,
            cr.created_at::text
       FROM contabilidad.comprobante_recibido cr
       JOIN public.usuario u ON u.id = cr.remitente_id
       LEFT JOIN contabilidad.centro_costo cc ON cc.id = cr.centro_costo_id
       LEFT JOIN contabilidad.fondo f ON f.id = cr.fondo_id
       LEFT JOIN public.proyecto p ON p.id = cr.proyecto_id
       LEFT JOIN contabilidad.caja cj ON cj.id = cr.caja_id
       LEFT JOIN contabilidad.asiento a ON a.id = cr.asiento_id
       LEFT JOIN public.usuario rev ON rev.id = cr.revisado_por
      ${where}
      ORDER BY cr.created_at DESC
      LIMIT $${params.length}`,
    params,
  );
}

/**
 * Obtiene un comprobante recibido por su ID.
 */
export async function obtenerComprobanteRecibido(
  id: string,
): Promise<ComprobanteRecibidoFila | null> {
  return consultarUna<ComprobanteRecibidoFila>(
    `SELECT cr.id,
            cr.folio,
            cr.mensaje_id,
            cr.remitente_id,
            u.nombre AS remitente_nombre,
            u.email::text AS remitente_email,
            cr.documento_id,
            cr.archivo_url,
            cr.archivo_sha256,
            cr.monto,
            cr.moneda,
            cr.itbis,
            cr.proveedor_nombre,
            cr.proveedor_rnc,
            cr.ncf,
            cr.tipo_ncf,
            cr.fecha_comprobante::text,
            cr.concepto,
            cr.categoria,
            cr.centro_costo_id,
            cc.nombre AS centro_costo_nombre,
            cr.fondo_id,
            f.nombre AS fondo_nombre,
            cr.proyecto_id,
            p.nombre AS proyecto_nombre,
            cr.caja_id,
            cj.nombre AS caja_nombre,
            cr.ocr_datos,
            cr.estado,
            cr.asiento_id,
            a.numero AS asiento_numero,
            cr.observaciones,
            cr.revisado_por,
            rev.nombre AS revisado_por_nombre,
            cr.revisado_en::text,
            cr.created_at::text
       FROM contabilidad.comprobante_recibido cr
       JOIN public.usuario u ON u.id = cr.remitente_id
       LEFT JOIN contabilidad.centro_costo cc ON cc.id = cr.centro_costo_id
       LEFT JOIN contabilidad.fondo f ON f.id = cr.fondo_id
       LEFT JOIN public.proyecto p ON p.id = cr.proyecto_id
       LEFT JOIN contabilidad.caja cj ON cj.id = cr.caja_id
       LEFT JOIN contabilidad.asiento a ON a.id = cr.asiento_id
       LEFT JOIN public.usuario rev ON rev.id = cr.revisado_por
      WHERE cr.id = $1`,
    [id],
  );
}
