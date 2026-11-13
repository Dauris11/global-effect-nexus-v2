import { consultar, consultarUna } from "@/lib/db";
import {
  calcularSugerencia,
  problemasDe,
  type DecisionPrevia,
  type Problema,
  type Sugerencia,
} from "@/lib/contabilidad/comprobantes-auto";
import { limpiarIdentificacion } from "@/lib/contabilidad/identificacion";

/**
 * Lecturas de «Mi día» de Contabilidad: la cola priorizada de lo que hay que
 * decidir hoy, las anomalías y las métricas que dicen si el sistema ahorra
 * tiempo. Todo es de LECTURA: calcular una sugerencia no escribe nada; solo
 * cuando la contadora aprueba (`acciones.ts`) algo se guarda.
 */

export type ItemRevision = {
  id: string;
  folio: number;
  concepto: string;
  proveedor: string | null;
  rnc: string | null;
  ncf: string | null;
  monto: number;
  moneda: string;
  fecha: string | null;
  estado: string;
  problemas: Problema[];
  /** Mismo RNC + NCF + monto ya registrado (en comprobantes o en facturas). */
  duplicado: boolean;
  /** Mismo NCF con otro monto: más sospechoso aún que un duplicado limpio. */
  ncfRepetido: boolean;
  sugerencia: Sugerencia | null;
  /** Nombres de la sugerencia, ya resueltos para pintarlos. */
  sugerenciaTexto: { centro: string | null; fondo: string | null };
};

type FilaPendiente = {
  id: string;
  folio: string;
  concepto: string;
  proveedor_nombre: string | null;
  proveedor_rnc: string | null;
  ncf: string | null;
  monto: string;
  moneda: string;
  fecha_comprobante: string | null;
  estado: string;
  duplicado: boolean;
  ncf_repetido: boolean;
};

export async function comprobantesPorRevisar(limite = 50): Promise<ItemRevision[]> {
  const pendientes = await consultar<FilaPendiente>(
    `SELECT cr.id, cr.folio::text, cr.concepto, cr.proveedor_nombre, cr.proveedor_rnc, cr.ncf,
            cr.monto::text, cr.moneda, cr.fecha_comprobante::text, cr.estado,
            (EXISTS (SELECT 1 FROM contabilidad.comprobante_recibido o
                      WHERE o.id <> cr.id AND o.estado <> 'rechazado'
                        AND o.proveedor_rnc = cr.proveedor_rnc AND o.ncf = cr.ncf
                        AND o.monto = cr.monto)
             OR EXISTS (SELECT 1 FROM contabilidad.factura_proveedor f
                          JOIN contabilidad.proveedor p ON p.id = f.proveedor_id
                         WHERE f.anulado_en IS NULL AND f.ncf = cr.ncf
                           AND regexp_replace(p.identificacion, '[\\s-]', '', 'g')
                             = regexp_replace(coalesce(cr.proveedor_rnc, ''), '[\\s-]', '', 'g')
                           AND f.total = cr.monto)) AS duplicado,
            EXISTS (SELECT 1 FROM contabilidad.comprobante_recibido o
                     WHERE o.id <> cr.id AND o.estado <> 'rechazado'
                       AND o.ncf = cr.ncf AND o.monto <> cr.monto
                       AND o.proveedor_rnc = cr.proveedor_rnc) AS ncf_repetido
       FROM contabilidad.comprobante_recibido cr
      WHERE cr.estado IN ('recibido', 'observado')
      ORDER BY cr.created_at
      LIMIT $1`,
    [limite],
  );

  if (pendientes.length === 0) return [];

  // Una sola consulta para el historial de todos los proveedores de la cola.
  const rncs = [...new Set(pendientes.map((p) => p.proveedor_rnc).filter((r): r is string => Boolean(r)))];

  const decisiones = rncs.length
    ? await consultar<{
        proveedor_rnc: string;
        categoria: string | null;
        centro_costo_id: string | null;
        fondo_id: string | null;
        veces: string;
      }>(
        `SELECT proveedor_rnc, categoria, centro_costo_id, fondo_id, count(*) AS veces
           FROM contabilidad.comprobante_recibido
          WHERE proveedor_rnc = ANY($1::text[]) AND estado IN ('validado', 'contabilizado')
          GROUP BY 1, 2, 3, 4`,
        [rncs],
      )
    : [];

  const historial = new Map<string, DecisionPrevia[]>();

  for (const d of decisiones) {
    const lista = historial.get(d.proveedor_rnc) ?? [];

    lista.push({
      categoria: d.categoria,
      centroCostoId: d.centro_costo_id,
      fondoId: d.fondo_id,
      veces: Number(d.veces),
    });
    historial.set(d.proveedor_rnc, lista);
  }

  const sugerencias = pendientes.map((p) =>
    p.proveedor_rnc ? calcularSugerencia(historial.get(p.proveedor_rnc) ?? []) : null,
  );

  const centros = new Set(sugerencias.map((s) => s?.centroCostoId).filter((v): v is string => Boolean(v)));
  const fondos = new Set(sugerencias.map((s) => s?.fondoId).filter((v): v is string => Boolean(v)));

  const [nombresCentro, nombresFondo] = await Promise.all([
    centros.size
      ? consultar<{ id: string; nombre: string }>(
          "SELECT id, codigo || ' · ' || nombre AS nombre FROM contabilidad.centro_costo WHERE id = ANY($1::uuid[])",
          [[...centros]],
        )
      : [],
    fondos.size
      ? consultar<{ id: string; nombre: string }>(
          "SELECT id, nombre FROM contabilidad.fondo WHERE id = ANY($1::uuid[])",
          [[...fondos]],
        )
      : [],
  ]);

  const nombreCentro = new Map(nombresCentro.map((c) => [c.id, c.nombre]));
  const nombreFondo = new Map(nombresFondo.map((f) => [f.id, f.nombre]));

  return pendientes.map((p, i) => {
    const sugerencia = sugerencias[i] ?? null;

    return {
      id: p.id,
      folio: Number(p.folio),
      concepto: p.concepto,
      proveedor: p.proveedor_nombre,
      rnc: p.proveedor_rnc ? limpiarIdentificacion(p.proveedor_rnc) : null,
      ncf: p.ncf,
      monto: Number(p.monto),
      moneda: p.moneda,
      fecha: p.fecha_comprobante,
      estado: p.estado,
      problemas: problemasDe({ rnc: p.proveedor_rnc, ncf: p.ncf }),
      duplicado: p.duplicado,
      ncfRepetido: p.ncf_repetido,
      sugerencia,
      sugerenciaTexto: {
        centro: sugerencia?.centroCostoId ? (nombreCentro.get(sugerencia.centroCostoId) ?? null) : null,
        fondo: sugerencia?.fondoId ? (nombreFondo.get(sugerencia.fondoId) ?? null) : null,
      },
    };
  });
}

/** ¿Se puede aprobar sin mirarlo dos veces? Sin problemas, sin duplicado y con sugerencia. */
export function esAprobable(item: ItemRevision): boolean {
  return (
    item.estado === "recibido" &&
    item.sugerencia !== null &&
    item.problemas.length === 0 &&
    !item.duplicado &&
    !item.ncfRepetido
  );
}

export type ReglaAutomatica = {
  nivel: 0 | 1 | 2;
  umbralConfianza: number;
  umbralMonto: number;
};

export async function reglaClasificacion(): Promise<ReglaAutomatica> {
  const fila = await consultarUna<{ nivel: number; umbral_confianza: number; umbral_monto: string }>(
    `SELECT nivel, umbral_confianza, umbral_monto::text
       FROM contabilidad.regla_automatica WHERE clave = 'clasificar_comprobante'`,
  );

  return {
    nivel: (fila?.nivel ?? 1) as 0 | 1 | 2,
    umbralConfianza: fila?.umbral_confianza ?? 90,
    umbralMonto: Number(fila?.umbral_monto ?? 5000),
  };
}

export type MetricasMiDia = {
  revisados: number;
  /** Segundos promedio entre que llega el comprobante y que se revisa. */
  segundosPorComprobante: number | null;
  conSugerencia: number;
  aceptadasSinCorregir: number;
};

/** Últimos 30 días. Los «clics por tarea» no se miden en el servidor. */
export async function metricasMiDia(): Promise<MetricasMiDia> {
  const fila = await consultarUna<{
    revisados: string;
    segundos: string | null;
    con_sugerencia: string;
    aceptadas: string;
  }>(
    `SELECT count(*) FILTER (WHERE revisado_en IS NOT NULL) AS revisados,
            avg(extract(epoch FROM revisado_en - created_at)) FILTER (WHERE revisado_en IS NOT NULL) AS segundos,
            count(*) FILTER (WHERE clasificacion_sugerida IS NOT NULL
                               AND estado IN ('validado', 'contabilizado')) AS con_sugerencia,
            -- Aceptada = lo que quedó es lo que se sugirió, se haya revisado por
            -- «Mi día» o por la pantalla de cada comprobante.
            count(*) FILTER (WHERE clasificacion_sugerida IS NOT NULL
                               AND estado IN ('validado', 'contabilizado')
                               AND (clasificacion_sugerida->>'categoria') IS NOT DISTINCT FROM categoria
                               AND (clasificacion_sugerida->>'centroCostoId') IS NOT DISTINCT FROM centro_costo_id::text
                               AND (clasificacion_sugerida->>'fondoId') IS NOT DISTINCT FROM fondo_id::text) AS aceptadas
       FROM contabilidad.comprobante_recibido
      WHERE created_at >= now() - interval '30 days'`,
  );

  return {
    revisados: Number(fila?.revisados ?? 0),
    segundosPorComprobante: fila?.segundos ? Number(fila.segundos) : null,
    conSugerencia: Number(fila?.con_sugerencia ?? 0),
    aceptadasSinCorregir: Number(fila?.aceptadas ?? 0),
  };
}

export type ColaMiDia = {
  cxpVencidas: { cantidad: number; saldo: number };
  cxpPorVencer: { cantidad: number; saldo: number };
  ordenesPendientes: number;
  conciliacionesAbiertas: number;
  recurrentes: { id: string; nombre: string; dia: number }[];
  obligaciones: { codigo: string; nombre: string; fecha: string; dias: number }[];
};

export async function colaMiDia(): Promise<ColaMiDia> {
  const [cxp, ordenes, conciliaciones, recurrentes, obligaciones] = await Promise.all([
    consultarUna<{ vencidas: string; saldo_vencidas: string | null; por_vencer: string; saldo_por_vencer: string | null }>(
      `SELECT count(*) FILTER (WHERE fecha_vencimiento < current_date) AS vencidas,
              sum(saldo) FILTER (WHERE fecha_vencimiento < current_date) AS saldo_vencidas,
              count(*) FILTER (WHERE fecha_vencimiento BETWEEN current_date AND current_date + 7) AS por_vencer,
              sum(saldo) FILTER (WHERE fecha_vencimiento BETWEEN current_date AND current_date + 7) AS saldo_por_vencer
         FROM contabilidad.cuenta_por_pagar
        WHERE estado IN ('pendiente', 'programada', 'pagada_parcial')`,
    ),
    consultarUna<{ n: string }>(
      "SELECT count(*) AS n FROM contabilidad.orden_compra WHERE estado = 'pendiente_aprobacion'",
    ),
    consultarUna<{ n: string }>(
      // Desde la 0081 se concilia partida por partida: lo pendiente son las
      // transacciones del banco sin pareja viva.
      `SELECT count(*) AS n FROM contabilidad.extracto_linea e
        WHERE NOT EXISTS (SELECT 1 FROM contabilidad.conciliacion_partida p
                           WHERE p.extracto_linea_id = e.id AND p.anulado_en IS NULL)`,
    ),
    consultar<{ id: string; nombre: string; dia_del_mes: number }>(
      `SELECT id, nombre, dia_del_mes FROM contabilidad.asiento_recurrente
        WHERE activo AND dia_del_mes <= extract(day FROM current_date)
          AND (ultimo_generado IS NULL OR ultimo_generado < date_trunc('month', current_date))
        ORDER BY dia_del_mes`,
    ),
    // Las mensuales: el día límite de este mes, o del siguiente si ya pasó.
    consultar<{ codigo: string; nombre: string; fecha: string; dias: number }>(
      `SELECT codigo, nombre, fecha::text, (fecha - current_date)::int AS dias
         FROM (SELECT codigo, nombre,
                      CASE WHEN make_date(extract(year FROM current_date)::int,
                                          extract(month FROM current_date)::int,
                                          least(dia_limite, 28)) >= current_date
                           THEN make_date(extract(year FROM current_date)::int,
                                          extract(month FROM current_date)::int,
                                          least(dia_limite, 28))
                           ELSE (make_date(extract(year FROM current_date)::int,
                                           extract(month FROM current_date)::int, 1)
                                 + interval '1 month')::date + (least(dia_limite, 28) - 1)
                      END AS fecha
                 FROM contabilidad.obligacion_fiscal
                WHERE activo AND frecuencia = 'mensual') o
        WHERE fecha - current_date <= 10
        ORDER BY fecha, codigo`,
    ),
  ]);

  return {
    cxpVencidas: { cantidad: Number(cxp?.vencidas ?? 0), saldo: Number(cxp?.saldo_vencidas ?? 0) },
    cxpPorVencer: { cantidad: Number(cxp?.por_vencer ?? 0), saldo: Number(cxp?.saldo_por_vencer ?? 0) },
    ordenesPendientes: Number(ordenes?.n ?? 0),
    conciliacionesAbiertas: Number(conciliaciones?.n ?? 0),
    recurrentes: recurrentes.map((r) => ({ id: r.id, nombre: r.nombre, dia: r.dia_del_mes })),
    obligaciones,
  };
}

export type Anomalia = {
  tipo: "compra_fraccionada" | "monto_atipico" | "fin_de_semana" | "proveedor_nuevo_monto_alto";
  id: string | null;
  proveedor: string | null;
  monto: number;
  fecha: string;
  detalle: string;
};

/** El umbral de aprobación de compras vive en `parametro`: no se duplica aquí. */
async function umbralCompras(): Promise<number> {
  const fila = await consultarUna<{ valor: unknown }>(
    `SELECT valor FROM contabilidad.parametro
      WHERE clave = 'monto_aprobacion_oc_director'
        AND vigente_desde <= current_date
        AND (vigente_hasta IS NULL OR vigente_hasta > current_date)
      ORDER BY vigente_desde DESC LIMIT 1`,
  );
  const n = Number(fila?.valor);

  return Number.isFinite(n) && n > 0 ? n : 50000;
}

/**
 * Señales para mirar dos veces, en vivo (no se guardan). No acusan a nadie: un
 * gasto en sábado o un proveedor nuevo con un monto alto son motivos para
 * preguntar, no para concluir. Cuatro reglas, las del prompt de IA §5.8.
 */
export async function anomalias(dias = 30): Promise<Anomalia[]> {
  const umbral = await umbralCompras();

  // Gastos de las dos fuentes con la misma forma.
  const gastos = `
    WITH gastos AS (
      SELECT 'comprobante'::text AS origen, cr.id, cr.fecha_comprobante AS fecha,
             regexp_replace(coalesce(cr.proveedor_rnc, ''), '[\\s-]', '', 'g') AS rnc,
             coalesce(cr.proveedor_nombre, '') AS nombre, cr.monto
        FROM contabilidad.comprobante_recibido cr
       WHERE cr.estado <> 'rechazado' AND cr.fecha_comprobante IS NOT NULL AND cr.moneda = 'DOP'
      UNION ALL
      SELECT 'factura', f.id, f.fecha_emision,
             regexp_replace(p.identificacion, '[\\s-]', '', 'g'), p.nombre, f.total
        FROM contabilidad.factura_proveedor f
        JOIN contabilidad.proveedor p ON p.id = f.proveedor_id
       WHERE f.anulado_en IS NULL AND f.moneda = 'DOP')`;

  const [fraccionadas, atipicos, finDeSemana, nuevos] = await Promise.all([
    consultar<{ id: string; nombre: string; monto: string; fecha: string; suma: string; n: string }>(
      `${gastos}
       SELECT DISTINCT ON (g.rnc, g.id) g.id, g.nombre, g.monto::text, g.fecha::text,
              s.suma::text, s.n::text
         FROM gastos g
         JOIN LATERAL (SELECT sum(o.monto) AS suma, count(*) AS n, max(o.monto) AS tope
                         FROM gastos o
                        WHERE o.rnc = g.rnc AND o.rnc <> ''
                          AND o.fecha BETWEEN g.fecha - 6 AND g.fecha) s ON true
        WHERE g.rnc <> '' AND g.monto < $1 AND s.n >= 2 AND s.tope < $1 AND s.suma >= $1
          AND g.fecha >= current_date - $2::int
        ORDER BY g.rnc, g.id`,
      [umbral, dias],
    ),
    consultar<{ id: string; nombre: string; monto: string; fecha: string; media: string }>(
      `${gastos}
       SELECT g.id, g.nombre, g.monto::text, g.fecha::text, h.media::text
         FROM gastos g
         JOIN LATERAL (SELECT avg(o.monto) AS media, stddev_samp(o.monto) AS desv, count(*) AS n
                         FROM gastos o
                        WHERE o.rnc = g.rnc AND o.fecha < g.fecha) h ON true
        WHERE g.rnc <> '' AND h.n >= 4 AND h.desv > 0 AND g.monto > h.media + 3 * h.desv
          AND g.fecha >= current_date - $1::int`,
      [dias],
    ),
    consultar<{ id: string; nombre: string; monto: string; fecha: string }>(
      `SELECT id, coalesce(proveedor_nombre, '') AS nombre, monto::text, fecha_comprobante::text AS fecha
         FROM contabilidad.comprobante_recibido
        WHERE estado <> 'rechazado' AND extract(isodow FROM fecha_comprobante) IN (6, 7)
          AND fecha_comprobante >= current_date - $1::int`,
      [dias],
    ),
    consultar<{ id: string; nombre: string; monto: string; fecha: string }>(
      `${gastos}
       SELECT g.id, g.nombre, g.monto::text, g.fecha::text
         FROM gastos g
        WHERE g.rnc <> '' AND g.monto >= $1 AND g.fecha >= current_date - $2::int
          AND NOT EXISTS (SELECT 1 FROM gastos o WHERE o.rnc = g.rnc AND o.fecha < g.fecha)`,
      [umbral, dias],
    ),
  ]);

  const f = (valor: string) => Number(valor);

  return [
    ...fraccionadas.map((r) => ({
      tipo: "compra_fraccionada" as const,
      id: r.id,
      proveedor: r.nombre || null,
      monto: f(r.suma),
      fecha: r.fecha,
      detalle: `${r.n}|${umbral}`,
    })),
    ...atipicos.map((r) => ({
      tipo: "monto_atipico" as const,
      id: r.id,
      proveedor: r.nombre || null,
      monto: f(r.monto),
      fecha: r.fecha,
      detalle: String(Math.round(f(r.media))),
    })),
    ...finDeSemana.map((r) => ({
      tipo: "fin_de_semana" as const,
      id: r.id,
      proveedor: r.nombre || null,
      monto: f(r.monto),
      fecha: r.fecha,
      detalle: "",
    })),
    ...nuevos.map((r) => ({
      tipo: "proveedor_nuevo_monto_alto" as const,
      id: r.id,
      proveedor: r.nombre || null,
      monto: f(r.monto),
      fecha: r.fecha,
      detalle: String(umbral),
    })),
  ];
}

export type AprobadoReciente = {
  id: string;
  folio: number;
  proveedor: string | null;
  monto: number;
  moneda: string;
  automatico: boolean;
};

/** Lo validado esta semana y todavía sin asiento: lo único que se puede devolver a la cola. */
export async function aprobadosRecientes(limite = 10): Promise<AprobadoReciente[]> {
  const filas = await consultar<{
    id: string;
    folio: string;
    proveedor_nombre: string | null;
    monto: string;
    moneda: string;
    validacion_automatica: boolean;
  }>(
    `SELECT id, folio::text, proveedor_nombre, monto::text, moneda, validacion_automatica
       FROM contabilidad.comprobante_recibido
      WHERE estado = 'validado' AND asiento_id IS NULL
        AND revisado_en > now() - interval '7 days'
      ORDER BY revisado_en DESC LIMIT $1`,
    [limite],
  );

  return filas.map((f) => ({
    id: f.id,
    folio: Number(f.folio),
    proveedor: f.proveedor_nombre,
    monto: Number(f.monto),
    moneda: f.moneda,
    automatico: f.validacion_automatica,
  }));
}
