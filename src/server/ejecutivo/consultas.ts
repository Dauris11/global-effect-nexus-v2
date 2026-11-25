import { consultar, consultarUna } from "@/lib/db";
import { estudiantesEnRiesgo } from "@/server/academico/riesgo";

/**
 * Tablero ejecutivo (Dirección / Junta). Todo se agrega en SQL: la pantalla
 * muestra totales y reparto, no filas sueltas de personas, salvo el conteo de
 * becados en riesgo que reutiliza la regla única de `estudiantesEnRiesgo`.
 *
 * PENDIENTE (fórmula del índice): el promedio institucional promedia
 * `indice_estudiante()`, que aplica las reglas de CADA universidad (escalas y
 * redondeos distintos), y el liceo aún no tiene su cálculo. Hasta que el
 * usuario defina cómo se calcula el índice en cada universidad y en el liceo,
 * esta cifra es orientativa y NO se debe comparar entre escalas. No se
 * inventa ni se cambia ninguna fórmula aquí; ver `docs/estado/pendientes.md`.
 */

export type MonedaTablero = "DOP" | "USD";

export type SaldoBancos = { moneda: MonedaTablero; saldo: number; cuentas: number };

export type ReparteBecados = { nombre: string; valor: number };

export type CuotasDonantes = {
  moneda: MonedaTablero;
  comprometido: number;
  cobrado: number;
  /** Cuotas pendientes que vencen en los próximos 30 días. */
  porVencer: number;
  montoPorVencer: number;
  /** Cuotas pendientes ya vencidas. */
  vencidas: number;
};

export type TableroEjecutivo = {
  becadosActivos: number;
  porUniversidad: ReparteBecados[];
  porCarrera: ReparteBecados[];
  indicePromedio: number | null;
  becadosConIndice: number;
  enRiesgo: number;
  sinPatrocinador: number;
  solicitudesDireccion: number;
  saldos: SaldoBancos[];
  patrocinadoresActivos: number;
  /** Aporte mensual comprometido por los patrocinadores activos, en USD. */
  aporteMensualUsd: number;
  cuotas: CuotasDonantes[];
  cumplimiento: {
    mes: string | null;
    total: number;
    servicio: number;
    reunion: number;
  };
};

/** `nombre` vacío = sin universidad o carrera registrada; la pantalla pone el texto traducido. */

/** Las carreras menos frecuentes se agrupan para que la gráfica se lea. */
const MAX_CARRERAS = 6;

export async function cargarTableroEjecutivo(otras: string): Promise<TableroEjecutivo> {
  const [
    activos,
    porUniversidad,
    porCarrera,
    indice,
    riesgo,
    sinPatrocinador,
    solicitudes,
    saldos,
    patrocinadores,
    cuotas,
    cumplimiento,
  ] = await Promise.all([
    consultarUna<{ n: number }>(
      `SELECT count(*)::int AS n FROM estudiante WHERE tipo = 'becado' AND estado = 'activo'`,
    ),
    consultar<ReparteBecados>(
      `SELECT coalesce(u.siglas, nullif(e.universidad, ''), '') AS nombre, count(*)::int AS valor
         FROM estudiante e LEFT JOIN universidad u ON u.id = e.universidad_id
        WHERE e.tipo = 'becado' AND e.estado = 'activo'
        GROUP BY 1 ORDER BY valor DESC, nombre`,
    ),
    consultar<ReparteBecados>(
      `SELECT coalesce(c.nombre, nullif(e.programa, ''), '') AS nombre, count(*)::int AS valor
         FROM estudiante e LEFT JOIN carrera c ON c.id = e.carrera_id
        WHERE e.tipo = 'becado' AND e.estado = 'activo'
        GROUP BY 1 ORDER BY valor DESC, nombre`,
    ),
    consultarUna<{ promedio: number | null; con_indice: number }>(
      `SELECT round(avg(i.indice)::numeric, 2)::float8 AS promedio, count(i.indice)::int AS con_indice
         FROM (SELECT indice_estudiante(e.id) AS indice
                 FROM estudiante e WHERE e.tipo = 'becado' AND e.estado = 'activo') i`,
    ),
    estudiantesEnRiesgo(),
    consultarUna<{ n: number }>(
      `SELECT count(*)::int AS n
         FROM estudiante e
        WHERE e.tipo = 'becado' AND e.estado = 'activo' AND e.patrocinador_id IS NULL
          AND NOT EXISTS (SELECT 1 FROM asignacion_beca a WHERE a.estudiante_id = e.id AND a.estado = 'activo')`,
    ),
    consultarUna<{ n: number }>(
      `SELECT count(*)::int AS n FROM solicitud WHERE estado = 'pendiente_direccion'`,
    ),
    // Saldo = saldo_inicial + movimientos vigentes, igual que en Bancos.
    consultar<SaldoBancos>(
      `SELECT cb.moneda AS moneda,
              coalesce(sum(cb.saldo_inicial + coalesce(s.suma, 0)), 0)::float8 AS saldo,
              count(*)::int AS cuentas
         FROM contabilidad.cuenta_bancaria cb
         LEFT JOIN LATERAL (
           SELECT sum(m.importe) AS suma FROM contabilidad.movimiento_bancario m
            WHERE m.cuenta_id = cb.id AND m.estado = 'vigente'
         ) s ON true
        WHERE cb.estado = 'activa'
        GROUP BY cb.moneda ORDER BY cb.moneda`,
    ),
    consultarUna<{ activos: number; aporte: number }>(
      `SELECT count(*)::int AS activos, coalesce(sum(monto_mensual), 0)::float8 AS aporte
         FROM patrocinador WHERE estado = 'activo'`,
    ),
    consultar<CuotasDonantes>(
      `SELECT p.moneda AS moneda,
              coalesce(sum(c.monto) FILTER (WHERE c.estado <> 'cancelada'), 0)::float8 AS comprometido,
              coalesce(sum(c.monto_cobrado) FILTER (WHERE c.estado <> 'cancelada'), 0)::float8 AS cobrado,
              count(*) FILTER (WHERE c.estado = 'pendiente'
                                 AND c.fecha_vencimiento BETWEEN current_date AND current_date + 30)::int AS "porVencer",
              coalesce(sum(c.monto - c.monto_cobrado) FILTER (WHERE c.estado = 'pendiente'
                                 AND c.fecha_vencimiento BETWEEN current_date AND current_date + 30), 0)::float8 AS "montoPorVencer",
              count(*) FILTER (WHERE c.estado = 'vencida'
                                 OR (c.estado = 'pendiente' AND c.fecha_vencimiento < current_date))::int AS vencidas
         FROM contabilidad.promesa_cuota c
         JOIN contabilidad.promesa_donacion p ON p.id = c.promesa_id AND p.estado = 'activa'
        GROUP BY p.moneda ORDER BY p.moneda`,
    ),
    // El último mes CERRADO con registros: el mes en curso siempre se ve a medias
    // (servicio en cero hasta que el equipo lo carga) y daría un cumplimiento falso.
    consultarUna<{ mes: string | null; total: number; servicio: number; reunion: number }>(
      `WITH m AS (SELECT max(mes) AS mes FROM registro_servicio WHERE mes < to_char(now() AT TIME ZONE 'America/Santo_Domingo', 'YYYY-MM'))
       SELECT m.mes,
              count(r.id)::int AS total,
              count(r.id) FILTER (WHERE r.hizo_servicio)::int AS servicio,
              count(r.id) FILTER (WHERE r.asistio_reunion)::int AS reunion
         FROM m
         LEFT JOIN registro_servicio r ON r.mes = m.mes
         LEFT JOIN estudiante e ON e.id = r.estudiante_id AND e.tipo = 'becado' AND e.estado = 'activo'
        WHERE r.id IS NULL OR e.id IS NOT NULL
        GROUP BY m.mes`,
    ),
  ]);

  const principales = porCarrera.slice(0, MAX_CARRERAS);
  const resto = porCarrera.slice(MAX_CARRERAS).reduce((suma, c) => suma + c.valor, 0);

  return {
    becadosActivos: activos?.n ?? 0,
    porUniversidad,
    porCarrera: resto > 0 ? [...principales, { nombre: otras, valor: resto }] : principales,
    indicePromedio: indice?.promedio ?? null,
    becadosConIndice: indice?.con_indice ?? 0,
    enRiesgo: riesgo.length,
    sinPatrocinador: sinPatrocinador?.n ?? 0,
    solicitudesDireccion: solicitudes?.n ?? 0,
    saldos,
    patrocinadoresActivos: patrocinadores?.activos ?? 0,
    aporteMensualUsd: patrocinadores?.aporte ?? 0,
    cuotas,
    cumplimiento: cumplimiento ?? { mes: null, total: 0, servicio: 0, reunion: 0 },
  };
}
