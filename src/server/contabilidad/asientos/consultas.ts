import { consultar, consultarUna } from "@/lib/db";
import {
  esPeriodo,
  esTipoAsiento,
  type EstadoAsiento,
  type TipoAsiento,
} from "@/lib/contabilidad/asientos";
import { esUuid } from "@/lib/contabilidad/formato";

/**
 * Libro diario: todos los asientos, los que escriben los documentos y los
 * que escribe una persona.
 *
 * El ESTADO no es una columna. Se deriva de los enlaces entre asientos:
 *   · `reverso`: el asiento que revierte a otro. Uno manual lo apunta con
 *     origen_tabla = 'contabilidad.asiento'; uno de un documento lleva el
 *     mismo origen que el automático que revierte (así lo hace
 *     `revertir_asiento`) y número posterior.
 *   · `anulado`: el que tiene reverso, o la marca `anulado`. La marca sola
 *     no basta: un asiento de un período CERRADO no se puede marcar (ver
 *     `revertirAsiento`) y solo queda el enlace desde su reverso.
 *
 * Las consultas se escriben enteras y sin interpolar, aunque repitan los
 * LATERAL: así el validador de SQL del repo las prepara contra la base.
 * Los montos salen como texto, como en todo el módulo.
 */

const TOPE = 200;
export const TOPE_ASIENTOS = TOPE;

export const FILTRO_ANULADOS = ["ocultar", "solo"] as const;
export type FiltroAnulados = (typeof FILTRO_ANULADOS)[number];

/** Estado de proceso (Observaciones #1): sin procesar no entra a los libros. */
export const FILTRO_PROCESO = ["pendiente", "procesado"] as const;
export type FiltroProceso = (typeof FILTRO_PROCESO)[number];

export type FiltroAsientos = {
  periodo: string | null;
  tipo: TipoAsiento | null;
  texto: string | null;
  anulados: FiltroAnulados | null;
  proceso: FiltroProceso | null;
};

type Crudo = Record<string, string | string[] | undefined>;

function uno(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor ?? "").trim();
}

/** De `searchParams` a un filtro limpio: lo que no se reconoce se descarta. */
export function leerFiltroAsientos(crudo: Crudo): FiltroAsientos {
  const periodo = uno(crudo.periodo);
  const tipo = uno(crudo.tipo);
  const anulados = uno(crudo.anulados);
  const proceso = uno(crudo.proceso);
  return {
    periodo: esPeriodo(periodo) ? periodo : null,
    tipo: esTipoAsiento(tipo) ? tipo : null,
    texto: uno(crudo.q).slice(0, 80) || null,
    anulados: (FILTRO_ANULADOS as readonly string[]).includes(anulados)
      ? (anulados as FiltroAnulados)
      : null,
    proceso: (FILTRO_PROCESO as readonly string[]).includes(proceso) ? (proceso as FiltroProceso) : null,
  };
}

export function hayFiltroAsientos(filtro: FiltroAsientos): boolean {
  return Object.values(filtro).some((v) => v !== null);
}

export type FilaAsiento = {
  id: string;
  numero: string;
  fecha: string;
  concepto: string;
  tipo: TipoAsiento;
  origen_tabla: string | null;
  origen_id: string | null;
  total_debe: string;
  estado: EstadoAsiento;
  procesado: boolean;
};

/** Hasta 200 asientos del filtro, los más recientes; trae uno de más para saber si hay más. */
export async function asientos(filtro: FiltroAsientos): Promise<FilaAsiento[]> {
  return consultar<FilaAsiento>(
    `SELECT s.* FROM (
       SELECT a.id, a.numero::text AS numero, a.fecha::text AS fecha, a.concepto, a.tipo,
              a.origen_tabla, a.origen_id::text AS origen_id, t.total::text AS total_debe,
              a.procesado_en IS NOT NULL AS procesado,
              CASE WHEN o.id IS NOT NULL THEN 'reverso'
                   WHEN a.anulado OR r.id IS NOT NULL THEN 'anulado'
                   ELSE 'vigente' END AS estado
         FROM contabilidad.asiento a
         CROSS JOIN LATERAL (
           SELECT coalesce(sum(l.debe), 0) AS total
             FROM contabilidad.asiento_linea l WHERE l.asiento_id = a.id
         ) t
         LEFT JOIN LATERAL (
           SELECT x.id FROM contabilidad.asiento x
            WHERE x.id <> a.id AND x.tipo = 'ajuste'
              AND ((x.origen_tabla = 'contabilidad.asiento' AND x.origen_id = a.id)
                OR (a.tipo = 'automatico' AND x.origen_tabla = a.origen_tabla
                    AND x.origen_id = a.origen_id AND x.numero > a.numero))
            ORDER BY x.numero LIMIT 1
         ) r ON true
         LEFT JOIN LATERAL (
           SELECT x.id FROM contabilidad.asiento x
            WHERE a.tipo = 'ajuste' AND x.id <> a.id
              AND ((a.origen_tabla = 'contabilidad.asiento' AND x.id = a.origen_id)
                OR (x.tipo = 'automatico' AND x.origen_tabla = a.origen_tabla
                    AND x.origen_id = a.origen_id AND x.numero < a.numero))
            ORDER BY x.numero DESC LIMIT 1
         ) o ON true
        WHERE ($1::text IS NULL OR to_char(a.fecha, 'YYYY-MM') = $1)
          AND ($2::text IS NULL OR a.tipo = $2)
          AND ($3::text IS NULL OR a.concepto ILIKE '%' || $3 || '%' OR a.numero::text = $3)
          AND ($6::text IS NULL OR ($6 = 'procesado') = (a.procesado_en IS NOT NULL))
     ) s
     WHERE ($4::text IS NULL
            OR ($4 = 'ocultar' AND s.estado = 'vigente')
            OR ($4 = 'solo' AND s.estado <> 'vigente'))
     ORDER BY s.fecha DESC, s.numero::bigint DESC
     LIMIT $5`,
    [filtro.periodo, filtro.tipo, filtro.texto, filtro.anulados, TOPE + 1, filtro.proceso],
  );
}

export type DetalleAsiento = FilaAsiento & {
  total_haber: string;
  periodo_cerrado: boolean;
  creado_por: string;
  creado_en: string;
  anulado: boolean;
  anulado_por: string | null;
  anulado_en: string | null;
  motivo_anulacion: string | null;
  procesado_por: string | null;
  procesado_en: string | null;
  reverso_id: string | null;
  reverso_numero: string | null;
  original_id: string | null;
  original_numero: string | null;
};

export async function asientoPorId(id: string): Promise<DetalleAsiento | null> {
  if (!esUuid(id)) return null;
  return consultarUna<DetalleAsiento>(
    `SELECT a.id, a.numero::text AS numero, a.fecha::text AS fecha, a.concepto, a.tipo,
            a.origen_tabla, a.origen_id::text AS origen_id,
            t.debe::text AS total_debe, t.haber::text AS total_haber,
            CASE WHEN o.id IS NOT NULL THEN 'reverso'
                 WHEN a.anulado OR r.id IS NOT NULL THEN 'anulado'
                 ELSE 'vigente' END AS estado,
            p.estado = 'cerrado' AS periodo_cerrado,
            uc.nombre AS creado_por,
            to_char(a.creado_en AT TIME ZONE 'America/Santo_Domingo', 'YYYY-MM-DD HH24:MI') AS creado_en,
            a.anulado, un.nombre AS anulado_por,
            to_char(a.anulado_en AT TIME ZONE 'America/Santo_Domingo', 'YYYY-MM-DD HH24:MI') AS anulado_en,
            a.motivo_anulacion,
            a.procesado_en IS NOT NULL AS procesado, up.nombre AS procesado_por,
            to_char(a.procesado_en AT TIME ZONE 'America/Santo_Domingo', 'YYYY-MM-DD HH24:MI') AS procesado_en,
            r.id AS reverso_id, r.numero::text AS reverso_numero,
            o.id AS original_id, o.numero::text AS original_numero
       FROM contabilidad.asiento a
       JOIN contabilidad.periodo_contable p ON p.id = a.periodo_id
       JOIN usuario uc ON uc.id = a.creado_por
       LEFT JOIN usuario un ON un.id = a.anulado_por
       LEFT JOIN usuario up ON up.id = a.procesado_por
       CROSS JOIN LATERAL (
         SELECT coalesce(sum(l.debe), 0) AS debe, coalesce(sum(l.haber), 0) AS haber
           FROM contabilidad.asiento_linea l WHERE l.asiento_id = a.id
       ) t
       LEFT JOIN LATERAL (
         SELECT x.id, x.numero FROM contabilidad.asiento x
          WHERE x.id <> a.id AND x.tipo = 'ajuste'
            AND ((x.origen_tabla = 'contabilidad.asiento' AND x.origen_id = a.id)
              OR (a.tipo = 'automatico' AND x.origen_tabla = a.origen_tabla
                  AND x.origen_id = a.origen_id AND x.numero > a.numero))
          ORDER BY x.numero LIMIT 1
       ) r ON true
       LEFT JOIN LATERAL (
         SELECT x.id, x.numero FROM contabilidad.asiento x
          WHERE a.tipo = 'ajuste' AND x.id <> a.id
            AND ((a.origen_tabla = 'contabilidad.asiento' AND x.id = a.origen_id)
              OR (x.tipo = 'automatico' AND x.origen_tabla = a.origen_tabla
                  AND x.origen_id = a.origen_id AND x.numero < a.numero))
          ORDER BY x.numero DESC LIMIT 1
       ) o ON true
      WHERE a.id = $1`,
    [id],
  );
}

export type LineaAsiento = {
  id: string;
  codigo: string;
  cuenta: string;
  descripcion: string | null;
  debe: string;
  haber: string;
};

/**
 * Las líneas no guardan su orden de captura (no hay columna para eso), así
 * que salen como en un diario impreso: primero los débitos y después los
 * créditos, cada grupo por código de cuenta.
 */
export async function lineasDeAsiento(id: string): Promise<LineaAsiento[]> {
  if (!esUuid(id)) return [];
  return consultar<LineaAsiento>(
    `SELECT l.id, c.codigo, c.nombre AS cuenta, l.descripcion,
            l.debe::text AS debe, l.haber::text AS haber
       FROM contabilidad.asiento_linea l
       JOIN contabilidad.cuenta_contable c ON c.id = l.cuenta_id
      WHERE l.asiento_id = $1
      ORDER BY (l.debe > 0) DESC, c.codigo`,
    [id],
  );
}

export type PeriodoContable = { clave: string; cerrado: boolean };

export async function periodos(): Promise<PeriodoContable[]> {
  return consultar<PeriodoContable>(
    `SELECT to_char(make_date(anio, mes, 1), 'YYYY-MM') AS clave, estado = 'cerrado' AS cerrado
       FROM contabilidad.periodo_contable
      ORDER BY anio DESC, mes DESC`,
  );
}

export type CuentaMovimiento = { id: string; codigo: string; nombre: string; tipo: string };

/** Solo las hojas activas: una cuenta de grupo no recibe movimientos. */
export async function cuentasDeMovimiento(): Promise<CuentaMovimiento[]> {
  return consultar<CuentaMovimiento>(
    `SELECT id, codigo, nombre, tipo FROM contabilidad.cuenta_contable
      WHERE admite_movimiento AND activa
      ORDER BY codigo`,
  );
}

export type PlantillaRecurrente = {
  id: string;
  nombre: string;
  concepto: string;
  dia_del_mes: number;
  activo: boolean;
  ultimo_generado: string | null;
  generado_este_mes: boolean;
  lineas: number;
  total: string;
  creado_por: string;
  ultimo_asiento_id: string | null;
  ultimo_asiento_numero: string | null;
};

/**
 * "Este mes" lo decide la base con CURRENT_DATE, igual que
 * `generar_recurrente`: si lo calculara la app con su reloj, cerca de la
 * medianoche la lista y la función podrían discrepar.
 */
export async function plantillasRecurrentes(): Promise<PlantillaRecurrente[]> {
  return consultar<PlantillaRecurrente>(
    `SELECT p.id, p.nombre, p.concepto, p.dia_del_mes, p.activo,
            p.ultimo_generado::text AS ultimo_generado,
            coalesce(p.ultimo_generado >= date_trunc('month', CURRENT_DATE)::date, false) AS generado_este_mes,
            jsonb_array_length(p.lineas) AS lineas,
            (SELECT coalesce(sum(coalesce((l ->> 'debe')::numeric, 0)), 0)
               FROM jsonb_array_elements(p.lineas) l)::text AS total,
            u.nombre AS creado_por,
            g.id AS ultimo_asiento_id, g.numero::text AS ultimo_asiento_numero
       FROM contabilidad.asiento_recurrente p
       JOIN usuario u ON u.id = p.creado_por
       LEFT JOIN LATERAL (
         SELECT x.id, x.numero FROM contabilidad.asiento x
          WHERE x.origen_tabla = 'contabilidad.asiento_recurrente' AND x.origen_id = p.id
          ORDER BY x.numero DESC LIMIT 1
       ) g ON true
      ORDER BY p.activo DESC, p.nombre`,
  );
}
