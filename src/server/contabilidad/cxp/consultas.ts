import { consultar, consultarUna } from "@/lib/db";
import { DIAS_POR_VENCER } from "@/lib/contabilidad/cxp";
import { esUuid, type Moneda } from "@/lib/contabilidad/formato";

/**
 * Cuentas por pagar (§4.5): lista, antigüedad de saldos y Gantt.
 *
 * "Vencida" se calcula en la base contra (now() AT TIME ZONE 'America/Santo_Domingo')::date, no en el
 * navegador: la hora de quien mira no decide si una deuda está vencida.
 */

export const ESTADOS_CXP = ["pendiente", "programada", "pagada_parcial", "pagada", "anulada"] as const;
export type EstadoCxp = (typeof ESTADOS_CXP)[number];

export type FilaCxp = {
  id: string;
  origen: "factura" | "solicitud";
  factura_id: string | null;
  solicitud_folio: string | null;
  proveedor_id: string | null;
  tercero: string;
  concepto: string;
  moneda: Moneda;
  monto: string;
  pagado: string;
  saldo: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  fecha_programada: string | null;
  cuenta_salida_id: string | null;
  cuenta_salida: string | null;
  categoria_id: string | null;
  fondo_id: string;
  proyecto_id: string | null;
  proyecto: string | null;
  estado: EstadoCxp;
  /** Días pasados del vencimiento (negativo: faltan). */
  dias_vencida: number;
};

const SELECT_CXP = `
  SELECT x.id, x.origen, x.factura_id, s.folio::text AS solicitud_folio, x.proveedor_id,
         coalesce(p.nombre, x.beneficiario, '—') AS tercero, x.concepto, x.moneda,
         x.monto::text AS monto, x.pagado::text AS pagado, x.saldo::text AS saldo,
         x.fecha_emision::text AS fecha_emision, x.fecha_vencimiento::text AS fecha_vencimiento,
         x.fecha_programada::text AS fecha_programada, x.cuenta_salida_id, cb.nombre AS cuenta_salida,
         x.categoria_id, x.fondo_id, x.proyecto_id, pr.nombre AS proyecto, x.estado,
         ((now() AT TIME ZONE 'America/Santo_Domingo')::date - x.fecha_vencimiento)::int AS dias_vencida
    FROM contabilidad.cuenta_por_pagar x
    LEFT JOIN contabilidad.proveedor p ON p.id = x.proveedor_id
    LEFT JOIN solicitud s ON s.id = x.solicitud_id
    LEFT JOIN contabilidad.cuenta_bancaria cb ON cb.id = x.cuenta_salida_id
    LEFT JOIN proyecto pr ON pr.id = x.proyecto_id`;

export const VENCIMIENTOS_CXP = ["semana", "mes", "mes_siguiente"] as const;
export type VencimientoCxp = (typeof VENCIMIENTOS_CXP)[number];

/** Lo que la lista acepta en `estado`: los de la base más las señales calculadas contra la fecha de hoy. */
export type FiltroEstadoCxp = EstadoCxp | "abiertas" | "vencida" | "por_vencer";
export const FILTROS_ESTADO_CXP = ["abiertas", "vencida", "por_vencer", ...ESTADOS_CXP] as const;

export type FiltroCxp = {
  texto?: string | null;
  proveedorId?: string | null;
  vencimiento?: VencimientoCxp | null;
};

const HOY_RD = `(now() AT TIME ZONE 'America/Santo_Domingo')::date`;
const ABIERTA = `x.estado NOT IN ('pagada', 'anulada')`;

/**
 * Búsqueda, proveedor y rango de vencimiento. Los conteos de los chips los comparten (sin
 * el chip de estado) para que cada número diga cuántas filas darían al pulsarlo.
 * Parámetros: $1 texto, $2 proveedor, $3 vencimiento.
 */
const FILTROS_COMUNES = `
  ($1::text IS NULL
     OR coalesce(p.nombre, x.beneficiario, '') ILIKE '%' || $1 || '%'
     OR x.concepto ILIKE '%' || $1 || '%'
     OR s.folio::text ILIKE '%' || $1 || '%')
  AND ($2::uuid IS NULL OR x.proveedor_id = $2::uuid)
  AND ($3::text IS NULL
     OR ($3 = 'semana' AND x.fecha_vencimiento BETWEEN ${HOY_RD} AND ${HOY_RD} + ${DIAS_POR_VENCER})
     OR ($3 = 'mes' AND date_trunc('month', x.fecha_vencimiento::timestamp) = date_trunc('month', ${HOY_RD}::timestamp))
     OR ($3 = 'mes_siguiente' AND date_trunc('month', x.fecha_vencimiento::timestamp)
                                = date_trunc('month', ${HOY_RD}::timestamp) + interval '1 month'))`;

const parametrosComunes = (f: FiltroCxp) => [f.texto || null, f.proveedorId || null, f.vencimiento ?? null];

/**
 * `abiertas` = todo lo que todavía se debe; `vencida` y `por_vencer` se calculan en la base
 * con la fecha de la Fundación. Sin estado, todo (lo abierto primero).
 */
export async function cuentasPorPagar(
  estado: FiltroEstadoCxp | null,
  filtro: FiltroCxp = {},
): Promise<FilaCxp[]> {
  return consultar<FilaCxp>(
    `${SELECT_CXP}
      WHERE ($4::text IS NULL
             OR ($4 = 'abiertas' AND ${ABIERTA})
             OR ($4 = 'vencida' AND ${ABIERTA} AND x.fecha_vencimiento < ${HOY_RD})
             OR ($4 = 'por_vencer' AND ${ABIERTA}
                 AND x.fecha_vencimiento BETWEEN ${HOY_RD} AND ${HOY_RD} + ${DIAS_POR_VENCER})
             OR x.estado = $4)
        AND ${FILTROS_COMUNES}
      ORDER BY (x.estado IN ('pagada', 'anulada')), x.fecha_vencimiento, x.creado_en
      LIMIT 300`,
    [...parametrosComunes(filtro), estado],
  );
}

export type ConteosCxp = Record<(typeof FILTROS_ESTADO_CXP)[number] | "total", number>;

/** Números de los chips: cada uno cuenta lo que daría al pulsarlo, con la búsqueda y los demás filtros puestos. */
export async function conteosCxp(filtro: FiltroCxp = {}): Promise<ConteosCxp> {
  const fila = await consultarUna<ConteosCxp>(
    `SELECT count(*)::int AS total,
            (count(*) FILTER (WHERE ${ABIERTA}))::int AS abiertas,
            (count(*) FILTER (WHERE ${ABIERTA} AND x.fecha_vencimiento < ${HOY_RD}))::int AS vencida,
            (count(*) FILTER (WHERE ${ABIERTA}
               AND x.fecha_vencimiento BETWEEN ${HOY_RD} AND ${HOY_RD} + ${DIAS_POR_VENCER}))::int AS por_vencer,
            (count(*) FILTER (WHERE x.estado = 'pendiente'))::int AS pendiente,
            (count(*) FILTER (WHERE x.estado = 'programada'))::int AS programada,
            (count(*) FILTER (WHERE x.estado = 'pagada_parcial'))::int AS pagada_parcial,
            (count(*) FILTER (WHERE x.estado = 'pagada'))::int AS pagada,
            (count(*) FILTER (WHERE x.estado = 'anulada'))::int AS anulada
       FROM contabilidad.cuenta_por_pagar x
       LEFT JOIN contabilidad.proveedor p ON p.id = x.proveedor_id
       LEFT JOIN solicitud s ON s.id = x.solicitud_id
      WHERE ${FILTROS_COMUNES}`,
    parametrosComunes(filtro),
  );

  return (
    fila ?? { total: 0, abiertas: 0, vencida: 0, por_vencer: 0, pendiente: 0, programada: 0, pagada_parcial: 0, pagada: 0, anulada: 0 }
  );
}

/** Proveedores que tienen alguna cuenta por pagar: las opciones del selector «Proveedor». */
export async function proveedoresConCxp(): Promise<{ id: string; nombre: string }[]> {
  return consultar<{ id: string; nombre: string }>(
    `SELECT DISTINCT p.id, p.nombre
       FROM contabilidad.cuenta_por_pagar x
       JOIN contabilidad.proveedor p ON p.id = x.proveedor_id
      ORDER BY p.nombre`,
  );
}

export async function cxpPorId(id: string): Promise<FilaCxp | null> {
  if (!esUuid(id)) return null;
  return consultarUna<FilaCxp>(`${SELECT_CXP} WHERE x.id = $1`, [id]);
}

export type PagoDeCxp = {
  id: string;
  numero: string;
  fecha: string;
  monto: string;
  cuenta: string;
  recibo_id: string;
  recibo_numero: string;
  creado_por: string;
};

export async function pagosDeCxp(id: string): Promise<PagoDeCxp[]> {
  return consultar<PagoDeCxp>(
    `SELECT p.id, p.numero::text AS numero, p.fecha::text AS fecha, p.monto::text AS monto,
            cb.nombre AS cuenta, p.recibo_id, r.numero::text AS recibo_numero, u.nombre AS creado_por
       FROM contabilidad.pago p
       JOIN contabilidad.cuenta_bancaria cb ON cb.id = p.cuenta_bancaria_id
       JOIN contabilidad.recibo r ON r.id = p.recibo_id
       JOIN usuario u ON u.id = p.creado_por
      WHERE p.cuenta_por_pagar_id = $1
      ORDER BY p.fecha, p.numero`,
    [id],
  );
}

export const TRAMOS_ANTIGUEDAD = ["por_vencer", "d0_30", "d31_60", "d61_90", "d90"] as const;
export type TramoAntiguedad = (typeof TRAMOS_ANTIGUEDAD)[number];

export type FilaAntiguedad = { moneda: Moneda } & Record<TramoAntiguedad | "total", string>;

/**
 * Antigüedad de saldos (§4.5) por moneda: lo que aún no vence y lo
 * vencido en tramos de 30 días contados desde el VENCIMIENTO, que es lo
 * que dice cuánto se lleva debiendo de más.
 */
export async function antiguedadDeSaldos(): Promise<FilaAntiguedad[]> {
  return consultar<FilaAntiguedad>(
    `SELECT moneda,
            coalesce(sum(saldo) FILTER (WHERE d <= 0), 0)::text AS por_vencer,
            coalesce(sum(saldo) FILTER (WHERE d BETWEEN 1 AND 30), 0)::text AS d0_30,
            coalesce(sum(saldo) FILTER (WHERE d BETWEEN 31 AND 60), 0)::text AS d31_60,
            coalesce(sum(saldo) FILTER (WHERE d BETWEEN 61 AND 90), 0)::text AS d61_90,
            coalesce(sum(saldo) FILTER (WHERE d > 90), 0)::text AS d90,
            sum(saldo)::text AS total
       FROM (SELECT moneda, saldo, (now() AT TIME ZONE 'America/Santo_Domingo')::date - fecha_vencimiento AS d
               FROM contabilidad.cuenta_por_pagar
              WHERE estado NOT IN ('pagada', 'anulada')) x
      GROUP BY moneda
      ORDER BY moneda`,
  );
}

/** Lo que vence en los próximos `dias` (para el inicio del portal). */
export async function vencenEn(dias: number): Promise<{ moneda: Moneda; total: string; cantidad: number }[]> {
  return consultar(
    `SELECT moneda, sum(saldo)::text AS total, count(*)::int AS cantidad
       FROM contabilidad.cuenta_por_pagar
      WHERE estado NOT IN ('pagada', 'anulada')
        AND fecha_vencimiento <= (now() AT TIME ZONE 'America/Santo_Domingo')::date + $1::int
      GROUP BY moneda ORDER BY moneda`,
    [dias],
  );
}

export async function hoyEnLaBase(): Promise<string> {
  const fila = await consultarUna<{ hoy: string }>(`SELECT (now() AT TIME ZONE 'America/Santo_Domingo')::date::text AS hoy`);
  return fila?.hoy ?? new Date().toISOString().slice(0, 10);
}
