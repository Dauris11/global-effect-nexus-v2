import { consultar } from "@/lib/db";
import { facturaPorId, type DetalleFactura } from "@/server/contabilidad/proveedores/consultas";

export type EstadoSolicitudCxp =
  | "solicitado"
  | "pendiente_llenado"
  | "pendiente"
  | "pagada";

export type FilaSolicitudMaterialCxp = {
  id: string;
  folio: number;
  tipo: "MATERIALES";
  titulo: string;
  detalle: string | null;
  monto: number | null;
  moneda: "DOP" | "USD";
  solicitante_id: string | null;
  solicitante: string | null;
  estudiante_id: string | null;
  proveedor_id: string | null;
  proveedor: string | null;
  tipo_material: string | null;
  cotizacion: { nombre: string; formato: string } | null;
  estado_solicitud: string;
  estado_cxp: EstadoSolicitudCxp;
  factura_id: string | null;
  factura_numero: string | null;
  factura_estado: "borrador" | "aprobada" | "anulada" | null;
  factura_ncf: string | null;
  cxp_id: string | null;
  cxp_estado: string | null;
  creada: string;
};

type FilaCruda = Omit<FilaSolicitudMaterialCxp, "cotizacion" | "estado_cxp"> & {
  cotizacion_nombre: string | null;
  cotizacion_formato: string | null;
};

/**
 * Solicitudes de tipo «Materiales» atendibles desde Cuentas por Pagar > Solicitudes.
 *
 * El estado mostrado en CxP refleja el ciclo sincronizado de Etapa 2:
 *   · Sin factura activa              → `solicitado`
 *   · Factura en borrador             → `pendiente_llenado`
 *   · Factura aprobada (CxP abierta)  → `pendiente`
 *   · CxP pagada / solicitud pagada   → `pagada`
 */
export async function solicitudesMaterialesParaCxp(): Promise<FilaSolicitudMaterialCxp[]> {
  const filas = await consultar<FilaCruda>(
    `SELECT s.id,
            s.folio::int AS folio,
            s.tipo,
            s.titulo,
            s.detalle,
            s.monto::float8 AS monto,
            COALESCE(s.moneda, 'DOP') AS moneda,
            s.solicitante_id,
            so.nombre AS solicitante,
            s.estudiante_id,
            s.proveedor_id,
            COALESCE(pr.nombre, s.proveedor_nombre) AS proveedor,
            tm.nombre AS tipo_material,
            ad.nombre AS cotizacion_nombre,
            ad.formato AS cotizacion_formato,
            s.estado AS estado_solicitud,
            f.id AS factura_id,
            f.numero::text AS factura_numero,
            f.estado AS factura_estado,
            f.ncf AS factura_ncf,
            x.id AS cxp_id,
            x.estado AS cxp_estado,
            s.created_at::text AS creada
       FROM public.solicitud s
       LEFT JOIN public.usuario so                  ON so.id = s.solicitante_id
       LEFT JOIN public.tipo_material tm            ON tm.id = s.tipo_material_id
       LEFT JOIN contabilidad.proveedor pr          ON pr.id = s.proveedor_id
       LEFT JOIN public.solicitud_adjunto ad        ON ad.solicitud_id = s.id
       LEFT JOIN contabilidad.factura_proveedor f   ON f.solicitud_id = s.id AND f.estado <> 'anulada'
       LEFT JOIN contabilidad.cuenta_por_pagar x    ON x.id = f.cuenta_por_pagar_id
      WHERE s.tipo = 'MATERIALES'
        AND s.estado NOT IN ('cancelada', 'rechazada')
      ORDER BY s.created_at DESC
      LIMIT 200`,
  );

  return filas.map(({ cotizacion_nombre, cotizacion_formato, ...fila }) => {
    let estado_cxp: EstadoSolicitudCxp = "solicitado";
    if (fila.cxp_estado === "pagada" || fila.estado_solicitud === "pagada") {
      estado_cxp = "pagada";
    } else if (fila.factura_estado === "aprobada") {
      estado_cxp = "pendiente";
    } else if (fila.factura_id && fila.factura_estado === "borrador") {
      estado_cxp = "pendiente_llenado";
    }

    return {
      ...fila,
      cotizacion:
        cotizacion_nombre && cotizacion_formato
          ? { nombre: cotizacion_nombre, formato: cotizacion_formato }
          : null,
      estado_cxp,
    };
  });
}

/** Carga los detalles de las facturas en borrador para abrir el modal sin espera adicional. */
export async function facturasBorradorPorIds(
  ids: readonly string[],
): Promise<Record<string, DetalleFactura>> {
  if (ids.length === 0) return {};
  const unicos = Array.from(new Set(ids));
  const resultados = await Promise.all(unicos.map((id) => facturaPorId(id)));
  const mapa: Record<string, DetalleFactura> = {};
  for (const f of resultados) {
    if (f) mapa[f.id] = f;
  }
  return mapa;
}
