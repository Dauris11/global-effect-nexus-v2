import { consultar, consultarUna } from "@/lib/db";
import { requerirPermiso } from "@/lib/auth";

export type ArticuloInventario = {
  id: string;
  codigo: string;
  nombre: string;
  categoria: "alimentos_comedor" | "suministros_oficina" | "material_didactico" | "limpieza" | "otros";
  unidad_medida: "unidad" | "libra" | "kilo" | "caja" | "saco" | "litro" | "galon" | "paquete";
  centro_costo_id: string | null;
  centro_costo_codigo: string | null;
  centro_costo_nombre: string | null;
  cuenta_inventario_id: string;
  cuenta_inventario_codigo: string;
  cuenta_gasto_id: string;
  cuenta_gasto_codigo: string;
  stock_actual: number;
  stock_minimo: number;
  costo_promedio: number;
  valor_total: number;
  activo: boolean;
  creado_en: string;
};

export type MovimientoKardex = {
  id: string;
  articulo_id: string;
  tipo: "entrada_compra" | "entrada_donacion" | "salida_consumo" | "ajuste_sobrante" | "ajuste_faltante";
  fecha: string;
  cantidad: number;
  costo_unitario: number;
  costo_total: number;
  stock_anterior: number;
  stock_posterior: number;
  costo_promedio_anterior: number;
  costo_promedio_posterior: number;
  centro_costo_nombre: string | null;
  asiento_id: string | null;
  motivo: string | null;
  creado_en: string;
};

export type ConteoFisicoResumen = {
  id: string;
  codigo: string;
  fecha: string;
  descripcion: string;
  estado: "borrador" | "aplicado" | "anulado";
  articulos_conteo: number;
  diferencia_neta: number;
  impacto_total: number;
  creado_en: string;
};

export async function listarArticulos(filtros?: {
  categoria?: string;
  soloActivos?: boolean;
}): Promise<ArticuloInventario[]> {
  await requerirPermiso("contabilidad.leer");

  const condiciones: string[] = [];
  const valores: unknown[] = [];

  if (filtros?.categoria) {
    valores.push(filtros.categoria);
    condiciones.push(`a.categoria = $${valores.length}`);
  }

  if (filtros?.soloActivos) {
    condiciones.push(`a.activo = true`);
  }

  const whereClausula = condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";

  const filas = await consultar<{
    id: string;
    codigo: string;
    nombre: string;
    categoria: "alimentos_comedor" | "suministros_oficina" | "material_didactico" | "limpieza" | "otros";
    unidad_medida: "unidad" | "libra" | "kilo" | "caja" | "saco" | "litro" | "galon" | "paquete";
    centro_costo_id: string | null;
    centro_costo_codigo: string | null;
    centro_costo_nombre: string | null;
    cuenta_inventario_id: string;
    cuenta_inventario_codigo: string;
    cuenta_gasto_id: string;
    cuenta_gasto_codigo: string;
    stock_actual: string;
    stock_minimo: string;
    costo_promedio: string;
    valor_total: string;
    activo: boolean;
    creado_en: string;
  }>(
    `SELECT a.id,
            a.codigo,
            a.nombre,
            a.categoria,
            a.unidad_medida,
            a.centro_costo_id,
            cc.codigo AS centro_costo_codigo,
            cc.nombre AS centro_costo_nombre,
            a.cuenta_inventario_id,
            ci.codigo AS cuenta_inventario_codigo,
            a.cuenta_gasto_id,
            cg.codigo AS cuenta_gasto_codigo,
            a.stock_actual::text AS stock_actual,
            a.stock_minimo::text AS stock_minimo,
            a.costo_promedio::text AS costo_promedio,
            a.valor_total::text AS valor_total,
            a.activo,
            a.creado_en::text AS creado_en
       FROM contabilidad.articulo a
       JOIN contabilidad.cuenta_contable ci ON ci.id = a.cuenta_inventario_id
       JOIN contabilidad.cuenta_contable cg ON cg.id = a.cuenta_gasto_id
  LEFT JOIN contabilidad.centro_costo cc ON cc.id = a.centro_costo_id
      ${whereClausula}
      ORDER BY a.codigo ASC`,
    valores,
  );

  return filas.map((f) => ({
    ...f,
    stock_actual: Number(f.stock_actual),
    stock_minimo: Number(f.stock_minimo),
    costo_promedio: Number(f.costo_promedio),
    valor_total: Number(f.valor_total),
  }));
}

export async function listarKardexArticulo(articuloId: string): Promise<MovimientoKardex[]> {
  await requerirPermiso("contabilidad.leer");

  const filas = await consultar<{
    id: string;
    articulo_id: string;
    tipo: "entrada_compra" | "entrada_donacion" | "salida_consumo" | "ajuste_sobrante" | "ajuste_faltante";
    fecha: string;
    cantidad: string;
    costo_unitario: string;
    costo_total: string;
    stock_anterior: string;
    stock_posterior: string;
    costo_promedio_anterior: string;
    costo_promedio_posterior: string;
    centro_costo_nombre: string | null;
    asiento_id: string | null;
    motivo: string | null;
    creado_en: string;
  }>(
    `SELECT m.id,
            m.articulo_id,
            m.tipo,
            to_char(m.fecha, 'YYYY-MM-DD') AS fecha,
            m.cantidad::text AS cantidad,
            m.costo_unitario::text AS costo_unitario,
            m.costo_total::text AS costo_total,
            m.stock_anterior::text AS stock_anterior,
            m.stock_posterior::text AS stock_posterior,
            m.costo_promedio_anterior::text AS costo_promedio_anterior,
            m.costo_promedio_posterior::text AS costo_promedio_posterior,
            cc.nombre AS centro_costo_nombre,
            m.asiento_id,
            m.motivo,
            m.creado_en::text AS creado_en
       FROM contabilidad.inventario_movimiento m
  LEFT JOIN contabilidad.centro_costo cc ON cc.id = m.centro_costo_id
      WHERE m.articulo_id = $1
      ORDER BY m.fecha DESC, m.creado_en DESC`,
    [articuloId],
  );

  return filas.map((f) => ({
    ...f,
    cantidad: Number(f.cantidad),
    costo_unitario: Number(f.costo_unitario),
    costo_total: Number(f.costo_total),
    stock_anterior: Number(f.stock_anterior),
    stock_posterior: Number(f.stock_posterior),
    costo_promedio_anterior: Number(f.costo_promedio_anterior),
    costo_promedio_posterior: Number(f.costo_promedio_posterior),
  }));
}

export async function listarConteosFisicos(): Promise<ConteoFisicoResumen[]> {
  await requerirPermiso("contabilidad.leer");

  const filas = await consultar<{
    id: string;
    codigo: string;
    fecha: string;
    descripcion: string;
    estado: "borrador" | "aplicado" | "anulado";
    articulos_conteo: string;
    diferencia_neta: string;
    impacto_total: string;
    creado_en: string;
  }>(
    `SELECT cf.id,
            cf.codigo,
            to_char(cf.fecha, 'YYYY-MM-DD') AS fecha,
            cf.descripcion,
            cf.estado,
            COUNT(cfl.id)::text AS articulos_conteo,
            COALESCE(SUM(cfl.diferencia), 0)::text AS diferencia_neta,
            COALESCE(SUM(cfl.impacto_monetario), 0)::text AS impacto_total,
            cf.creado_en::text AS creado_en
       FROM contabilidad.conteo_fisico cf
  LEFT JOIN contabilidad.conteo_fisico_linea cfl ON cfl.conteo_id = cf.id
      GROUP BY cf.id
      ORDER BY cf.fecha DESC, cf.creado_en DESC`,
  );

  return filas.map((f) => ({
    ...f,
    articulos_conteo: Number(f.articulos_conteo),
    diferencia_neta: Number(f.diferencia_neta),
    impacto_total: Number(f.impacto_total),
  }));
}
