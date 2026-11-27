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
  tasa_compra: string | null;
  tasa_venta: string | null;
  tarifa: string | null;
  saldo: string;
  /** Equivalente en pesos con la tasa de referencia de hoy; null si no hay tasa. */
  saldo_dop: string | null;
  /** Suma neta de movimientos bancarios del extracto ya conciliados. */
  saldo_conciliado: string;
  /** Suma neta de movimientos bancarios del extracto aún sin conciliar. */
  saldo_sin_conciliar: string;
  estado: "activa" | "cerrada";
  movimientos: number;
  /** Fecha (DD/MM/YYYY) de la última vez que se concilió esta cuenta. */
  ultima_conciliacion: string | null;
  /** La cuenta contable auxiliar del banco: con ella se buscan los asientos a conciliar. */
  cuenta_contable_id: string;
  cuenta_contable: string;
};

export async function cuentasConSaldo(): Promise<CuentaConSaldo[]> {
  return consultar<CuentaConSaldo>(
    `SELECT cb.id, cb.nombre, b.nombre AS banco, cb.numero, cb.tipo, cb.moneda, cb.estado,
            cb.tasa_compra::text AS tasa_compra,
            cb.tasa_venta::text AS tasa_venta,
            cb.tarifa::numeric(14,2)::text AS tarifa,
            (cb.saldo_inicial + coalesce(s.suma, 0))::text AS saldo,
            CASE cb.moneda
              WHEN 'DOP' THEN (cb.saldo_inicial + coalesce(s.suma, 0))
              ELSE round((cb.saldo_inicial + coalesce(s.suma, 0))
                         * contabilidad.tasa_referencia((now() AT TIME ZONE 'America/Santo_Domingo')::date), 2)
            END::text AS saldo_dop,
            coalesce((
              SELECT sum(e.monto)
                FROM contabilidad.extracto_linea e
               WHERE e.cuenta_id = cb.id
                 AND EXISTS (
                   SELECT 1 FROM contabilidad.conciliacion_partida p
                    WHERE p.extracto_linea_id = e.id AND p.anulado_en IS NULL
                 )
            ), 0)::numeric(14,2)::text AS saldo_conciliado,
            coalesce((
              SELECT sum(e.monto)
                FROM contabilidad.extracto_linea e
               WHERE e.cuenta_id = cb.id
                 AND NOT EXISTS (
                   SELECT 1 FROM contabilidad.conciliacion_partida p
                    WHERE p.extracto_linea_id = e.id AND p.anulado_en IS NULL
                 )
            ), 0)::numeric(14,2)::text AS saldo_sin_conciliar,
            coalesce(s.n, 0)::int AS movimientos,
            (SELECT to_char(max(p.conciliado_en AT TIME ZONE 'America/Santo_Domingo'), 'DD/MM/YYYY')
               FROM contabilidad.conciliacion_partida p
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
       FROM contabilidad.tasa_cambio WHERE fecha <= (now() AT TIME ZONE 'America/Santo_Domingo')::date
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

// ── Movimientos del estado de cuenta bancario (0129) ───────────────────

export type FiltroExtracto = {
  desde: string | null;
  hasta: string | null;
  tipo: "retiro" | "deposito" | null;
  q: string | null;
};

export function leerFiltroExtracto(crudo: Record<string, string | string[] | undefined>): FiltroExtracto {
  const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v ?? "").trim();
  const desde = uno(crudo.desde);
  const hasta = uno(crudo.hasta);
  const tipo = uno(crudo.tipo);
  const q = uno(crudo.q).slice(0, 120);
  return {
    desde: esFechaIso(desde) ? desde : null,
    hasta: esFechaIso(hasta) ? hasta : null,
    tipo: tipo === "retiro" || tipo === "deposito" ? tipo : null,
    q: q || null,
  };
}

export type FilaExtractoMovimiento = {
  id: string;
  fecha_posteo: string | null;
  fecha: string;
  no_cheque: string | null;
  referencia: string | null;
  descripcion: string;
  retiros: string;
  depositos: string;
  monto: string;
  saldo: string | null;
  conciliada: boolean;
};

/** Transacciones subidas del estado de cuenta (.csv) con filtros funcionales. */
export async function extractoDeBanco(
  cuentaId: string,
  filtro: FiltroExtracto,
): Promise<FilaExtractoMovimiento[]> {
  return consultar<FilaExtractoMovimiento>(
    `SELECT e.id,
            e.fecha_posteo::text AS fecha_posteo,
            e.fecha::text AS fecha,
            e.no_cheque,
            e.referencia,
            e.descripcion,
            CASE WHEN e.retiros > 0 THEN e.retiros
                 WHEN e.monto < 0 THEN -e.monto
                 ELSE 0 END::numeric(14,2)::text AS retiros,
            CASE WHEN e.depositos > 0 THEN e.depositos
                 WHEN e.monto > 0 THEN e.monto
                 ELSE 0 END::numeric(14,2)::text AS depositos,
            e.monto::numeric(14,2)::text AS monto,
            e.saldo::numeric(14,2)::text AS saldo,
            EXISTS (
              SELECT 1 FROM contabilidad.conciliacion_partida p
               WHERE p.extracto_linea_id = e.id AND p.anulado_en IS NULL
            ) AS conciliada
       FROM contabilidad.extracto_linea e
      WHERE e.cuenta_id = $1
        AND ($2::date IS NULL OR e.fecha >= $2)
        AND ($3::date IS NULL OR e.fecha <= $3)
        AND (
          $4::text IS NULL
          OR ($4 = 'retiro' AND (e.retiros > 0 OR e.monto < 0))
          OR ($4 = 'deposito' AND (e.depositos > 0 OR e.monto > 0))
        )
        AND (
          $5::text IS NULL
          OR e.descripcion ILIKE '%' || $5 || '%'
          OR coalesce(e.referencia, '') ILIKE '%' || $5 || '%'
          OR coalesce(e.no_cheque, '') ILIKE '%' || $5 || '%'
        )
      ORDER BY e.fecha DESC, e.importado_en DESC, e.id DESC
      LIMIT 500`,
    [cuentaId, filtro.desde, filtro.hasta, filtro.tipo, filtro.q],
  );
}

// ── Conciliación partida por partida (0081) ────────────────────────────

/** Una transacción del estado de cuenta que todavía no tiene pareja. */
export type LineaExtracto = {
  id: string;
  fecha: string;
  descripcion: string;
  referencia: string | null;
  retiros: string;
  depositos: string;
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
  /** Referencia del pago/recibo/transferencia asociado al asiento, si existe. */
  referencia: string | null;
  debe: string;
  haber: string;
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
      `SELECT e.id,
              e.fecha::text AS fecha,
              e.descripcion,
              e.referencia,
              CASE WHEN e.retiros > 0 THEN e.retiros
                   WHEN e.monto < 0 THEN -e.monto
                   ELSE 0 END::numeric(14,2)::text AS retiros,
              CASE WHEN e.depositos > 0 THEN e.depositos
                   WHEN e.monto > 0 THEN e.monto
                   ELSE 0 END::numeric(14,2)::text AS depositos,
              e.monto::numeric(14,2)::text AS monto
         FROM contabilidad.extracto_linea e
        WHERE e.cuenta_id = $1
          AND NOT EXISTS (SELECT 1 FROM contabilidad.conciliacion_partida p
                           WHERE p.extracto_linea_id = e.id AND p.anulado_en IS NULL)
        ORDER BY e.fecha, e.id
        LIMIT 500`,
      [cuentaId],
    ),
    consultar<LineaAsientoBanco>(
      `SELECT l.id,
              a.id AS asiento_id,
              a.numero::text AS numero,
              a.fecha::text AS fecha,
              coalesce(l.descripcion, a.concepto) AS concepto,
              coalesce(nullif(trim(r.referencia), ''), nullif(trim(ti.referencia), '')) AS referencia,
              l.debe::numeric(14,2)::text AS debe,
              l.haber::numeric(14,2)::text AS haber,
              (l.debe - l.haber)::numeric(14,2)::text AS monto
         FROM contabilidad.cuenta_bancaria cb
         JOIN contabilidad.asiento_linea l ON l.cuenta_id = cb.cuenta_contable_id
         JOIN contabilidad.asiento a ON a.id = l.asiento_id
         LEFT JOIN contabilidad.recibo r ON r.asiento_id = a.id
         LEFT JOIN contabilidad.transferencia_interna ti ON ti.asiento_id = a.id
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
      ORDER BY contabilidad.clave_codigo(codigo)`,
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

export type SolicitudCambioBanco = {
  id: string;
  cuenta_id: string;
  solicitado_por: string;
  solicitante_nombre: string;
  solicitado_en: string;
  nombre: string;
  numero: string;
  moneda: Moneda;
  tasa_compra: string | null;
  tasa_venta: string | null;
  tarifa: string | null;
  cuenta_contable_id: string;
  cuenta_contable: string;
  saldo_actual: string;
  motivo: string;
  estado: "pendiente" | "aprobada" | "rechazada";
};

/**
 * Solicitudes pendientes de cambio de configuración para una cuenta bancaria.
 * Contabilidad ve todas; otros roles ven solo las suyas.
 */
export async function solicitudesCambioBanco(
  cuentaId: string,
  soloUsuarioId?: string,
): Promise<SolicitudCambioBanco[]> {
  return consultar<SolicitudCambioBanco>(
    `SELECT s.id,
            s.cuenta_id,
            s.solicitado_por,
            u.nombre AS solicitante_nombre,
            to_char(s.solicitado_en AT TIME ZONE 'America/Santo_Domingo', 'YYYY-MM-DD HH24:MI') AS solicitado_en,
            s.nombre,
            s.numero,
            s.moneda,
            s.tasa_compra::text AS tasa_compra,
            s.tasa_venta::text AS tasa_venta,
            s.tarifa::numeric(14,2)::text AS tarifa,
            s.cuenta_contable_id,
            cc.codigo || ' · ' || cc.nombre AS cuenta_contable,
            s.saldo_actual::numeric(14,2)::text AS saldo_actual,
            s.motivo,
            s.estado
       FROM contabilidad.solicitud_cambio_cuenta_bancaria s
       JOIN public.usuario u ON u.id = s.solicitado_por
       JOIN contabilidad.cuenta_contable cc ON cc.id = s.cuenta_contable_id
      WHERE s.cuenta_id = $1
        AND s.estado = 'pendiente'
        AND ($2::uuid IS NULL OR s.solicitado_por = $2)
      ORDER BY s.solicitado_en DESC
      LIMIT 20`,
    [cuentaId, soloUsuarioId ?? null],
  );
}
