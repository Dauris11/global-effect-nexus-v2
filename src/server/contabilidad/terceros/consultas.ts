import { consultar, consultarUna } from "@/lib/db";

export type TerceroResumen = {
  id: string;
  tipoPersona: "fisica" | "juridica" | "gubernamental";
  tipoId: "rnc" | "cedula" | "pasaporte";
  identificacion: string;
  nombreRazonSocial: string;
  nombreComercial: string | null;
  contactoPrincipal: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  esDonante: boolean;
  esProveedor: boolean;
  esEmpleado: boolean;
  patrocinadorId: string | null;
  proveedorId: string | null;
  activo: boolean;
  creadoEn: string;
  totalDonadoDop?: number;
  promesasPendientes?: number;
  debidaDiligenciaEstado?: "aprobado" | "observado" | "rechazado" | "sin_verificar";
};

export type DebidaDiligenciaRegistro = {
  id: string;
  terceroId: string;
  fechaVerificacion: string;
  origenFondosDeclarado: string;
  verificacionPep: boolean;
  verificacionListas: boolean;
  resultado: "aprobado" | "observado" | "rechazado";
  oficialCumplimientoId: string | null;
  oficialNombre?: string | null;
  observaciones: string | null;
  soporteUrl: string | null;
  creadoEn: string;
};

export async function listarTerceros(opciones?: {
  filtro?: "todos" | "donantes" | "proveedores" | "empleados";
  busqueda?: string;
  limite?: number;
  offset?: number;
}): Promise<TerceroResumen[]> {
  const limite = Math.min(Math.max(opciones?.limite ?? 50, 1), 200);
  const offset = Math.max(opciones?.offset ?? 0, 0);
  const params: unknown[] = [];
  let condiciones = "WHERE 1=1";

  if (opciones?.filtro === "donantes") {
    condiciones += " AND t.es_donante = true";
  } else if (opciones?.filtro === "proveedores") {
    condiciones += " AND t.es_proveedor = true";
  } else if (opciones?.filtro === "empleados") {
    condiciones += " AND t.es_empleado = true";
  }

  if (opciones?.busqueda?.trim()) {
    params.push(`%${opciones.busqueda.trim()}%`);
    condiciones += ` AND (t.nombre_razon_social ILIKE $${params.length} OR t.identificacion ILIKE $${params.length} OR t.nombre_comercial ILIKE $${params.length})`;
  }

  params.push(limite, offset);

  const sql = `
    SELECT
      t.id,
      t.tipo_persona AS "tipoPersona",
      t.tipo_id AS "tipoId",
      t.identificacion,
      t.nombre_razon_social AS "nombreRazonSocial",
      t.nombre_comercial AS "nombreComercial",
      t.contacto_principal AS "contactoPrincipal",
      t.telefono,
      t.email,
      t.direccion,
      t.es_donante AS "esDonante",
      t.es_proveedor AS "esProveedor",
      t.es_empleado AS "esEmpleado",
      t.patrocinador_id AS "patrocinadorId",
      t.proveedor_id AS "proveedorId",
      t.activo,
      t.creado_en AS "creadoEn",
      COALESCE((
        SELECT dd.resultado
        FROM contabilidad.debida_diligencia dd
        WHERE dd.tercero_id = t.id
        ORDER BY dd.fecha_verificacion DESC, dd.creado_en DESC
        LIMIT 1
      ), 'sin_verificar') AS "debidaDiligenciaEstado",
      COALESCE((
        SELECT SUM(d.monto_dop)
        FROM contabilidad.donacion d
        WHERE d.tercero_id = t.id AND d.estado = 'confirmada'
      ), 0) AS "totalDonadoDop",
      COALESCE((
        SELECT COUNT(*)
        FROM contabilidad.promesa_cuota pc
        JOIN contabilidad.promesa_donacion pd ON pd.id = pc.promesa_id
        WHERE pd.tercero_id = t.id AND pc.estado = 'pendiente'
      ), 0) AS "promesasPendientes"
    FROM contabilidad.tercero t
    ${condiciones}
    ORDER BY t.nombre_razon_social ASC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `;

  return consultar<TerceroResumen>(sql, params);
}

export async function obtenerTercero(id: string): Promise<TerceroResumen | null> {
  const sql = `
    SELECT
      t.id,
      t.tipo_persona AS "tipoPersona",
      t.tipo_id AS "tipoId",
      t.identificacion,
      t.nombre_razon_social AS "nombreRazonSocial",
      t.nombre_comercial AS "nombreComercial",
      t.contacto_principal AS "contactoPrincipal",
      t.telefono,
      t.email,
      t.direccion,
      t.es_donante AS "esDonante",
      t.es_proveedor AS "esProveedor",
      t.es_empleado AS "esEmpleado",
      t.patrocinador_id AS "patrocinadorId",
      t.proveedor_id AS "proveedorId",
      t.activo,
      t.creado_en AS "creadoEn",
      COALESCE((
        SELECT dd.resultado
        FROM contabilidad.debida_diligencia dd
        WHERE dd.tercero_id = t.id
        ORDER BY dd.fecha_verificacion DESC, dd.creado_en DESC
        LIMIT 1
      ), 'sin_verificar') AS "debidaDiligenciaEstado"
    FROM contabilidad.tercero t
    WHERE t.id = $1
  `;
  return consultarUna<TerceroResumen>(sql, [id]);
}

export async function historialDebidaDiligencia(terceroId: string): Promise<DebidaDiligenciaRegistro[]> {
  const sql = `
    SELECT
      dd.id,
      dd.tercero_id AS "terceroId",
      dd.fecha_verificacion AS "fechaVerificacion",
      dd.origen_fondos_declarado AS "origenFondosDeclarado",
      dd.verificacion_pep AS "verificacionPep",
      dd.verificacion_listas AS "verificacionListas",
      dd.resultado,
      dd.oficial_cumplimiento_id AS "oficialCumplimientoId",
      u.nombre_completo AS "oficialNombre",
      dd.observaciones,
      dd.soporte_url AS "soporteUrl",
      dd.creado_en AS "creadoEn"
    FROM contabilidad.debida_diligencia dd
    LEFT JOIN public.usuario u ON u.id = dd.oficial_cumplimiento_id
    WHERE dd.tercero_id = $1
    ORDER BY dd.fecha_verificacion DESC, dd.creado_en DESC
  `;
  return consultar<DebidaDiligenciaRegistro>(sql, [terceroId]);
}
