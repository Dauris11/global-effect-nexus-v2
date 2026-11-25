import { consultar, consultarUna } from "@/lib/db";
import { esUuid } from "@/lib/contabilidad/formato";
import type { PilarCosto } from "@/lib/costos";

/*
 * Costo integral por estudiante. Todo sale de las vistas de la migración 0112
 * (`v_estudiante_costo_total` y `v_estudiante_costo_detalle`), que ya resuelven
 * el doble conteo entre factura, orden de compra y rendición.
 *
 * Estas funciones NO comprueban permisos: quien las llama (página, ruta de
 * exportación) exige `expedientes.costos.leer` antes. Las cifras son de la
 * Junta y de contabilidad; nunca llegan al portal del estudiante.
 *
 * Los importes salen como número (`::float8`) porque solo se pintan y se
 * promedian; no se guardan ni se vuelven a sumar en el cliente.
 */

export type ResumenCostoEstudiante = {
  estudiante_id: string;
  nombre: string;
  estado: string;
  universidad: string | null;
  carrera: string | null;
  total_universidad: number;
  total_materiales: number;
  total_transporte: number;
  total_rendiciones: number;
  costo_total_acumulado: number;
  cuatrimestres_cursados: number;
  aportes_patrocinador: number;
};

const COLUMNAS_RESUMEN = `estudiante_id, nombre, estado, universidad, carrera,
  total_universidad::float8, total_materiales::float8, total_transporte::float8,
  total_rendiciones::float8, costo_total_acumulado::float8,
  cuatrimestres_cursados, aportes_patrocinador::float8`;

export async function costoDeEstudiante(estudianteId: string): Promise<ResumenCostoEstudiante | null> {
  if (!esUuid(estudianteId)) return null;

  return consultarUna<ResumenCostoEstudiante>(
    `SELECT ${COLUMNAS_RESUMEN} FROM public.v_estudiante_costo_total WHERE estudiante_id = $1`,
    [estudianteId],
  );
}

export type GastoEstudiante = {
  fecha: string;
  pilar: PilarCosto;
  concepto: string;
  origen: string | null;
  referencia: string | null;
  monto: number;
  fuente: "factura" | "orden_compra" | "material" | "transporte" | "rendicion";
};

export async function gastosDeEstudiante(estudianteId: string): Promise<GastoEstudiante[]> {
  if (!esUuid(estudianteId)) return [];

  return consultar<GastoEstudiante>(
    `SELECT fecha::text AS fecha, pilar, concepto, origen, referencia,
            monto_dop::float8 AS monto, fuente
       FROM public.v_estudiante_costo_detalle
      WHERE estudiante_id = $1
      ORDER BY fecha DESC, concepto`,
    [estudianteId],
  );
}

export type PeriodoCosto = { id: string; nombre: string; desde: string; hasta: string };

/** Los cuatrimestres, para filtrar el desglose por fechas. */
export async function periodosParaCostos(): Promise<PeriodoCosto[]> {
  return consultar<PeriodoCosto>(
    `SELECT id, nombre, fecha_inicio::text AS desde, fecha_fin::text AS hasta
       FROM public.periodo
      WHERE tipo = 'cuatrimestre'
      ORDER BY fecha_inicio DESC`,
  );
}

export type FilaCostoCarrera = {
  universidad: string;
  carrera: string;
  becados: number;
  con_costo: number;
  graduados: number;
  total_invertido: number;
  /** Promedio entre los becados con algún costo registrado: los ceros del arranque no bajan la media. */
  promedio_por_becado: number | null;
  promedio_por_cuatrimestre: number | null;
  promedio_por_graduado: number | null;
};

export async function costoPorCarrera(): Promise<FilaCostoCarrera[]> {
  return consultar<FilaCostoCarrera>(
    `SELECT COALESCE(universidad, '—') AS universidad,
            COALESCE(carrera, '—') AS carrera,
            count(*)::int AS becados,
            count(*) FILTER (WHERE costo_total_acumulado > 0)::int AS con_costo,
            count(*) FILTER (WHERE estado = 'graduado')::int AS graduados,
            COALESCE(sum(costo_total_acumulado), 0)::float8 AS total_invertido,
            (avg(costo_total_acumulado) FILTER (WHERE costo_total_acumulado > 0))::float8 AS promedio_por_becado,
            (avg(costo_total_acumulado / cuatrimestres_cursados) FILTER (WHERE costo_total_acumulado > 0))::float8
              AS promedio_por_cuatrimestre,
            (avg(costo_total_acumulado) FILTER (WHERE estado = 'graduado' AND costo_total_acumulado > 0))::float8
              AS promedio_por_graduado
       FROM public.v_estudiante_costo_total
      GROUP BY 1, 2
      ORDER BY total_invertido DESC, 1, 2`,
  );
}

export async function costoPorEstudiante(): Promise<ResumenCostoEstudiante[]> {
  return consultar<ResumenCostoEstudiante>(
    `SELECT ${COLUMNAS_RESUMEN}
       FROM public.v_estudiante_costo_total
      ORDER BY costo_total_acumulado DESC, nombre`,
  );
}
