import { consultar } from "@/lib/db";

export type FondoItem = {
  id: string;
  codigo: string | null;
  nombre: string;
  descripcion: string | null;
  tipoRestriccion: "no_restringido" | "temporalmente_restringido" | "permanentemente_restringido";
  donanteId: string | null;
  donanteNombre: string | null;
  propositoRestringido: string | null;
  fechaInicio: string | null;
  fechaVencimientoRestriccion: string | null;
  montoRestringidoOriginal: number;
  montoLiberadoAcumulado: number;
  saldoRestringidoDisponible: number;
  activo: boolean;
  creadoEn: string;
};

export type FondoLiberacionItem = {
  id: string;
  fondoId: string;
  fondoNombre: string;
  montoLiberado: number;
  fechaLiberacion: string;
  asientoId: string | null;
  asientoNumero: number | null;
  documentoReferencia: string | null;
  justificacion: string;
  creadoPorNombre: string;
  creadoEn: string;
};

export async function listarFondos(): Promise<FondoItem[]> {
  const sql = `
    SELECT f.id,
           f.codigo,
           f.nombre,
           f.descripcion,
           f.tipo_restriccion AS "tipoRestriccion",
           f.donante_id AS "donanteId",
           t.nombre_razon_social AS "donanteNombre",
           f.proposito_restringido AS "propositoRestringido",
           f.fecha_inicio::text AS "fechaInicio",
           f.fecha_vencimiento_restriccion::text AS "fechaVencimientoRestriccion",
           f.monto_restringido_original::float AS "montoRestringidoOriginal",
           f.monto_liberado_acumulado::float AS "montoLiberadoAcumulado",
           (f.monto_restringido_original - f.monto_liberado_acumulado)::float AS "saldoRestringidoDisponible",
           f.activo,
           f.creado_en::text AS "creadoEn"
      FROM contabilidad.fondo f
      LEFT JOIN contabilidad.tercero t ON t.id = f.donante_id
     ORDER BY f.nombre ASC
  `;

  return consultar<FondoItem>(sql);
}

export async function listarHistorialLiberaciones(fondoId?: string): Promise<FondoLiberacionItem[]> {
  const params: unknown[] = [];
  let filtroFondo = "";
  if (fondoId) {
    filtroFondo = "WHERE fl.fondo_id = $1";
    params.push(fondoId);
  }

  const sql = `
    SELECT fl.id,
           fl.fondo_id AS "fondoId",
           f.nombre AS "fondoNombre",
           fl.monto_liberado::float AS "montoLiberado",
           fl.fecha_liberacion::text AS "fechaLiberacion",
           fl.asiento_id AS "asientoId",
           a.numero::int AS "asientoNumero",
           fl.documento_referencia AS "documentoReferencia",
           fl.justificacion,
           u.nombre AS "creadoPorNombre",
           fl.creado_en::text AS "creadoEn"
      FROM contabilidad.fondo_liberacion fl
      JOIN contabilidad.fondo f ON f.id = fl.fondo_id
      LEFT JOIN contabilidad.asiento a ON a.id = fl.asiento_id
      JOIN public.usuario u ON u.id = fl.creado_por
     ${filtroFondo}
     ORDER BY fl.fecha_liberacion DESC, fl.creado_en DESC
  `;

  return consultar<FondoLiberacionItem>(sql, params);
}
