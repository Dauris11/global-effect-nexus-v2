import { consultar } from "@/lib/db";

export type CentroCostoItem = {
  id: string;
  codigo: string;
  nombre: string;
  programa: "becas" | "formacion_360" | "comedor" | "administrativo" | "institucional" | "proyectos";
  descripcion: string | null;
  responsableId: string | null;
  responsableNombre: string | null;
  activo: boolean;
  creadoEn: string;
  totalGastos: number;
};

export async function listarCentrosCosto(): Promise<CentroCostoItem[]> {
  const sql = `
    SELECT cc.id,
           cc.codigo,
           cc.nombre,
           cc.programa,
           cc.descripcion,
           cc.responsable_id AS "responsableId",
           u.nombre AS "responsableNombre",
           cc.activo,
           cc.creado_en::text AS "creadoEn",
           COALESCE(SUM(al.debe - al.haber), 0)::float AS "totalGastos"
      FROM contabilidad.centro_costo cc
      LEFT JOIN public.usuario u ON u.id = cc.responsable_id
      LEFT JOIN contabilidad.asiento_linea al ON al.centro_costo_id = cc.id
      LEFT JOIN contabilidad.cuenta_contable cta ON cta.id = al.cuenta_id AND cta.tipo = 'gasto'
     GROUP BY cc.id, cc.codigo, cc.nombre, cc.programa, cc.descripcion, cc.responsable_id, u.nombre, cc.activo, cc.creado_en
     ORDER BY cc.codigo ASC
  `;

  return consultar<CentroCostoItem>(sql);
}

export async function obtenerCentroCostoPorId(id: string): Promise<CentroCostoItem | null> {
  const sql = `
    SELECT cc.id,
           cc.codigo,
           cc.nombre,
           cc.programa,
           cc.descripcion,
           cc.responsable_id AS "responsableId",
           u.nombre AS "responsableNombre",
           cc.activo,
           cc.creado_en::text AS "creadoEn",
           0::float AS "totalGastos"
      FROM contabilidad.centro_costo cc
      LEFT JOIN public.usuario u ON u.id = cc.responsable_id
     WHERE cc.id = $1
  `;
  const filas = await consultar<CentroCostoItem>(sql, [id]);
  return filas[0] ?? null;
}
