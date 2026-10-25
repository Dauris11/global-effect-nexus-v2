import { consultar, consultarUna } from "@/lib/db";

export type OrdenCompraItem = {
  id: string;
  numero: number;
  proveedorId: string;
  proveedorNombre: string;
  proveedorRnc: string;
  fecha: string;
  fechaEntrega: string | null;
  moneda: "DOP" | "USD";
  subtotal: number;
  itbis: number;
  total: number;
  fondoNombre: string;
  categoriaNombre: string;
  proyectoNombre: string | null;
  estado: "borrador" | "pendiente_aprobacion" | "aprobada" | "rechazada" | "facturada" | "cancelada";
  justificacion: string | null;
  creadoPorNombre: string;
  aprobadoPorNombre: string | null;
  aprobadoEn: string | null;
  motivoRechazo: string | null;
  lineasCount: number;
};

export type OrdenCompraDetalle = OrdenCompraItem & {
  lineas: {
    id: string;
    numeroLinea: number;
    descripcion: string;
    cantidad: number;
    precioUnitario: number;
    itbisTasa: number;
    montoItbis: number;
    subtotal: number;
    total: number;
  }[];
};

export async function listarOrdenesCompra(opciones?: {
  estado?: string;
  proveedorId?: string;
  limite?: number;
}): Promise<OrdenCompraItem[]> {
  const params: unknown[] = [];
  let condiciones = "WHERE 1=1";

  if (opciones?.estado) {
    params.push(opciones.estado);
    condiciones += ` AND oc.estado = $${params.length}`;
  }
  if (opciones?.proveedorId) {
    params.push(opciones.proveedorId);
    condiciones += ` AND oc.proveedor_id = $${params.length}`;
  }

  const limite = opciones?.limite ?? 50;
  params.push(limite);

  const sql = `
    SELECT
      oc.id,
      oc.numero,
      oc.proveedor_id AS "proveedorId",
      pr.nombre AS "proveedorNombre",
      pr.identificacion AS "proveedorRnc",
      oc.fecha::text,
      oc.fecha_entrega::text AS "fechaEntrega",
      oc.moneda,
      oc.subtotal::float,
      oc.itbis::float,
      oc.total::float,
      f.nombre AS "fondoNombre",
      c.nombre AS "categoriaNombre",
      p.nombre AS "proyectoNombre",
      oc.estado,
      oc.justificacion,
      u1.nombre_completo AS "creadoPorNombre",
      u2.nombre_completo AS "aprobadoPorNombre",
      oc.aprobado_en::text AS "aprobadoEn",
      oc.motivo_rechazo AS "motivoRechazo",
      (SELECT COUNT(*) FROM contabilidad.orden_compra_linea ocl WHERE ocl.orden_compra_id = oc.id)::int AS "lineasCount"
    FROM contabilidad.orden_compra oc
    JOIN contabilidad.proveedor pr ON pr.id = oc.proveedor_id
    JOIN contabilidad.fondo f ON f.id = oc.fondo_id
    JOIN contabilidad.categoria c ON c.id = oc.categoria_id
    JOIN public.usuario u1 ON u1.id = oc.creado_por
    LEFT JOIN public.usuario u2 ON u2.id = oc.aprobado_por
    LEFT JOIN public.proyecto p ON p.id = oc.proyecto_id
    ${condiciones}
    ORDER BY oc.fecha DESC, oc.numero DESC
    LIMIT $${params.length}
  `;

  return consultar<OrdenCompraItem>(sql, params);
}

export async function obtenerOrdenCompra(id: string): Promise<OrdenCompraDetalle | null> {
  const sql = `
    SELECT
      oc.id,
      oc.numero,
      oc.proveedor_id AS "proveedorId",
      pr.nombre AS "proveedorNombre",
      pr.identificacion AS "proveedorRnc",
      oc.fecha::text,
      oc.fecha_entrega::text AS "fechaEntrega",
      oc.moneda,
      oc.subtotal::float,
      oc.itbis::float,
      oc.total::float,
      f.nombre AS "fondoNombre",
      c.nombre AS "categoriaNombre",
      p.nombre AS "proyectoNombre",
      oc.estado,
      oc.justificacion,
      u1.nombre_completo AS "creadoPorNombre",
      u2.nombre_completo AS "aprobadoPorNombre",
      oc.aprobado_en::text AS "aprobadoEn",
      oc.motivo_rechazo AS "motivoRechazo",
      COALESCE(
        json_agg(
          json_build_object(
            'id', ocl.id,
            'numeroLinea', ocl.numero_linea,
            'descripcion', ocl.descripcion,
            'cantidad', ocl.cantidad::float,
            'precioUnitario', ocl.precio_unitario::float,
            'itbisTasa', ocl.itbis_tasa::float,
            'montoItbis', ocl.monto_itbis::float,
            'subtotal', ocl.subtotal::float,
            'total', ocl.total::float
          ) ORDER BY ocl.numero_linea
        ) FILTER (WHERE ocl.id IS NOT NULL),
        '[]'::json
      ) AS lineas
    FROM contabilidad.orden_compra oc
    JOIN contabilidad.proveedor pr ON pr.id = oc.proveedor_id
    JOIN contabilidad.fondo f ON f.id = oc.fondo_id
    JOIN contabilidad.categoria c ON c.id = oc.categoria_id
    JOIN public.usuario u1 ON u1.id = oc.creado_por
    LEFT JOIN public.usuario u2 ON u2.id = oc.aprobado_por
    LEFT JOIN public.proyecto p ON p.id = oc.proyecto_id
    LEFT JOIN contabilidad.orden_compra_linea ocl ON ocl.orden_compra_id = oc.id
    WHERE oc.id = $1
    GROUP BY oc.id, pr.nombre, pr.identificacion, f.nombre, c.nombre, p.nombre, u1.nombre_completo, u2.nombre_completo
  `;

  return consultarUna<OrdenCompraDetalle>(sql, [id]);
}
