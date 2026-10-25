import { consultar } from "@/lib/db";

export type PresupuestoItem = {
  id: string;
  ejercicio: number;
  nombre: string;
  estado: "borrador" | "aprobado" | "cerrado";
  notas: string | null;
  aprobadoPor: string | null;
  aprobadoEn: string | null;
  creadoPor: string;
  creadoEn: string;
  totalPresupuestado: number;
  totalEjecutado: number;
};

export type LineaPresupuestoDetalle = {
  id: string;
  centroCostoId: string;
  centroCostoCodigo: string;
  centroCostoNombre: string;
  cuentaId: string;
  cuentaCodigo: string;
  cuentaNombre: string;
  cuentaTipo: string;
  fondoId: string | null;
  fondoNombre: string | null;
  periodoMes: number;
  montoPresupuestado: number;
  notas: string | null;
};

export type ResumenEjecucionCentroCosto = {
  centroCostoId: string;
  codigo: string;
  nombre: string;
  programa: string;
  presupuestado: number;
  ejecutado: number;
  desviacion: number;
  porcentajeEjecucion: number;
  estadoAlerta: "normal" | "atencion" | "sobregiro";
};

export async function listarPresupuestos(): Promise<PresupuestoItem[]> {
  const sql = `
    SELECT p.id,
           p.ejercicio,
           p.nombre,
           p.estado,
           p.notas,
           u_ap.nombre AS "aprobadoPor",
           p.aprobado_en::text AS "aprobadoEn",
           u_cr.nombre AS "creadoPor",
           p.creado_en::text AS "creadoEn",
           COALESCE(SUM(pl.monto_presupuestado), 0)::float AS "totalPresupuestado",
           0::float AS "totalEjecutado"
      FROM contabilidad.presupuesto p
      LEFT JOIN public.usuario u_ap ON u_ap.id = p.aprobado_por
      JOIN public.usuario u_cr ON u_cr.id = p.creado_por
      LEFT JOIN contabilidad.presupuesto_linea pl ON pl.presupuesto_id = p.id
     GROUP BY p.id, p.ejercicio, p.nombre, p.estado, p.notas, u_ap.nombre, p.aprobado_en, u_cr.nombre, p.creado_en
     ORDER BY p.ejercicio DESC, p.creado_en DESC
  `;

  return consultar<PresupuestoItem>(sql);
}

export async function obtenerPresupuestoPorId(id: string): Promise<PresupuestoItem | null> {
  const sql = `
    SELECT p.id,
           p.ejercicio,
           p.nombre,
           p.estado,
           p.notas,
           u_ap.nombre AS "aprobadoPor",
           p.aprobado_en::text AS "aprobadoEn",
           u_cr.nombre AS "creadoPor",
           p.creado_en::text AS "creadoEn",
           COALESCE(SUM(pl.monto_presupuestado), 0)::float AS "totalPresupuestado",
           0::float AS "totalEjecutado"
      FROM contabilidad.presupuesto p
      LEFT JOIN public.usuario u_ap ON u_ap.id = p.aprobado_por
      JOIN public.usuario u_cr ON u_cr.id = p.creado_por
      LEFT JOIN contabilidad.presupuesto_linea pl ON pl.presupuesto_id = p.id
     WHERE p.id = $1
     GROUP BY p.id, p.ejercicio, p.nombre, p.estado, p.notas, u_ap.nombre, p.aprobado_en, u_cr.nombre, p.creado_en
  `;
  const filas = await consultar<PresupuestoItem>(sql, [id]);
  return filas[0] ?? null;
}

export async function listarLineasPresupuesto(presupuestoId: string): Promise<LineaPresupuestoDetalle[]> {
  const sql = `
    SELECT pl.id,
           pl.centro_costo_id AS "centroCostoId",
           cc.codigo AS "centroCostoCodigo",
           cc.nombre AS "centroCostoNombre",
           pl.cuenta_id AS "cuentaId",
           cta.codigo AS "cuentaCodigo",
           cta.nombre AS "cuentaNombre",
           cta.tipo AS "cuentaTipo",
           pl.fondo_id AS "fondoId",
           f.nombre AS "fondoNombre",
           pl.periodo_mes AS "periodoMes",
           pl.monto_presupuestado::float AS "montoPresupuestado",
           pl.notas
      FROM contabilidad.presupuesto_linea pl
      JOIN contabilidad.centro_costo cc ON cc.id = pl.centro_costo_id
      JOIN contabilidad.cuenta_contable cta ON cta.id = pl.cuenta_id
      LEFT JOIN contabilidad.fondo f ON f.id = pl.fondo_id
     WHERE pl.presupuesto_id = $1
     ORDER BY cc.codigo ASC, cta.codigo ASC, pl.periodo_mes ASC
  `;

  return consultar<LineaPresupuestoDetalle>(sql, [presupuestoId]);
}

export async function calcularEjecucionPresupuestaria(presupuestoId: string): Promise<ResumenEjecucionCentroCosto[]> {
  const sql = `
    WITH presup AS (
      SELECT pl.centro_costo_id,
             SUM(pl.monto_presupuestado) AS monto_presupuestado
        FROM contabilidad.presupuesto_linea pl
       WHERE pl.presupuesto_id = $1
       GROUP BY pl.centro_costo_id
    ),
    ejec AS (
      SELECT al.centro_costo_id,
             SUM(
               CASE 
                 WHEN cta.tipo = 'gasto' THEN (al.debe - al.haber)
                 WHEN cta.tipo = 'ingreso' THEN (al.haber - al.debe)
                 ELSE 0
               END
             ) AS monto_ejecutado
        FROM contabilidad.asiento_linea al
        JOIN contabilidad.asiento a ON a.id = al.asiento_id
        JOIN contabilidad.cuenta_contable cta ON cta.id = al.cuenta_id
        JOIN contabilidad.presupuesto p ON p.id = $1
       WHERE al.centro_costo_id IS NOT NULL
         AND EXTRACT(YEAR FROM a.fecha) = p.ejercicio
       GROUP BY al.centro_costo_id
    )
    SELECT cc.id AS "centroCostoId",
           cc.codigo,
           cc.nombre,
           cc.programa,
           COALESCE(pr.monto_presupuestado, 0)::float AS "presupuestado",
           COALESCE(ej.monto_ejecutado, 0)::float AS "ejecutado",
           (COALESCE(ej.monto_ejecutado, 0) - COALESCE(pr.monto_presupuestado, 0))::float AS "desviacion",
           CASE 
             WHEN COALESCE(pr.monto_presupuestado, 0) > 0 
             THEN ROUND(((COALESCE(ej.monto_ejecutado, 0) / pr.monto_presupuestado) * 100)::numeric, 1)::float
             ELSE 0::float
           END AS "porcentajeEjecucion",
           CASE
             WHEN COALESCE(pr.monto_presupuestado, 0) = 0 THEN 'normal'
             WHEN (COALESCE(ej.monto_ejecutado, 0) / pr.monto_presupuestado) > 1.0 THEN 'sobregiro'
             WHEN (COALESCE(ej.monto_ejecutado, 0) / pr.monto_presupuestado) >= 0.8 THEN 'atencion'
             ELSE 'normal'
           END AS "estadoAlerta"
      FROM contabilidad.centro_costo cc
      LEFT JOIN presup pr ON pr.centro_costo_id = cc.id
      LEFT JOIN ejec ej ON ej.centro_costo_id = cc.id
     WHERE cc.activo = true
     ORDER BY cc.codigo ASC
  `;

  return consultar<ResumenEjecucionCentroCosto>(sql, [presupuestoId]);
}
