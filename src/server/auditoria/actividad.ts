import { consultar, consultarUna } from "@/lib/db";

/**
 * Actividad del equipo: quién hizo qué y a qué hora, juntando TODAS las fuentes
 * de rastro del sistema en una sola línea de tiempo.
 *
 * Cada módulo escribía en su sitio —`audit_log`, la bitácora contable con su
 * cadena de hash, las acciones del asistente, el historial de inventario— y
 * para saber qué hizo una persona había que mirar cuatro. Aquí se unen en el
 * SELECT, sin copiar nada: la fuente sigue siendo la de cada módulo.
 *
 * Esta lectura NO devuelve el detalle de cada evento (`datos`, antes/después):
 * solo quién, qué, sobre qué y cuándo. El detalle vive en
 * `/configuracion/auditoria`, que además tapa lo clínico en el propio SELECT.
 * Un tablero de actividad no puede ser la puerta trasera de lo que aquel visor
 * protege.
 *
 * Las horas se agrupan en la zona de la Fundación (`America/Santo_Domingo`):
 * «a las 14:00» tiene que ser las 14:00 de La Vega, no las de UTC.
 */

const ZONA = "America/Santo_Domingo";

/** Rangos que admite el selector. Cualquier otro valor cae en el primero. */
export const RANGOS = [7, 1, 30, 90] as const;

export type Rango = (typeof RANGOS)[number];

export function rangoValido(valor: unknown): Rango {
  const n = Number(valor);

  return (RANGOS as readonly number[]).includes(n) ? (n as Rango) : 7;
}

/** Las cuatro fuentes con la misma forma. `$1` es el inicio del rango. */
const EVENTOS = `
  SELECT a.id::text AS id, a.created_at AS cuando, a.usuario_id, a.accion,
         a.entidad AS objeto, 'sistema'::text AS origen
    FROM audit_log a WHERE a.created_at >= $1::timestamptz
  UNION ALL
  SELECT b.id::text, b.ocurrido_en, b.usuario_id, 'contabilidad.' || b.accion,
         b.tabla, 'contabilidad'
    FROM contabilidad.bitacora b WHERE b.ocurrido_en >= $1::timestamptz
  UNION ALL
  SELECT x.id::text, x.created_at, x.usuario_id, 'asistente.' || x.herramienta || '.' || x.estado,
         'asistente_ia', 'asistente'
    FROM ai_accion x
   WHERE x.created_at >= $1::timestamptz AND x.estado IN ('ejecutada', 'rechazada', 'fallida')
  UNION ALL
  SELECT h.id::text, h.created_at, h.usuario_id, 'inventario.' || h.accion,
         'inventario_activo', 'inventario'
    FROM inventario_historial h WHERE h.created_at >= $1::timestamptz`;

/** Inicio del rango como instante: «hoy» empieza a medianoche de La Vega. */
function desde(dias: Rango): string {
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: ZONA });
  const inicio = new Date(`${hoy}T00:00:00-04:00`);

  inicio.setDate(inicio.getDate() - (dias - 1));

  return inicio.toISOString();
}

export type ResumenActividad = {
  eventos: number;
  personas: number;
  sesiones: number;
  fallidas: number;
  activasAhora: number;
};

export async function resumenDeActividad(dias: Rango): Promise<ResumenActividad> {
  const fila = await consultarUna<{
    eventos: number;
    personas: number;
    sesiones: number;
    fallidas: number;
    activas: number;
  }>(
    `WITH e AS (${EVENTOS})
     SELECT count(*)::int AS eventos,
            count(DISTINCT usuario_id)::int AS personas,
            count(*) FILTER (WHERE accion = 'sesion.iniciada')::int AS sesiones,
            count(*) FILTER (WHERE accion = 'sesion.fallida')::int AS fallidas,
            (SELECT count(*)::int FROM usuario
              WHERE activo AND ultimo_acceso > now() - interval '10 minutes') AS activas
       FROM e`,
    [desde(dias)],
  );

  return {
    eventos: fila?.eventos ?? 0,
    personas: fila?.personas ?? 0,
    sesiones: fila?.sesiones ?? 0,
    fallidas: fila?.fallidas ?? 0,
    activasAhora: fila?.activas ?? 0,
  };
}

/** Eventos por hora del día (0–23): responde «¿a qué hora se trabaja?». */
export async function actividadPorHora(dias: Rango): Promise<{ hora: number; eventos: number }[]> {
  const filas = await consultar<{ hora: number; eventos: number }>(
    `WITH e AS (${EVENTOS})
     SELECT h AS hora, count(e.id)::int AS eventos
       FROM generate_series(0, 23) h
       LEFT JOIN e ON extract(hour FROM e.cuando AT TIME ZONE '${ZONA}')::int = h
      GROUP BY h ORDER BY h`,
    [desde(dias)],
  );

  return filas;
}

/** Eventos por día, con los días vacíos incluidos: un hueco también dice algo. */
export async function actividadPorDia(dias: Rango): Promise<{ dia: string; eventos: number }[]> {
  const filas = await consultar<{ dia: string; eventos: number }>(
    `WITH e AS (${EVENTOS})
     SELECT d::date::text AS dia, count(e.id)::int AS eventos
       FROM generate_series(($1::timestamptz AT TIME ZONE '${ZONA}')::date,
                            (now() AT TIME ZONE '${ZONA}')::date, '1 day') d
       LEFT JOIN e ON (e.cuando AT TIME ZONE '${ZONA}')::date = d::date
      GROUP BY d ORDER BY d`,
    [desde(dias)],
  );

  return filas;
}

export async function actividadPorPersona(
  dias: Rango,
  limite = 10,
): Promise<{ id: string | null; nombre: string; rol: string | null; eventos: number }[]> {
  return consultar(
    `WITH e AS (${EVENTOS})
     SELECT e.usuario_id AS id, coalesce(u.nombre, '—') AS nombre, ro.nombre AS rol,
            count(*)::int AS eventos
       FROM e
       LEFT JOIN usuario u ON u.id = e.usuario_id
       LEFT JOIN rol ro ON ro.id = u.rol_id
      WHERE e.accion NOT IN ('sesion.fallida')
      GROUP BY e.usuario_id, u.nombre, ro.nombre
      ORDER BY eventos DESC LIMIT $2`,
    [desde(dias), limite],
  );
}

/** El módulo es lo que va antes del primer punto de la acción: `tarea.creada` → `tarea`. */
export async function actividadPorModulo(
  dias: Rango,
  limite = 8,
): Promise<{ modulo: string; eventos: number }[]> {
  return consultar(
    `WITH e AS (${EVENTOS})
     SELECT split_part(accion, '.', 1) AS modulo, count(*)::int AS eventos
       FROM e GROUP BY 1 ORDER BY eventos DESC LIMIT $2`,
    [desde(dias), limite],
  );
}

export type Conectado = {
  id: string;
  nombre: string;
  rol: string;
  ultimoAcceso: Date;
  minutos: number;
};

/** Quién entró en las últimas 24 horas y cuándo fue la última vez. */
export async function conectadosRecientes(): Promise<Conectado[]> {
  const filas = await consultar<{
    id: string;
    nombre: string;
    rol: string;
    ultimo_acceso: Date;
    minutos: string;
  }>(
    `SELECT u.id, u.nombre, ro.nombre AS rol, u.ultimo_acceso,
            (extract(epoch FROM now() - u.ultimo_acceso) / 60)::int AS minutos
       FROM usuario u JOIN rol ro ON ro.id = u.rol_id
      WHERE u.activo AND u.ultimo_acceso > now() - interval '24 hours'
      ORDER BY u.ultimo_acceso DESC LIMIT 20`,
  );

  return filas.map((f) => ({
    id: f.id,
    nombre: f.nombre,
    rol: f.rol,
    ultimoAcceso: f.ultimo_acceso,
    minutos: Number(f.minutos),
  }));
}

export type FiltroLinea = {
  dias: Rango;
  usuarioId?: string | null;
  modulo?: string | null;
  origen?: string | null;
  pagina?: number;
};

export type EventoLinea = {
  id: string;
  cuando: Date;
  usuarioId: string | null;
  persona: string | null;
  rol: string | null;
  accion: string;
  objeto: string;
  origen: string;
};

export const POR_PAGINA_LINEA = 40;

const FILTROS = `($2::uuid IS NULL OR e.usuario_id = $2::uuid)
             AND ($3::text IS NULL OR split_part(e.accion, '.', 1) = $3)
             AND ($4::text IS NULL OR e.origen = $4)`;

export async function lineaDeTiempo(
  filtro: FiltroLinea,
): Promise<{ eventos: EventoLinea[]; total: number }> {
  const pagina = Math.max(1, Math.trunc(filtro.pagina ?? 1));
  const parametros = [
    desde(filtro.dias),
    filtro.usuarioId || null,
    filtro.modulo || null,
    filtro.origen || null,
  ];

  const [filas, total] = await Promise.all([
    consultar<{
      id: string;
      cuando: Date;
      usuario_id: string | null;
      persona: string | null;
      rol: string | null;
      accion: string;
      objeto: string;
      origen: string;
    }>(
      `WITH e AS (${EVENTOS})
       SELECT e.id, e.cuando, e.usuario_id, u.nombre AS persona, ro.nombre AS rol,
              e.accion, e.objeto, e.origen
         FROM e
         LEFT JOIN usuario u ON u.id = e.usuario_id
         LEFT JOIN rol ro ON ro.id = u.rol_id
        WHERE ${FILTROS}
        ORDER BY e.cuando DESC
        LIMIT $5 OFFSET $6`,
      [...parametros, POR_PAGINA_LINEA, (pagina - 1) * POR_PAGINA_LINEA],
    ),
    consultarUna<{ n: number }>(
      `WITH e AS (${EVENTOS}) SELECT count(*)::int AS n FROM e WHERE ${FILTROS}`,
      parametros,
    ),
  ]);

  return {
    total: total?.n ?? 0,
    eventos: filas.map((f) => ({
      id: f.id,
      cuando: f.cuando,
      usuarioId: f.usuario_id,
      persona: f.persona,
      rol: f.rol,
      accion: f.accion,
      objeto: f.objeto,
      origen: f.origen,
    })),
  };
}

/** Personas con alguna actividad en el rango, para el filtro. */
export async function personasConActividad(dias: Rango): Promise<{ id: string; nombre: string }[]> {
  return consultar(
    `WITH e AS (${EVENTOS})
     SELECT DISTINCT u.id, u.nombre FROM e JOIN usuario u ON u.id = e.usuario_id
      ORDER BY u.nombre`,
    [desde(dias)],
  );
}

/** Marca de presencia: se llama en cada pantalla del portal y escribe como mucho cada 5 minutos. */
export async function marcarPresencia(usuarioId: string): Promise<void> {
  await consultar(
    `UPDATE usuario SET ultimo_acceso = now()
      WHERE id = $1 AND (ultimo_acceso IS NULL OR ultimo_acceso < now() - interval '5 minutes')`,
    [usuarioId],
  ).catch((error) => console.error("[actividad] no se pudo marcar la presencia", error));
}

export type FilaExportada = {
  cuando: Date;
  persona: string | null;
  correo: string | null;
  rol: string | null;
  accion: string;
  objeto: string;
  origen: string;
};

/** Tope de filas de una descarga: con más, el archivo deja de abrirse en una hoja de cálculo. */
export const MAXIMO_EXPORTADAS = 50_000;

/** La misma línea de tiempo, sin paginar y con el correo, para guardarla fuera del sistema. */
export async function actividadParaExportar(
  filtro: Omit<FiltroLinea, "pagina">,
): Promise<FilaExportada[]> {
  return consultar<FilaExportada>(
    `WITH e AS (${EVENTOS})
     SELECT e.cuando, u.nombre AS persona, u.email::text AS correo, ro.nombre AS rol,
            e.accion, e.objeto, e.origen
       FROM e
       LEFT JOIN usuario u ON u.id = e.usuario_id
       LEFT JOIN rol ro ON ro.id = u.rol_id
      WHERE ${FILTROS}
      ORDER BY e.cuando DESC
      LIMIT $5`,
    [
      desde(filtro.dias),
      filtro.usuarioId || null,
      filtro.modulo || null,
      filtro.origen || null,
      MAXIMO_EXPORTADAS,
    ],
  );
}
