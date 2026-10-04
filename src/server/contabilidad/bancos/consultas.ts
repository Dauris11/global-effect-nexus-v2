import { consultar, consultarUna } from "@/lib/db";
import {
  esFechaIso,
  esTipoMovimientoBanco,
  esUuid,
  type Moneda,
  type TipoMovimientoBanco,
} from "@/lib/contabilidad/formato";

/**
 * Bancos y libros de banco (§4.2).
 *
 * El saldo de una cuenta es `saldo_inicial + Σ importe` de sus movimientos
 * VIGENTES. Lo calcula la base, siempre: es la cifra que alguien va a
 * comparar con el estado de cuenta del banco, y no puede pasar por un
 * float de JavaScript. Los anulados no suman pero se siguen viendo en el
 * libro, tachados: borrarlos de la vista sería esconder lo que pasó.
 */

export type CuentaConSaldo = {
  id: string;
  nombre: string;
  banco: string;
  numero: string;
  tipo: "corriente" | "ahorro";
  moneda: Moneda;
  saldo: string;
  /** Equivalente en pesos con la tasa de referencia de hoy; null si no hay tasa. */
  saldo_dop: string | null;
  estado: "activa" | "cerrada";
  movimientos: number;
  ultima_conciliacion: string | null;
};

export async function cuentasConSaldo(): Promise<CuentaConSaldo[]> {
  return consultar<CuentaConSaldo>(
    `SELECT cb.id, cb.nombre, b.nombre AS banco, cb.numero, cb.tipo, cb.moneda, cb.estado,
            (cb.saldo_inicial + coalesce(s.suma, 0))::text AS saldo,
            CASE cb.moneda
              WHEN 'DOP' THEN (cb.saldo_inicial + coalesce(s.suma, 0))
              ELSE round((cb.saldo_inicial + coalesce(s.suma, 0))
                         * contabilidad.tasa_referencia(CURRENT_DATE), 2)
            END::text AS saldo_dop,
            coalesce(s.n, 0)::int AS movimientos,
            (SELECT max(c.hasta)::text FROM contabilidad.conciliacion c
              WHERE c.cuenta_id = cb.id AND c.estado = 'cerrada') AS ultima_conciliacion
       FROM contabilidad.cuenta_bancaria cb
       JOIN contabilidad.banco b ON b.id = cb.banco_id
       LEFT JOIN LATERAL (
         SELECT sum(m.importe) AS suma, count(*) AS n
           FROM contabilidad.movimiento_bancario m
          WHERE m.cuenta_id = cb.id AND m.estado = 'vigente'
       ) s ON true
      ORDER BY cb.estado, b.nombre, cb.moneda, cb.nombre`,
  );
}

export async function cuentaPorId(id: string): Promise<CuentaConSaldo | null> {
  if (!esUuid(id)) return null;
  const cuentas = await cuentasConSaldo();
  return cuentas.find((cuenta) => cuenta.id === id) ?? null;
}

export type TasaDelDia = { fecha: string; compra: string; venta: string; fuente: string };

/** La tasa vigente hoy (la de hoy o la última anterior). */
export async function tasaVigente(): Promise<TasaDelDia | null> {
  return consultarUna<TasaDelDia>(
    `SELECT fecha::text AS fecha, compra::text AS compra, venta::text AS venta, fuente
       FROM contabilidad.tasa_cambio WHERE fecha <= CURRENT_DATE
      ORDER BY fecha DESC LIMIT 1`,
  );
}

export type FiltroLibro = {
  desde: string | null;
  hasta: string | null;
  tipo: TipoMovimientoBanco | null;
};

export function leerFiltroLibro(crudo: Record<string, string | string[] | undefined>): FiltroLibro {
  const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v ?? "").trim();
  const desde = uno(crudo.desde);
  const hasta = uno(crudo.hasta);
  const tipo = uno(crudo.tipo);
  return {
    desde: esFechaIso(desde) ? desde : null,
    hasta: esFechaIso(hasta) ? hasta : null,
    tipo: esTipoMovimientoBanco(tipo) ? tipo : null,
  };
}

export type FilaLibro = {
  id: string;
  numero: string;
  fecha: string;
  tipo: TipoMovimientoBanco;
  concepto: string;
  referencia: string | null;
  beneficiario: string | null;
  cheque_numero: string | null;
  estado_cheque: string | null;
  importe: string;
  /** Saldo después de este movimiento; null en los anulados. */
  saldo: string | null;
  estado: "vigente" | "anulado";
  conciliado: boolean;
  origen_tabla: string | null;
  origen_id: string | null;
};

export type Libro = {
  saldoInicial: string;
  saldoFinal: string;
  entradas: string;
  salidas: string;
  filas: FilaLibro[];
};

/**
 * El libro de una cuenta en un rango, con saldo corrido.
 *
 * El saldo corrido se calcula sobre TODA la historia y después se recorta
 * al rango: si se calculara solo dentro del rango, la primera fila de
 * marzo empezaría de cero en vez de arrancar con lo que dejó febrero. El
 * filtro por tipo, en cambio, NO toca el saldo: filtrar "solo cheques" no
 * cambia lo que hay en el banco.
 */
export async function libroDeBanco(cuentaId: string, filtro: FiltroLibro): Promise<Libro> {
  const filas = await consultar<FilaLibro>(
    `WITH historia AS (
       SELECT m.*,
              CASE WHEN m.estado = 'vigente' THEN
                cb.saldo_inicial + sum(CASE WHEN m.estado = 'vigente' THEN m.importe ELSE 0 END)
                  OVER (ORDER BY m.fecha, m.numero)
              END AS saldo_corrido
         FROM contabilidad.movimiento_bancario m
         JOIN contabilidad.cuenta_bancaria cb ON cb.id = m.cuenta_id
        WHERE m.cuenta_id = $1
     )
     SELECT id, numero::text AS numero, fecha::text AS fecha, tipo, concepto, referencia,
            beneficiario, cheque_numero::text AS cheque_numero, estado_cheque,
            importe::text AS importe, saldo_corrido::text AS saldo, estado,
            conciliacion_id IS NOT NULL AS conciliado, origen_tabla, origen_id
       FROM historia
      WHERE ($2::date IS NULL OR fecha >= $2)
        AND ($3::date IS NULL OR fecha <= $3)
        AND ($4::text IS NULL OR tipo = $4)
      ORDER BY fecha DESC, numero DESC
      LIMIT 500`,
    [cuentaId, filtro.desde, filtro.hasta, filtro.tipo],
  );

  const totales = await consultarUna<Omit<Libro, "filas">>(
    `SELECT (cb.saldo_inicial + coalesce(sum(m.importe) FILTER (
               WHERE $2::date IS NOT NULL AND m.fecha < $2), 0))::text AS "saldoInicial",
            (cb.saldo_inicial + coalesce(sum(m.importe) FILTER (
               WHERE $3::date IS NULL OR m.fecha <= $3), 0))::text AS "saldoFinal",
            coalesce(sum(m.importe) FILTER (
               WHERE m.importe > 0 AND ($2::date IS NULL OR m.fecha >= $2)
                 AND ($3::date IS NULL OR m.fecha <= $3)), 0)::text AS entradas,
            coalesce(-sum(m.importe) FILTER (
               WHERE m.importe < 0 AND ($2::date IS NULL OR m.fecha >= $2)
                 AND ($3::date IS NULL OR m.fecha <= $3)), 0)::text AS salidas
       FROM contabilidad.cuenta_bancaria cb
       LEFT JOIN contabilidad.movimiento_bancario m
              ON m.cuenta_id = cb.id AND m.estado = 'vigente'
      WHERE cb.id = $1
      GROUP BY cb.saldo_inicial`,
    [cuentaId, filtro.desde, filtro.hasta],
  );

  return {
    saldoInicial: totales?.saldoInicial ?? "0",
    saldoFinal: totales?.saldoFinal ?? "0",
    entradas: totales?.entradas ?? "0",
    salidas: totales?.salidas ?? "0",
    filas,
  };
}

export type FilaConciliacion = {
  id: string;
  desde: string;
  hasta: string;
  saldo_banco: string;
  estado: "abierta" | "cerrada";
  lineas: number;
  confirmadas: number;
  creado_por: string;
};

export async function conciliacionesDeCuenta(cuentaId: string): Promise<FilaConciliacion[]> {
  return consultar<FilaConciliacion>(
    `SELECT c.id, c.desde::text AS desde, c.hasta::text AS hasta, c.saldo_banco::text AS saldo_banco,
            c.estado, u.nombre AS creado_por,
            (SELECT count(*)::int FROM contabilidad.conciliacion_linea l WHERE l.conciliacion_id = c.id) AS lineas,
            (SELECT count(*)::int FROM contabilidad.conciliacion_linea l
              WHERE l.conciliacion_id = c.id AND l.confirmada) AS confirmadas
       FROM contabilidad.conciliacion c
       JOIN usuario u ON u.id = c.creado_por
      WHERE c.cuenta_id = $1
      ORDER BY c.hasta DESC`,
    [cuentaId],
  );
}

export type LineaConciliacion = {
  id: string;
  linea: number;
  fecha: string;
  descripcion: string;
  referencia: string | null;
  monto: string;
  confirmada: boolean;
  movimiento_id: string | null;
  movimiento_numero: string | null;
  movimiento_fecha: string | null;
  movimiento_concepto: string | null;
};

export type PartidaTransito = {
  id: string;
  numero: string;
  fecha: string;
  tipo: TipoMovimientoBanco;
  concepto: string;
  importe: string;
};

export type DetalleConciliacion = {
  id: string;
  cuenta_id: string;
  cuenta: string;
  moneda: Moneda;
  desde: string;
  hasta: string;
  saldo_banco: string;
  estado: "abierta" | "cerrada";
  archivo_nombre: string | null;
  cerrada_por: string | null;
  cerrada_en: string | null;
  /** Saldo según libros al `hasta`. */
  saldo_libros: string;
  lineas: LineaConciliacion[];
  /** En libros y no en el banco: depósitos y cheques en tránsito. */
  transito: PartidaTransito[];
};

/**
 * Todo lo que necesita el reporte de conciliación: el saldo según el
 * banco, el saldo según libros al cierre del rango, lo que el banco trae y
 * los libros no (líneas sin pareja) y lo que los libros traen y el banco
 * todavía no (partidas en tránsito). La cuadratura la hace la pantalla con
 * sumas que también salen de aquí, ya hechas por la base.
 */
export async function conciliacionPorId(id: string): Promise<DetalleConciliacion | null> {
  if (!esUuid(id)) return null;

  const cabecera = await consultarUna<Omit<DetalleConciliacion, "lineas" | "transito">>(
    `SELECT c.id, c.cuenta_id, cb.nombre AS cuenta, cb.moneda, c.desde::text AS desde,
            c.hasta::text AS hasta, c.saldo_banco::text AS saldo_banco, c.estado,
            c.archivo_nombre, u.nombre AS cerrada_por, c.cerrada_en::text AS cerrada_en,
            (cb.saldo_inicial + coalesce((
               SELECT sum(m.importe) FROM contabilidad.movimiento_bancario m
                WHERE m.cuenta_id = cb.id AND m.estado = 'vigente' AND m.fecha <= c.hasta), 0))::text
              AS saldo_libros
       FROM contabilidad.conciliacion c
       JOIN contabilidad.cuenta_bancaria cb ON cb.id = c.cuenta_id
       LEFT JOIN usuario u ON u.id = c.cerrada_por
      WHERE c.id = $1`,
    [id],
  );
  if (!cabecera) return null;

  const [lineas, transito] = await Promise.all([
    consultar<LineaConciliacion>(
      `SELECT l.id, l.linea, l.fecha::text AS fecha, l.descripcion, l.referencia,
              l.monto::text AS monto, l.confirmada, l.movimiento_id,
              m.numero::text AS movimiento_numero, m.fecha::text AS movimiento_fecha,
              m.concepto AS movimiento_concepto
         FROM contabilidad.conciliacion_linea l
         LEFT JOIN contabilidad.movimiento_bancario m ON m.id = l.movimiento_id
        WHERE l.conciliacion_id = $1
        ORDER BY l.fecha, l.linea`,
      [id],
    ),
    // Movimientos vigentes hasta el cierre que no quedaron conciliados en
    // ninguna conciliación anterior ni emparejados en esta.
    consultar<PartidaTransito>(
      `SELECT m.id, m.numero::text AS numero, m.fecha::text AS fecha, m.tipo, m.concepto,
              m.importe::text AS importe
         FROM contabilidad.movimiento_bancario m
         JOIN contabilidad.conciliacion c ON c.id = $1
        WHERE m.cuenta_id = c.cuenta_id
          AND m.estado = 'vigente'
          AND m.fecha <= c.hasta
          AND m.conciliacion_id IS NULL
          AND NOT EXISTS (SELECT 1 FROM contabilidad.conciliacion_linea l
                           WHERE l.conciliacion_id = c.id AND l.movimiento_id = m.id)
        ORDER BY m.fecha, m.numero`,
      [id],
    ),
  ]);

  return { ...cabecera, lineas, transito };
}

/**
 * Configuración del estado de cuenta del banco de una cuenta, para
 * precargar el formulario de importación.
 */
export async function configuracionEstado(
  cuentaId: string,
): Promise<{ adaptador: string; config: Record<string, string> } | null> {
  return consultarUna(
    `SELECT b.adaptador, b.config_estado AS config
       FROM contabilidad.cuenta_bancaria cb JOIN contabilidad.banco b ON b.id = cb.banco_id
      WHERE cb.id = $1`,
    [cuentaId],
  );
}
