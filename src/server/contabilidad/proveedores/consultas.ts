import { consultar, consultarUna } from "@/lib/db";
import { esUuid, type Moneda } from "@/lib/contabilidad/formato";

/**
 * Proveedores, sus cuentas bancarias y sus facturas (§4.4).
 *
 * Montos como TEXTO, igual que en todo el módulo. El saldo de un proveedor
 * se da por moneda: lo que se le debe en pesos y en dólares no se suma.
 */

export type FilaProveedor = {
  id: string;
  tipo: "fisica" | "juridica";
  identificacion: string;
  nombre: string;
  nombre_comercial: string | null;
  estado: "activo" | "inactivo";
  condiciones_pago_dias: number;
  /** "DOP:1500.00|USD:20.00": saldo pendiente por moneda. */
  saldos: { moneda: Moneda; saldo: string }[];
  facturas: number;
};

export async function proveedores(texto: string | null): Promise<FilaProveedor[]> {
  return consultar<FilaProveedor>(
    `SELECT p.id, p.tipo, p.identificacion, p.nombre, p.nombre_comercial, p.estado,
            p.condiciones_pago_dias,
            coalesce((SELECT json_agg(json_build_object('moneda', s.moneda, 'saldo', s.saldo::text))
                        FROM (SELECT x.moneda, sum(x.saldo) AS saldo
                                FROM contabilidad.cuenta_por_pagar x
                               WHERE x.proveedor_id = p.id AND x.estado NOT IN ('pagada', 'anulada')
                               GROUP BY x.moneda) s), '[]'::json) AS saldos,
            (SELECT count(*)::int FROM contabilidad.factura_proveedor f WHERE f.proveedor_id = p.id) AS facturas
       FROM contabilidad.proveedor p
      WHERE $1::text IS NULL
         OR p.nombre ILIKE '%' || $1 || '%'
         OR p.nombre_comercial ILIKE '%' || $1 || '%'
         OR p.identificacion LIKE '%' || regexp_replace($1, '[^0-9]', '', 'g') || '%'
      ORDER BY p.estado, p.nombre
      LIMIT 300`,
    [texto],
  );
}

export type DetalleProveedor = {
  id: string;
  tipo: "fisica" | "juridica";
  identificacion: string;
  nombre: string;
  nombre_comercial: string | null;
  contacto: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  condiciones_pago_dias: number;
  categoria_id: string | null;
  categoria: string | null;
  estado: "activo" | "inactivo";
  creado_por: string;
};

export async function proveedorPorId(id: string): Promise<DetalleProveedor | null> {
  if (!esUuid(id)) return null;
  return consultarUna<DetalleProveedor>(
    `SELECT p.id, p.tipo, p.identificacion, p.nombre, p.nombre_comercial, p.contacto, p.telefono,
            p.email, p.direccion, p.condiciones_pago_dias, p.categoria_id, c.nombre AS categoria,
            p.estado, u.nombre AS creado_por
       FROM contabilidad.proveedor p
       JOIN usuario u ON u.id = p.creado_por
       LEFT JOIN contabilidad.categoria c ON c.id = p.categoria_id
      WHERE p.id = $1`,
    [id],
  );
}

export type CuentaProveedor = {
  id: string;
  banco: string;
  tipo: "corriente" | "ahorro";
  moneda: Moneda;
  numero: string;
  activa: boolean;
  creado_por: string;
  creado_en: string;
  reemplazada_en: string | null;
};

/** Todas, también las reemplazadas: el historial es lo que se audita. */
export async function cuentasDeProveedor(id: string): Promise<CuentaProveedor[]> {
  return consultar<CuentaProveedor>(
    `SELECT c.id, c.banco, c.tipo, c.moneda, c.numero, c.activa, u.nombre AS creado_por,
            to_char(c.creado_en AT TIME ZONE 'America/Santo_Domingo', 'YYYY-MM-DD') AS creado_en,
            to_char(c.reemplazada_en AT TIME ZONE 'America/Santo_Domingo', 'YYYY-MM-DD') AS reemplazada_en
       FROM contabilidad.proveedor_cuenta_bancaria c
       JOIN usuario u ON u.id = c.creado_por
      WHERE c.proveedor_id = $1
      ORDER BY c.activa DESC, c.creado_en DESC`,
    [id],
  );
}

export type FilaFactura = {
  id: string;
  numero: string;
  ncf: string | null;
  fecha_emision: string;
  fecha_vencimiento: string;
  moneda: Moneda;
  total: string;
  neto: string;
  concepto: string;
  estado: "borrador" | "aprobada" | "anulada";
  cxp_id: string | null;
  saldo: string | null;
};

export async function facturasDeProveedor(id: string): Promise<FilaFactura[]> {
  return consultar<FilaFactura>(
    `SELECT f.id, f.numero::text AS numero, f.ncf, f.fecha_emision::text AS fecha_emision,
            f.fecha_vencimiento::text AS fecha_vencimiento, f.moneda, f.total::text AS total,
            f.neto::text AS neto, f.concepto, f.estado, x.id AS cxp_id, x.saldo::text AS saldo
       FROM contabilidad.factura_proveedor f
       LEFT JOIN contabilidad.cuenta_por_pagar x ON x.id = f.cuenta_por_pagar_id
      WHERE f.proveedor_id = $1
      ORDER BY f.fecha_emision DESC, f.numero DESC`,
    [id],
  );
}

export type MovimientoEstadoCuenta = {
  fecha: string;
  tipo: "factura" | "pago";
  documento: string;
  moneda: Moneda;
  cargo: string | null;
  abono: string | null;
  saldo: string;
};

/**
 * Estado de cuenta del proveedor (§4.4): facturas aprobadas como cargo y
 * pagos como abono, con saldo corrido por moneda. Lo anulado no aparece:
 * nunca fue deuda.
 */
export async function estadoDeCuenta(id: string): Promise<MovimientoEstadoCuenta[]> {
  return consultar<MovimientoEstadoCuenta>(
    `WITH partidas AS (
       SELECT f.fecha_emision AS fecha, 'factura'::text AS tipo,
              'FP-' || lpad(f.numero::text, 6, '0') || coalesce(' · ' || f.ncf, '') AS documento,
              f.moneda, f.neto AS cargo, NULL::numeric AS abono, f.aprobado_en AS orden
         FROM contabilidad.factura_proveedor f
        WHERE f.proveedor_id = $1 AND f.estado = 'aprobada'
       UNION ALL
       SELECT p.fecha, 'pago', 'PG-' || lpad(p.numero::text, 6, '0'), x.moneda, NULL, p.monto, p.creado_en
         FROM contabilidad.pago p
         JOIN contabilidad.cuenta_por_pagar x ON x.id = p.cuenta_por_pagar_id
        WHERE x.proveedor_id = $1
     )
     SELECT fecha::text AS fecha, tipo, documento, moneda, cargo::text AS cargo, abono::text AS abono,
            sum(coalesce(cargo, 0) - coalesce(abono, 0))
              OVER (PARTITION BY moneda ORDER BY fecha, orden)::text AS saldo
       FROM partidas
      ORDER BY moneda, fecha, orden`,
    [id],
  );
}

export type DetalleFactura = FilaFactura & {
  proveedor_id: string;
  proveedor: string;
  proveedor_tipo: "fisica" | "juridica";
  tasa: string | null;
  subtotal: string;
  itbis: string;
  retencion_isr: string;
  retencion_itbis: string;
  categoria_id: string;
  categoria: string;
  fondo_id: string;
  proyecto_id: string | null;
  proyecto: string | null;
  creado_por_id: string;
  creado_por: string;
  aprobado_por: string | null;
  motivo_anulacion: string | null;
  asiento_numero: string | null;
};

export async function facturaPorId(id: string): Promise<DetalleFactura | null> {
  if (!esUuid(id)) return null;
  return consultarUna<DetalleFactura>(
    `SELECT f.id, f.numero::text AS numero, f.ncf, f.fecha_emision::text AS fecha_emision,
            f.fecha_vencimiento::text AS fecha_vencimiento, f.moneda, f.total::text AS total,
            f.neto::text AS neto, f.concepto, f.estado, x.id AS cxp_id, x.saldo::text AS saldo,
            f.proveedor_id, p.nombre AS proveedor, p.tipo AS proveedor_tipo, f.tasa::text AS tasa,
            f.subtotal::text AS subtotal, f.itbis::text AS itbis,
            f.retencion_isr::text AS retencion_isr, f.retencion_itbis::text AS retencion_itbis,
            f.categoria_id, c.nombre AS categoria, f.fondo_id, f.proyecto_id, pr.nombre AS proyecto,
            f.creado_por AS creado_por_id, uc.nombre AS creado_por, ua.nombre AS aprobado_por,
            f.motivo_anulacion, a.numero::text AS asiento_numero
       FROM contabilidad.factura_proveedor f
       JOIN contabilidad.proveedor p ON p.id = f.proveedor_id
       JOIN contabilidad.categoria c ON c.id = f.categoria_id
       JOIN usuario uc ON uc.id = f.creado_por
       LEFT JOIN usuario ua ON ua.id = f.aprobado_por
       LEFT JOIN proyecto pr ON pr.id = f.proyecto_id
       LEFT JOIN contabilidad.cuenta_por_pagar x ON x.id = f.cuenta_por_pagar_id
       LEFT JOIN contabilidad.asiento a ON a.id = f.asiento_id
      WHERE f.id = $1`,
    [id],
  );
}
