import { consultar, consultarUna } from "@/lib/db";

/**
 * Servicio comunitario y reunión mensual: la planilla del mes.
 *
 * Una fila por estudiante activo y por mes, en `registro_servicio`, con
 * `UNIQUE (estudiante_id, mes)`. Ese índice es el que permite que la pantalla
 * escriba con un `ON CONFLICT ... DO UPDATE` y no tenga que preguntar antes si
 * la fila existe: marcar una casilla es una sola escritura, no dos viajes.
 *
 * LA FILA SE CREA AL MARCAR, NO ANTES. No se rellena la tabla con un registro
 * en blanco por cada estudiante y cada mes: "no marcado" y "marcado que no"
 * son lo mismo aquí —no hizo el servicio— y crear filas vacías por adelantado
 * llenaría la tabla de datos que no dicen nada. La planilla une por LEFT JOIN
 * y enseña sin marcar lo que no tiene fila.
 *
 * El mes va como TEXT `YYYY-MM`, que es lo que guarda la columna. Ordena solo
 * y se compara sin convertir.
 */

export type FilaServicio = {
  estudiante_id: string;
  nombre: string;
  programa: string | null;
  tipo: string;
  hizo_servicio: boolean;
  asistio_reunion: boolean;
  notas: string | null;
};

/**
 * La planilla de un mes: TODOS los estudiantes activos, marcados o no.
 *
 * Salen todos y no solo los que tienen registro, porque la pantalla es una
 * lista de asistencia: lo que hay que ver es quién falta por marcar, y una
 * consulta que solo devolviera lo ya marcado enseñaría justo lo contrario.
 */
export async function planillaDelMes(mes: string): Promise<FilaServicio[]> {
  return consultar<FilaServicio>(
    `SELECT e.id AS estudiante_id,
            e.nombre,
            e.programa,
            e.tipo::text AS tipo,
            coalesce(r.hizo_servicio, FALSE)   AS hizo_servicio,
            coalesce(r.asistio_reunion, FALSE) AS asistio_reunion,
            r.notas
       FROM estudiante e
       LEFT JOIN registro_servicio r
              ON r.estudiante_id = e.id AND r.mes = $1
      WHERE e.estado = 'activo'
      ORDER BY e.nombre`,
    [mes],
  );
}

export type ResumenServicio = {
  total: number;
  con_servicio: number;
  con_reunion: number;
  /** El mes actual según la BASE, en `YYYY-MM`. */
  mes_actual: string;
};

/**
 * Las cifras del mes.
 *
 * `mes_actual` sale de la base y no de `new Date()`: es el valor por omisión
 * del selector, y con la zona horaria del proceso un despliegue en otro huso
 * abriría la planilla del mes equivocado el día 1.
 */
export async function resumenDelMes(mes: string): Promise<ResumenServicio> {
  const fila = await consultarUna<ResumenServicio>(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE coalesce(r.hizo_servicio, FALSE))::int   AS con_servicio,
            count(*) FILTER (WHERE coalesce(r.asistio_reunion, FALSE))::int AS con_reunion,
            (SELECT to_char(CURRENT_DATE, 'YYYY-MM')) AS mes_actual
       FROM estudiante e
       LEFT JOIN registro_servicio r
              ON r.estudiante_id = e.id AND r.mes = $1
      WHERE e.estado = 'activo'`,
    [mes],
  );

  return fila ?? { total: 0, con_servicio: 0, con_reunion: 0, mes_actual: "" };
}

/**
 * Los doce meses hasta el actual, del más reciente al más antiguo.
 *
 * Se generan en SQL con `generate_series` en vez de en JavaScript por lo mismo
 * de siempre: el mes actual lo decide la base. Doce es lo que pide la guía y
 * cubre el año lectivo completo.
 */
export async function ultimosDoceMeses(): Promise<string[]> {
  const filas = await consultar<{ mes: string }>(
    `SELECT to_char(fecha, 'YYYY-MM') AS mes
       FROM generate_series(
              date_trunc('month', CURRENT_DATE) - INTERVAL '11 months',
              date_trunc('month', CURRENT_DATE),
              INTERVAL '1 month'
            ) AS fecha
      ORDER BY fecha DESC`,
  );

  return filas.map((fila) => fila.mes);
}
