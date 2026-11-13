import { consultar, consultarUna } from "@/lib/db";
import { requerirPermiso } from "@/lib/auth";

export interface PeriodoMensualItem {
  id: string;
  anio: number;
  mes: number;
  estado: "abierto" | "cerrado";
  cerradoPorNombre: string | null;
  cerradoEn: string | null;
  reabiertoPorNombre: string | null;
  reabiertoEn: string | null;
  motivoReapertura: string | null;
  borradoresRecibos: number;
  borradoresFacturas: number;
  borradoresNominas: number;
  borradoresConteos: number;
  totalAsientos: number;
}

export interface CierreAnualItem {
  id: string;
  ejercicio: number;
  fechaCierre: string;
  asientoCierreId: string | null;
  asientoCierreNumero: number | null;
  totalIngresos: number;
  totalGastos: number;
  superavitDeficit: number;
  cerradoPorNombre: string;
  cerradoEn: string;
  notas: string | null;
}

export interface ResumenPreCierreAnual {
  ejercicio: number;
  yaCerrado: boolean;
  mesesAbiertos: number[];
  todosMesesCerrados: boolean;
  totalIngresos: number;
  totalGastos: number;
  superavitDeficitNeto: number;
  cuentasIngresoSaldar: { cuentaId: string; codigo: string; nombre: string; saldo: number }[];
  cuentasGastoSaldar: { cuentaId: string; codigo: string; nombre: string; saldo: number }[];
}

export async function listarPeriodosContables(ejercicio?: number): Promise<PeriodoMensualItem[]> {
  await requerirPermiso("contabilidad.leer");

  const anio = ejercicio ?? new Date().getFullYear();

  const filas = await consultar<{
    id: string;
    anio: number;
    mes: number;
    estado: "abierto" | "cerrado";
    cerrado_por_nombre: string | null;
    cerrado_en: string | null;
    reabierto_por_nombre: string | null;
    reabierto_en: string | null;
    motivo_reapertura: string | null;
    borradores_recibos: string;
    borradores_facturas: string;
    borradores_nominas: string;
    borradores_conteos: string;
    total_asientos: string;
  }>(
    `SELECT
       p.id,
       p.anio,
       p.mes,
       p.estado,
       COALESCE(uc.nombre, uc.email) AS cerrado_por_nombre,
       p.cerrado_en::text,
       COALESCE(ur.nombre, ur.email) AS reabierto_por_nombre,
       p.reabierto_en::text,
       p.motivo_reapertura,
       (SELECT COUNT(*) FROM contabilidad.recibo r WHERE r.periodo_id = p.id AND r.estado = 'borrador') AS borradores_recibos,
       (SELECT COUNT(*) FROM contabilidad.factura_proveedor fp WHERE fp.periodo_id = p.id AND fp.estado = 'borrador') AS borradores_facturas,
       (SELECT COUNT(*) FROM contabilidad.nomina n WHERE n.anio = p.anio AND n.mes = p.mes AND n.estado = 'borrador') AS borradores_nominas,
       (SELECT COUNT(*) FROM contabilidad.conteo_fisico cf WHERE EXTRACT(YEAR FROM cf.fecha)::int = p.anio AND EXTRACT(MONTH FROM cf.fecha)::int = p.mes AND cf.estado = 'borrador') AS borradores_conteos,
       (SELECT COUNT(*) FROM contabilidad.asiento a WHERE a.periodo_id = p.id AND a.anulado = false) AS total_asientos
     FROM contabilidad.periodo_contable p
     LEFT JOIN public.usuario uc ON uc.id = p.cerrado_por
     LEFT JOIN public.usuario ur ON ur.id = p.reabierto_por
     WHERE p.anio = $1
     ORDER BY p.mes ASC`,
    [anio],
  );

  return filas.map((r) => ({
    id: r.id,
    anio: r.anio,
    mes: r.mes,
    estado: r.estado,
    cerradoPorNombre: r.cerrado_por_nombre,
    cerradoEn: r.cerrado_en,
    reabiertoPorNombre: r.reabierto_por_nombre,
    reabiertoEn: r.reabierto_en,
    motivoReapertura: r.motivo_reapertura,
    borradoresRecibos: Number(r.borradores_recibos),
    borradoresFacturas: Number(r.borradores_facturas),
    borradoresNominas: Number(r.borradores_nominas),
    borradoresConteos: Number(r.borradores_conteos),
    totalAsientos: Number(r.total_asientos),
  }));
}

export async function listarCierresAnuales(): Promise<CierreAnualItem[]> {
  await requerirPermiso("contabilidad.leer");

  const filas = await consultar<{
    id: string;
    ejercicio: number;
    fecha_cierre: string;
    asiento_cierre_id: string | null;
    asiento_cierre_numero: number | null;
    total_ingresos: string;
    total_gastos: string;
    superavit_deficit: string;
    cerrado_por_nombre: string;
    cerrado_en: string;
    notas: string | null;
  }>(
    `SELECT
       ca.id,
       ca.ejercicio,
       ca.fecha_cierre::text,
       ca.asiento_cierre_id,
       a.numero AS asiento_cierre_numero,
       ca.total_ingresos,
       ca.total_gastos,
       ca.superavit_deficit,
       COALESCE(u.nombre, u.email) AS cerrado_por_nombre,
       ca.cerrado_en::text,
       ca.notas
     FROM contabilidad.cierre_anual ca
     JOIN public.usuario u ON u.id = ca.cerrado_por
     LEFT JOIN contabilidad.asiento a ON a.id = ca.asiento_cierre_id
     ORDER BY ca.ejercicio DESC`,
  );

  return filas.map((r) => ({
    id: r.id,
    ejercicio: r.ejercicio,
    fechaCierre: r.fecha_cierre,
    asientoCierreId: r.asiento_cierre_id,
    asientoCierreNumero: r.asiento_cierre_numero,
    totalIngresos: Number(r.total_ingresos),
    totalGastos: Number(r.total_gastos),
    superavitDeficit: Number(r.superavit_deficit),
    cerradoPorNombre: r.cerrado_por_nombre,
    cerradoEn: r.cerrado_en,
    notas: r.notas,
  }));
}

export async function obtenerResumenPreCierreAnual(ejercicio: number): Promise<ResumenPreCierreAnual> {
  await requerirPermiso("contabilidad.leer");

  // Verificar si ya existe cierre
  const filaCierre = await consultarUna<{ id: string }>(
    `SELECT id FROM contabilidad.cierre_anual WHERE ejercicio = $1`,
    [ejercicio],
  );
  const yaCerrado = !!filaCierre;

  // Meses abiertos
  const periodos = await consultar<{ mes: number; estado: string }>(
    `SELECT mes, estado FROM contabilidad.periodo_contable WHERE anio = $1 ORDER BY mes ASC`,
    [ejercicio],
  );
  const mesesAbiertos = periodos.filter((p) => p.estado === "abierto").map((p) => p.mes);
  const todosMesesCerrados = periodos.length === 12 && mesesAbiertos.length === 0;

  // Saldo de cuentas de ingresos y gastos del ejercicio
  const fechaDesde = `${ejercicio}-01-01`;
  const fechaHasta = `${ejercicio}-12-31`;

  const filasCuentas = await consultar<{
    id: string;
    codigo: string;
    nombre: string;
    tipo: "ingreso" | "gasto";
    debe: string;
    haber: string;
  }>(
    `SELECT
       c.id,
       c.codigo,
       c.nombre,
       c.tipo,
       COALESCE(SUM(al.debe), 0) AS debe,
       COALESCE(SUM(al.haber), 0) AS haber
     FROM contabilidad.cuenta_contable c
     JOIN contabilidad.asiento_linea al ON al.cuenta_id = c.id
     JOIN contabilidad.asiento a ON a.id = al.asiento_id
     WHERE c.tipo IN ('ingreso', 'gasto')
       AND c.admite_movimiento = true
       AND a.anulado = false AND a.procesado_en IS NOT NULL
       AND a.fecha BETWEEN $1 AND $2
     GROUP BY c.id, c.codigo, c.nombre, c.tipo
     ORDER BY c.codigo ASC`,
    [fechaDesde, fechaHasta],
  );

  const cuentasIngresoSaldar: { cuentaId: string; codigo: string; nombre: string; saldo: number }[] = [];
  const cuentasGastoSaldar: { cuentaId: string; codigo: string; nombre: string; saldo: number }[] = [];

  let totalIngresos = 0;
  let totalGastos = 0;

  for (const r of filasCuentas) {
    const debe = Number(r.debe);
    const haber = Number(r.haber);

    if (r.tipo === "ingreso") {
      const saldo = haber - debe;
      if (Math.abs(saldo) > 0.001) {
        cuentasIngresoSaldar.push({
          cuentaId: r.id,
          codigo: r.codigo,
          nombre: r.nombre,
          saldo: Number(saldo.toFixed(2)),
        });
        totalIngresos += saldo;
      }
    } else {
      const saldo = debe - haber;
      if (Math.abs(saldo) > 0.001) {
        cuentasGastoSaldar.push({
          cuentaId: r.id,
          codigo: r.codigo,
          nombre: r.nombre,
          saldo: Number(saldo.toFixed(2)),
        });
        totalGastos += saldo;
      }
    }
  }

  const superavitDeficitNeto = Number((totalIngresos - totalGastos).toFixed(2));

  return {
    ejercicio,
    yaCerrado,
    mesesAbiertos,
    todosMesesCerrados,
    totalIngresos: Number(totalIngresos.toFixed(2)),
    totalGastos: Number(totalGastos.toFixed(2)),
    superavitDeficitNeto,
    cuentasIngresoSaldar,
    cuentasGastoSaldar,
  };
}
