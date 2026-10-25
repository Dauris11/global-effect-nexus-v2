import { consultar, consultarUna } from "@/lib/db";
import { requerirPermiso } from "@/lib/auth";

export type CategoriaActivo = {
  id: string;
  codigo: string;
  nombre: string;
  vida_util_meses: number;
  porcentaje_anual: number;
  cuenta_activo_id: string;
  cuenta_activo_codigo: string;
  cuenta_activo_nombre: string;
  cuenta_depreciacion_acumulada_id: string;
  cuenta_gasto_depreciacion_id: string;
};

export type ActivoFijoContable = {
  id: string;
  inventario_activo_id: string | null;
  inventario_activo_codigo: string | null;
  codigo: string;
  nombre: string;
  categoria_id: string;
  categoria_codigo: string;
  categoria_nombre: string;
  centro_costo_id: string;
  centro_costo_codigo: string;
  centro_costo_nombre: string;
  fecha_adquisicion: string;
  costo_adquisicion: number;
  valor_residual: number;
  depreciacion_acumulada: number;
  valor_en_libros: number;
  meses_depreciados: number;
  estado: "activo" | "totalmente_depreciado" | "baja" | "donado" | "traspasado";
  es_donado: boolean;
  fecha_baja: string | null;
  motivo_baja: string | null;
  creado_en: string;
};

export type DepreciacionMensualResumen = {
  id: string;
  anio: number;
  mes: number;
  fecha_asiento: string;
  total_depreciacion: number;
  asiento_id: string | null;
  asiento_numero: string | null;
  activos_conteo: number;
  creado_en: string;
};

export async function listarCategoriasActivos(): Promise<CategoriaActivo[]> {
  await requerirPermiso("contabilidad.leer");

  const filas = await consultar<{
    id: string;
    codigo: string;
    nombre: string;
    vida_util_meses: number;
    porcentaje_anual: string;
    cuenta_activo_id: string;
    cuenta_activo_codigo: string;
    cuenta_activo_nombre: string;
    cuenta_depreciacion_acumulada_id: string;
    cuenta_gasto_depreciacion_id: string;
  }>(
    `SELECT ca.id,
            ca.codigo,
            ca.nombre,
            ca.vida_util_meses,
            ca.porcentaje_anual::text AS porcentaje_anual,
            ca.cuenta_activo_id,
            c_act.codigo AS cuenta_activo_codigo,
            c_act.nombre AS cuenta_activo_nombre,
            ca.cuenta_depreciacion_acumulada_id,
            ca.cuenta_gasto_depreciacion_id
       FROM contabilidad.activo_categoria ca
       JOIN contabilidad.cuenta_contable c_act ON c_act.id = ca.cuenta_activo_id
      WHERE ca.activo = true
      ORDER BY ca.codigo ASC`,
  );

  return filas.map((f) => ({
    ...f,
    porcentaje_anual: Number(f.porcentaje_anual),
  }));
}

export async function listarActivosFijos(filtros?: {
  categoriaId?: string;
  centroCostoId?: string;
  estado?: string;
}): Promise<ActivoFijoContable[]> {
  await requerirPermiso("contabilidad.leer");

  const condiciones: string[] = [];
  const valores: unknown[] = [];

  if (filtros?.categoriaId) {
    valores.push(filtros.categoriaId);
    condiciones.push(`af.categoria_id = $${valores.length}`);
  }

  if (filtros?.centroCostoId) {
    valores.push(filtros.centroCostoId);
    condiciones.push(`af.centro_costo_id = $${valores.length}`);
  }

  if (filtros?.estado) {
    valores.push(filtros.estado);
    condiciones.push(`af.estado = $${valores.length}`);
  }

  const whereClausula = condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";

  const filas = await consultar<{
    id: string;
    inventario_activo_id: string | null;
    inventario_activo_codigo: string | null;
    codigo: string;
    nombre: string;
    categoria_id: string;
    categoria_codigo: string;
    categoria_nombre: string;
    centro_costo_id: string;
    centro_costo_codigo: string;
    centro_costo_nombre: string;
    fecha_adquisicion: string;
    costo_adquisicion: string;
    valor_residual: string;
    depreciacion_acumulada: string;
    valor_en_libros: string;
    meses_depreciados: number;
    estado: "activo" | "totalmente_depreciado" | "baja" | "donado" | "traspasado";
    es_donado: boolean;
    fecha_baja: string | null;
    motivo_baja: string | null;
    creado_en: string;
  }>(
    `SELECT af.id,
            af.inventario_activo_id,
            ia.codigo AS inventario_activo_codigo,
            af.codigo,
            af.nombre,
            af.categoria_id,
            ca.codigo AS categoria_codigo,
            ca.nombre AS categoria_nombre,
            af.centro_costo_id,
            cc.codigo AS centro_costo_codigo,
            cc.nombre AS centro_costo_nombre,
            to_char(af.fecha_adquisicion, 'YYYY-MM-DD') AS fecha_adquisicion,
            af.costo_adquisicion::text AS costo_adquisicion,
            af.valor_residual::text AS valor_residual,
            af.depreciacion_acumulada::text AS depreciacion_acumulada,
            af.valor_en_libros::text AS valor_en_libros,
            af.meses_depreciados,
            af.estado,
            af.es_donado,
            to_char(af.fecha_baja, 'YYYY-MM-DD') AS fecha_baja,
            af.motivo_baja,
            af.creado_en::text AS creado_en
       FROM contabilidad.activo_fijo af
       JOIN contabilidad.activo_categoria ca ON ca.id = af.categoria_id
       JOIN contabilidad.centro_costo cc ON cc.id = af.centro_costo_id
  LEFT JOIN public.inventario_activo ia ON ia.id = af.inventario_activo_id
      ${whereClausula}
      ORDER BY af.codigo ASC`,
    valores,
  );

  return filas.map((f) => ({
    ...f,
    costo_adquisicion: Number(f.costo_adquisicion),
    valor_residual: Number(f.valor_residual),
    depreciacion_acumulada: Number(f.depreciacion_acumulada),
    valor_en_libros: Number(f.valor_en_libros),
  }));
}

export async function listarDepreciacionesMensuales(): Promise<DepreciacionMensualResumen[]> {
  await requerirPermiso("contabilidad.leer");

  const filas = await consultar<{
    id: string;
    anio: number;
    mes: number;
    fecha_asiento: string;
    total_depreciacion: string;
    asiento_id: string | null;
    asiento_numero: string | null;
    activos_conteo: string;
    creado_en: string;
  }>(
    `SELECT dm.id,
            dm.anio,
            dm.mes,
            to_char(dm.fecha_asiento, 'YYYY-MM-DD') AS fecha_asiento,
            dm.total_depreciacion::text AS total_depreciacion,
            dm.asiento_id,
            a.numero AS asiento_numero,
            COUNT(dl.id)::text AS activos_conteo,
            dm.creado_en::text AS creado_en
       FROM contabilidad.depreciacion_mensual dm
  LEFT JOIN contabilidad.asiento a ON a.id = dm.asiento_id
  LEFT JOIN contabilidad.depreciacion_linea dl ON dl.depreciacion_id = dm.id
      GROUP BY dm.id, a.numero
      ORDER BY dm.anio DESC, dm.mes DESC`,
  );

  return filas.map((f) => ({
    ...f,
    total_depreciacion: Number(f.total_depreciacion),
    activos_conteo: Number(f.activos_conteo),
  }));
}
