import { consultar, consultarUna } from "@/lib/db";

/**
 * Finanzas: lo que entra y lo que sale de la Fundación.
 *
 * DOS REGLAS QUE NO SE NEGOCIAN EN ESTE ARCHIVO.
 *
 *   1. **Las sumas se hacen en SQL, nunca en JavaScript.** `monto` es
 *      NUMERIC(12,2) y `pg` lo entrega como TEXTO justamente para no perder
 *      precisión al convertirlo. Sumar en el servidor de Node obligaría a
 *      pasar por `float`, y un balance es el número que alguien va a comparar
 *      con un extracto bancario. Los `::float8` que hay aquí están todos DESPUÉS
 *      del `sum()`: se convierte el resultado para poder dibujarlo, no los
 *      sumandos.
 *
 *   2. **Las cifras de cabecera se calculan sobre el conjunto filtrado entero,
 *      no sobre las filas que se pintan.** La lista está topada en 200; un
 *      "total de ingresos" sumado sobre las 200 más recientes no sería el
 *      ingreso de nadie. Por eso el resumen es su propia consulta y repite el
 *      WHERE en vez de contar en memoria lo que ya se trajo.
 *
 * El mes se filtra con `to_char(fecha, 'YYYY-MM')` y no con un BETWEEN de dos
 * fechas construidas en JavaScript: el navegador de quien mira puede estar en
 * otra zona horaria y `fecha` es DATE, sin hora ni zona. Comparar textos de
 * año-mes da el mismo resultado en Santo Domingo y en Madrid.
 */

/** Tope de filas de la lista de movimientos. */
const TOPE = 200;

export type FiltroFinanzas = {
  busqueda?: string | null;
  tipo?: string | null;
  categoria?: string | null;
  /** `YYYY-MM`, o nulo para todos los meses. */
  mes?: string | null;
};

/** El WHERE compartido por todas las consultas de abajo, con sus 4 parámetros. */
const CONDICION = `($1::text IS NULL
                    OR t.concepto  ILIKE '%' || $1 || '%'
                    OR t.referencia ILIKE '%' || $1 || '%')
               AND ($2::text IS NULL OR t.tipo::text = $2)
               AND ($3::text IS NULL OR t.categoria = $3)
               AND ($4::text IS NULL OR to_char(t.fecha, 'YYYY-MM') = $4)`;

function parametros(filtro: FiltroFinanzas): unknown[] {
  return [
    filtro.busqueda?.trim() || null,
    filtro.tipo || null,
    filtro.categoria || null,
    filtro.mes || null,
  ];
}

export type Movimiento = {
  id: string;
  concepto: string;
  tipo: string;
  monto: number;
  categoria: string;
  fecha: string;
  referencia: string | null;
  notas: string | null;
};

/**
 * Los movimientos del filtro, del más reciente al más antiguo.
 *
 * El orden secundario es `created_at DESC` y no el id: varias transacciones del
 * mismo día son lo normal —una jornada de donaciones son diez filas con la
 * misma fecha— y sin un segundo criterio estable la lista se reordena sola
 * entre recargas.
 */
export async function movimientos(
  filtro: FiltroFinanzas = {},
): Promise<Movimiento[]> {
  return consultar<Movimiento>(
    `SELECT t.id,
            t.concepto,
            t.tipo::text AS tipo,
            t.monto::float8 AS monto,
            t.categoria,
            t.fecha::text AS fecha,
            t.referencia,
            t.notas
       FROM transaccion t
      WHERE ${CONDICION}
      ORDER BY t.fecha DESC, t.created_at DESC
      LIMIT $5`,
    [...parametros(filtro), TOPE + 1],
  );
}

export type ResumenFinanciero = {
  ingresos: number;
  egresos: number;
  balance: number;
  movimientos: number;
};

/**
 * Ingresos, egresos y balance del conjunto filtrado.
 *
 * El balance lo resta la base (`sum(...) - sum(...)`) y no la vista. Es la
 * misma razón de la cabecera: dos `float` restados en JavaScript pueden dar
 * `-0.000000001` donde la base da `0.00`, y un balance cuadrado que se enseña
 * como "-0.00" hace dudar de todo lo demás.
 */
export async function resumenFinanciero(
  filtro: FiltroFinanzas = {},
): Promise<ResumenFinanciero> {
  const fila = await consultarUna<ResumenFinanciero>(
    `SELECT coalesce(sum(t.monto) FILTER (WHERE t.tipo = 'ingreso'), 0)::float8 AS ingresos,
            coalesce(sum(t.monto) FILTER (WHERE t.tipo = 'egreso'),  0)::float8 AS egresos,
            (coalesce(sum(t.monto) FILTER (WHERE t.tipo = 'ingreso'), 0)
             - coalesce(sum(t.monto) FILTER (WHERE t.tipo = 'egreso'), 0))::float8 AS balance,
            count(*)::int AS movimientos
       FROM transaccion t
      WHERE ${CONDICION}`,
    parametros(filtro),
  );

  return fila ?? { ingresos: 0, egresos: 0, balance: 0, movimientos: 0 };
}

export type RepartoCategoria = {
  categoria: string;
  ingresos: number;
  egresos: number;
  total: number;
};

/**
 * Reparto por categoría, para saber en qué se va el dinero.
 *
 * Ordena por `total` descendente: lo que más pesa, arriba. No se rellenan las
 * categorías sin ningún movimiento —una lista con cinco ceros no dice nada— y
 * por eso la pantalla dibuja las barras con los porcentajes de lo que hay, no
 * con una escala fija.
 */
export async function repartoPorCategoria(
  filtro: FiltroFinanzas = {},
): Promise<RepartoCategoria[]> {
  return consultar<RepartoCategoria>(
    `SELECT t.categoria,
            coalesce(sum(t.monto) FILTER (WHERE t.tipo = 'ingreso'), 0)::float8 AS ingresos,
            coalesce(sum(t.monto) FILTER (WHERE t.tipo = 'egreso'),  0)::float8 AS egresos,
            sum(t.monto)::float8 AS total
       FROM transaccion t
      WHERE ${CONDICION}
      GROUP BY t.categoria
      ORDER BY total DESC`,
    parametros(filtro),
  );
}

/**
 * Los meses que tienen al menos un movimiento, del más reciente al más antiguo.
 *
 * Sale de los datos y no de un `generate_series` de los últimos doce meses: un
 * selector con doce meses vacíos invita a elegir uno y encontrarse una pantalla
 * en blanco sin saber si es que no hay nada o si el filtro está mal. Aquí, si
 * un mes está en la lista, tiene algo dentro.
 *
 * No lleva el filtro: es el selector del propio filtro, y recortarlo con lo ya
 * elegido dejaría un desplegable con una sola opción, la puesta.
 */
export async function mesesConMovimiento(): Promise<string[]> {
  const filas = await consultar<{ mes: string }>(
    `SELECT DISTINCT to_char(fecha, 'YYYY-MM') AS mes
       FROM transaccion
      ORDER BY mes DESC
      LIMIT 60`,
  );

  return filas.map((fila) => fila.mes);
}

/**
 * Las cifras del mes en curso, para el portal de contabilidad.
 *
 * El mes lo decide la BASE con `date_trunc('month', CURRENT_DATE)` y no el
 * reloj del servidor de Node ni el del navegador. Parece lo mismo y no lo es:
 * el primer día del mes, a las 20:00 de Santo Domingo, un servidor en UTC ya
 * está en el día siguiente y uno en Madrid en el mes siguiente. El "balance del
 * mes" de la pantalla de quien lleva las cuentas no puede depender de eso.
 *
 * Una sola definición del balance del mes para todo el sitio (contabilidad y
 * asistente): dos copias son dos cifras que un día dejan de coincidir.
 */
export async function resumenDelMesEnCurso(): Promise<ResumenFinanciero> {
  const fila = await consultarUna<ResumenFinanciero>(
    `SELECT coalesce(sum(monto) FILTER (WHERE tipo = 'ingreso'), 0)::float8 AS ingresos,
            coalesce(sum(monto) FILTER (WHERE tipo = 'egreso'),  0)::float8 AS egresos,
            (coalesce(sum(monto) FILTER (WHERE tipo = 'ingreso'), 0)
             - coalesce(sum(monto) FILTER (WHERE tipo = 'egreso'), 0))::float8 AS balance,
            count(*)::int AS movimientos
       FROM transaccion
      WHERE fecha >= date_trunc('month', CURRENT_DATE)`,
  );

  return fila ?? { ingresos: 0, egresos: 0, balance: 0, movimientos: 0 };
}

/**
 * Los últimos movimientos, sin filtro, para el portal.
 *
 * Va aparte de `movimientos()` y no como un parámetro de tope suyo: aquella
 * trae 201 filas a propósito —la sonda que dice si hay más— y pedirle seis
 * obligaría a que ese detalle viajara a una pantalla a la que no le importa.
 */
export async function ultimosMovimientos(limite = 6): Promise<Movimiento[]> {
  return consultar<Movimiento>(
    `SELECT t.id,
            t.concepto,
            t.tipo::text AS tipo,
            t.monto::float8 AS monto,
            t.categoria,
            t.fecha::text AS fecha,
            t.referencia,
            t.notas
       FROM transaccion t
      ORDER BY t.fecha DESC, t.created_at DESC
      LIMIT $1`,
    [limite],
  );
}

export type MesFinanciero = {
  mes: string;
  ingresos: number;
  egresos: number;
};

/**
 * Ingresos y egresos por mes, para las gráficas.
 *
 * Los meses SIN ningún movimiento no salen de la base, y por eso se rellenan
 * con `generate_series`: sin eso, una gráfica juntaría enero con abril como si
 * fueran meses consecutivos y la línea diría una tendencia que no existió.
 *
 * Era una consulta del panel general (`flujoFinanciero`), que ahora delega
 * aquí: la tienen que dibujar dos pantallas —el panel y los reportes— y dos
 * copias del mismo `generate_series` es una que un día se queda con cinco
 * meses.
 */
export async function flujoMensual(meses = 6): Promise<MesFinanciero[]> {
  return consultar<MesFinanciero>(
    `WITH calendario AS (
       SELECT to_char(mes, 'YYYY-MM') AS mes
         FROM generate_series(
                date_trunc('month', CURRENT_DATE) - make_interval(months => $1::int - 1),
                date_trunc('month', CURRENT_DATE),
                interval '1 month'
              ) AS mes
     )
     SELECT c.mes,
            coalesce(sum(t.monto) FILTER (WHERE t.tipo = 'ingreso'), 0)::float8 AS ingresos,
            coalesce(sum(t.monto) FILTER (WHERE t.tipo = 'egreso'),  0)::float8 AS egresos
       FROM calendario c
       LEFT JOIN transaccion t
              ON to_char(t.fecha, 'YYYY-MM') = c.mes
      GROUP BY c.mes
      ORDER BY c.mes`,
    [meses],
  );
}

/** Si la lista llegó al tope. */
export function hayMasMovimientos(filas: readonly unknown[]): boolean {
  return filas.length > TOPE;
}

/** Recorta al tope, dejando fuera la fila sonda. */
export function recortarMovimientos<T>(filas: readonly T[]): T[] {
  return filas.slice(0, TOPE);
}
