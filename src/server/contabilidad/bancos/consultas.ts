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
  /** Fecha de la última transacción del banco ya conciliada. */
  ultima_conciliacion: string | null;
  /** La cuenta contable auxiliar del banco: con ella se buscan los asientos a conciliar. */
  cuenta_contable_id: string;
  cuenta_contable: string;
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
            (SELECT max(e.fecha)::text
               FROM contabilidad.conciliacion_partida p
               JOIN contabilidad.extracto_linea e ON e.id = p.extracto_linea_id
              WHERE p.cuenta_id = cb.id AND p.anulado_en IS NULL) AS ultima_conciliacion,
            cb.cuenta_contable_id, cc.codigo || ' · ' || cc.nombre AS cuenta_contable
       FROM contabilidad.cuenta_bancaria cb
       JOIN contabilidad.banco b ON b.id = cb.banco_id
       JOIN contabilidad.cuenta_contable cc ON cc.id = cb.cuenta_contable_id
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
            origen_tabla, origen_id
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

// ── Conciliación partida por partida (0081) ────────────────────────────

/** Una transacción del estado de cuenta que todavía no tiene pareja. */
export type LineaExtracto = {
  id: string;
  fecha: string;
  descripcion: string;
  referencia: string | null;
  /** Con signo, como lo dice el banco: + entra, − sale. */
  monto: string;
};

/** Una línea de asiento en la cuenta auxiliar del banco, sin pareja. */
export type LineaAsientoBanco = {
  id: string;
  asiento_id: string;
  numero: string;
  fecha: string;
  concepto: string;
  /** Débito − crédito: el mismo signo que el banco (un débito a Bancos es dinero que entra). */
  monto: string;
};

export type PartidaConciliada = {
  id: string;
  conciliado_en: string;
  conciliado_por: string;
  banco_fecha: string;
  banco_descripcion: string;
  banco_referencia: string | null;
  monto: string;
  asiento_id: string;
  asiento_numero: string;
  asiento_concepto: string;
};

export type PorConciliar = { banco: LineaExtracto[]; libros: LineaAsientoBanco[] };

/**
 * Lo que falta conciliar en la cuenta, de los dos lados. Los asientos son
 * los que tocan la cuenta contable auxiliar del banco, procesados o no (el
 * contable concilia contra lo que registró), y nunca los anulados: lo que
 * se revirtió no pasó por el banco.
 */
export async function porConciliar(cuentaId: string): Promise<PorConciliar> {
  const [banco, libros] = await Promise.all([
    consultar<LineaExtracto>(
      `SELECT e.id, e.fecha::text AS fecha, e.descripcion, e.referencia, e.monto::text AS monto
         FROM contabilidad.extracto_linea e
        WHERE e.cuenta_id = $1
          AND NOT EXISTS (SELECT 1 FROM contabilidad.conciliacion_partida p
                           WHERE p.extracto_linea_id = e.id AND p.anulado_en IS NULL)
        ORDER BY e.fecha, e.id
        LIMIT 500`,
      [cuentaId],
    ),
    consultar<LineaAsientoBanco>(
      `SELECT l.id, a.id AS asiento_id, a.numero::text AS numero, a.fecha::text AS fecha,
              coalesce(l.descripcion, a.concepto) AS concepto, (l.debe - l.haber)::text AS monto
         FROM contabilidad.cuenta_bancaria cb
         JOIN contabilidad.asiento_linea l ON l.cuenta_id = cb.cuenta_contable_id
         JOIN contabilidad.asiento a ON a.id = l.asiento_id
        WHERE cb.id = $1 AND NOT a.anulado
          AND NOT EXISTS (SELECT 1 FROM contabilidad.conciliacion_partida p
                           WHERE p.asiento_linea_id = l.id AND p.anulado_en IS NULL)
        ORDER BY a.fecha, a.numero
        LIMIT 500`,
      [cuentaId],
    ),
  ]);
  return { banco, libros };
}

export async function partidasConciliadas(cuentaId: string): Promise<PartidaConciliada[]> {
  return consultar<PartidaConciliada>(
    `SELECT p.id,
            to_char(p.conciliado_en AT TIME ZONE 'America/Santo_Domingo', 'YYYY-MM-DD') AS conciliado_en,
            u.nombre AS conciliado_por,
            e.fecha::text AS banco_fecha, e.descripcion AS banco_descripcion,
            e.referencia AS banco_referencia, e.monto::text AS monto,
            a.id AS asiento_id, a.numero::text AS asiento_numero, a.concepto AS asiento_concepto
       FROM contabilidad.conciliacion_partida p
       JOIN contabilidad.extracto_linea e ON e.id = p.extracto_linea_id
       JOIN contabilidad.asiento_linea l ON l.id = p.asiento_linea_id
       JOIN contabilidad.asiento a ON a.id = l.asiento_id
       JOIN public.usuario u ON u.id = p.conciliado_por
      WHERE p.cuenta_id = $1 AND p.anulado_en IS NULL
      ORDER BY e.fecha DESC, p.conciliado_en DESC
      LIMIT 500`,
    [cuentaId],
  );
}

export type CuentaAuxiliar = { id: string; codigo: string; nombre: string };

/** Cuentas auxiliares de activo a las que se puede vincular un banco. */
export async function cuentasAuxiliaresDeActivo(): Promise<CuentaAuxiliar[]> {
  return consultar<CuentaAuxiliar>(
    `SELECT id, codigo, nombre FROM contabilidad.cuenta_contable
      WHERE tipo = 'activo' AND admite_movimiento AND activa
      ORDER BY codigo COLLATE "C"`,
  );
}

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
