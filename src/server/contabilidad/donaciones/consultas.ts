import { consultar, consultarUna } from "@/lib/db";

export type DonacionItem = {
  id: string;
  numero: number;
  terceroId: string;
  donanteNombre: string;
  donanteIdentificacion: string;
  fecha: string;
  clase: "efectivo" | "especie";
  tratamiento: "exento" | "gravado";
  moneda: "DOP" | "USD";
  tasa: number | null;
  monto: number;
  montoDop: number;
  descripcionEspecie: string | null;
  valorEstimadoTasacion: number | null;
  fondoNombre: string;
  proyectoNombre: string | null;
  asientoNumero: number | null;
  reciboNumero: number | null;
  comprobanteExternoNumero: string | null;
  estado: "borrador" | "confirmada" | "anulada";
  creadoEn: string;
};

export type PromesaConCuotas = {
  id: string;
  numero: number;
  terceroId: string;
  donanteNombre: string;
  fechaCompromiso: string;
  montoTotal: number;
  moneda: "DOP" | "USD";
  frecuencia: string;
  fondoNombre: string;
  proyectoNombre: string | null;
  notas: string | null;
  estado: "activa" | "cumplida" | "cancelada";
  cuotas: {
    id: string;
    numeroCuota: number;
    fechaVencimiento: string;
    monto: number;
    montoCobrado: number;
    estado: "pendiente" | "cobrada" | "vencida" | "cancelada";
  }[];
};

export async function listarDonaciones(opciones?: {
  clase?: "efectivo" | "especie";
  tratamiento?: "exento" | "gravado";
  estado?: string;
  terceroId?: string;
  limite?: number;
}): Promise<DonacionItem[]> {
  const params: unknown[] = [];
  let condiciones = "WHERE 1=1";

  if (opciones?.clase) {
    params.push(opciones.clase);
    condiciones += ` AND d.clase = $${params.length}`;
  }
  if (opciones?.tratamiento) {
    params.push(opciones.tratamiento);
    condiciones += ` AND d.tratamiento = $${params.length}`;
  }
  if (opciones?.estado) {
    params.push(opciones.estado);
    condiciones += ` AND d.estado = $${params.length}`;
  }
  if (opciones?.terceroId) {
    params.push(opciones.terceroId);
    condiciones += ` AND d.tercero_id = $${params.length}`;
  }

  const limite = opciones?.limite ?? 50;
  params.push(limite);

  const sql = `
    SELECT
      d.id,
      d.numero,
      d.tercero_id AS "terceroId",
      t.nombre_razon_social AS "donanteNombre",
      t.identificacion AS "donanteIdentificacion",
      d.fecha::text,
      d.clase,
      d.tratamiento,
      d.moneda,
      d.tasa::float,
      d.monto::float,
      COALESCE(d.monto_dop, d.monto)::float AS "montoDop",
      d.descripcion_especie AS "descripcionEspecie",
      d.valor_estimado_tasacion::float AS "valorEstimadoTasacion",
      f.nombre AS "fondoNombre",
      p.nombre AS "proyectoNombre",
      a.numero AS "asientoNumero",
      r.numero AS "reciboNumero",
      d.comprobante_externo_numero AS "comprobanteExternoNumero",
      d.estado,
      d.creado_en AS "creadoEn"
    FROM contabilidad.donacion d
    JOIN contabilidad.tercero t ON t.id = d.tercero_id
    JOIN contabilidad.fondo f ON f.id = d.fondo_id
    LEFT JOIN public.proyecto p ON p.id = d.proyecto_id
    LEFT JOIN contabilidad.asiento a ON a.id = d.asiento_id
    LEFT JOIN contabilidad.recibo r ON r.id = d.recibo_id
    ${condiciones}
    ORDER BY d.fecha DESC, d.numero DESC
    LIMIT $${params.length}
  `;

  return consultar<DonacionItem>(sql, params);
}

export async function listarPromesas(opciones?: {
  estado?: string;
  terceroId?: string;
}): Promise<PromesaConCuotas[]> {
  const params: unknown[] = [];
  let condiciones = "WHERE 1=1";

  if (opciones?.estado) {
    params.push(opciones.estado);
    condiciones += ` AND p.estado = $${params.length}`;
  }
  if (opciones?.terceroId) {
    params.push(opciones.terceroId);
    condiciones += ` AND p.tercero_id = $${params.length}`;
  }

  const sql = `
    SELECT
      p.id,
      p.numero,
      p.tercero_id AS "terceroId",
      t.nombre_razon_social AS "donanteNombre",
      p.fecha_compromiso::text AS "fechaCompromiso",
      p.monto_total::float AS "montoTotal",
      p.moneda,
      p.frecuencia,
      f.nombre AS "fondoNombre",
      proy.nombre AS "proyectoNombre",
      p.notas,
      p.estado,
      COALESCE(
        json_agg(
          json_build_object(
            'id', pc.id,
            'numeroCuota', pc.numero_cuota,
            'fechaVencimiento', pc.fecha_vencimiento::text,
            'monto', pc.monto::float,
            'montoCobrado', pc.monto_cobrado::float,
            'estado', pc.estado
          ) ORDER BY pc.numero_cuota
        ) FILTER (WHERE pc.id IS NOT NULL),
        '[]'::json
      ) AS cuotas
    FROM contabilidad.promesa_donacion p
    JOIN contabilidad.tercero t ON t.id = p.tercero_id
    JOIN contabilidad.fondo f ON f.id = p.fondo_id
    LEFT JOIN public.proyecto proy ON proy.id = p.proyecto_id
    LEFT JOIN contabilidad.promesa_cuota pc ON pc.promesa_id = p.id
    ${condiciones}
    GROUP BY p.id, t.nombre_razon_social, f.nombre, proy.nombre
    ORDER BY p.fecha_compromiso DESC, p.numero DESC
  `;

  return consultar<PromesaConCuotas>(sql, params);
}
