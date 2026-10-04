import { consultar, consultarUna } from "@/lib/db";

/**
 * Lectura de `audit_log`.
 *
 * La tabla existe desde la migración 0003 y se escribe desde las solicitudes,
 * los anuncios del inicio, la consulta y el borrado de expedientes, el
 * catálogo académico, contabilidad y academias.
 *
 * UNA DECISIÓN QUE MANDA SOBRE TODO ESTE ARCHIVO: el historial clínico se tapa
 * en el SQL, no en la vista.
 *
 * Hasta octubre de 2026 la Fundación tuvo un departamento de psicología, y sus
 * citas y notas escribieron aquí. La 0030 borró las tablas clínicas por decisión
 * de la Fundación, pero `audit_log` es append-only y conserva esas filas. Su
 * `datos` puede llevar el nivel de confidencialidad o el estado de una cita: un
 * visor que lo enseñara devolvería, por la puerta de atrás, justo lo que se
 * decidió borrar.
 *
 * Así que las filas de esas entidades **se devuelven sin `datos` y sin
 * `entidad_id`**, y el recorte lo hace el `CASE` del SELECT: el dato no sale de
 * la base. Queda lo que la rendición de cuentas necesita: qué acción se hizo,
 * quién la hizo y cuándo.
 */

/**
 * Entidades cuyo detalle no se enseña nunca en el visor: las del antiguo
 * módulo clínico, que ya no existen como tablas (0030).
 *
 * `estudiante` NO está en la lista, y es a propósito: `super_admin` tiene
 * `expedientes.leer`, así que ver "consultó el expediente de X" no le dice nada
 * que no pueda abrir él mismo.
 */
const CLINICAS = ["cita_psicologia", "nota_psicologica", "perfil_psicologico"];

/** Filas por página. Con más, la pantalla deja de ser legible. */
const POR_PAGINA = 50;

export type EventoAuditoria = {
  id: string;
  accion: string;
  entidad: string;
  entidad_id: string | null;
  datos: Record<string, unknown> | null;
  created_at: Date;
  usuario_id: string | null;
  actor: string | null;
  actor_email: string | null;
  /** `true` cuando el detalle se tapó por ser clínico. */
  reservado: boolean;
};

export type FiltroAuditoria = {
  busqueda?: string | null;
  entidad?: string | null;
  accion?: string | null;
  usuarioId?: string | null;
  desde?: string | null;
  hasta?: string | null;
  pagina?: number;
};

/**
 * El WHERE compartido por la lista y su recuento. Seis parámetros.
 *
 * `hasta` compara con `< $6::date + 1` y no con `<= $6::date`: `created_at` es
 * TIMESTAMPTZ, así que un `<=` sobre la fecha dejaría fuera todo lo que pasó
 * ese día después de medianoche —es decir, el día entero—.
 */
const CONDICION = `($1::text IS NULL
                    OR a.accion  ILIKE '%' || $1 || '%'
                    OR a.entidad ILIKE '%' || $1 || '%'
                    OR u.nombre  ILIKE '%' || $1 || '%')
               AND ($2::text IS NULL OR a.entidad = $2)
               AND ($3::text IS NULL OR a.accion = $3)
               AND ($4::uuid IS NULL OR a.usuario_id = $4::uuid)
               AND ($5::text IS NULL OR a.created_at >= $5::date)
               AND ($6::text IS NULL OR a.created_at < $6::date + 1)`;

function parametros(filtro: FiltroAuditoria): unknown[] {
  return [
    filtro.busqueda?.trim() || null,
    filtro.entidad || null,
    filtro.accion || null,
    filtro.usuarioId || null,
    filtro.desde || null,
    filtro.hasta || null,
  ];
}

/**
 * Los eventos, del más reciente al más antiguo.
 *
 * Paginación por desplazamiento (`OFFSET`) y no por cursor, a conciencia: un
 * registro de auditoría se lee filtrando —por día, por entidad, por persona— y
 * casi nunca se pasa de la tercera página. El cursor sería más correcto para
 * recorrer un millón de filas seguidas, que es justo lo que aquí no se hace, y
 * costaría perder los enlaces de «anterior» y «siguiente», que sin JavaScript
 * son lo único que hay.
 */
export async function eventosDeAuditoria(
  filtro: FiltroAuditoria = {},
): Promise<EventoAuditoria[]> {
  const pagina = Math.max(1, Math.trunc(filtro.pagina ?? 1));

  return consultar<EventoAuditoria>(
    `SELECT a.id,
            a.accion,
            a.entidad,
            -- El detalle de lo clínico no sale de la base. Ver la cabecera.
            CASE WHEN a.entidad = ANY($7) THEN NULL ELSE a.entidad_id END AS entidad_id,
            CASE WHEN a.entidad = ANY($7) THEN NULL ELSE a.datos END AS datos,
            (a.entidad = ANY($7)) AS reservado,
            a.created_at,
            a.usuario_id,
            u.nombre AS actor,
            u.email::text AS actor_email
       FROM audit_log a
       LEFT JOIN usuario u ON u.id = a.usuario_id
      WHERE ${CONDICION}
      ORDER BY a.created_at DESC
      LIMIT $8 OFFSET $9`,
    [
      ...parametros(filtro),
      CLINICAS,
      POR_PAGINA,
      (pagina - 1) * POR_PAGINA,
    ],
  );
}

export type ResumenAuditoria = {
  total: number;
  hoy: number;
  actores: number;
  entidades: number;
};

/** Las cifras de cabecera, sobre el conjunto filtrado entero. */
export async function resumenDeAuditoria(
  filtro: FiltroAuditoria = {},
): Promise<ResumenAuditoria> {
  const fila = await consultarUna<ResumenAuditoria>(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE a.created_at >= date_trunc('day', now()))::int AS hoy,
            count(DISTINCT a.usuario_id)::int AS actores,
            count(DISTINCT a.entidad)::int AS entidades
       FROM audit_log a
       LEFT JOIN usuario u ON u.id = a.usuario_id
      WHERE ${CONDICION}`,
    parametros(filtro),
  );

  return fila ?? { total: 0, hoy: 0, actores: 0, entidades: 0 };
}

/**
 * Las entidades y las acciones que EXISTEN en el registro, para los filtros.
 *
 * Salen de los datos y no de una lista escrita a mano: las acciones se llaman
 * `cita.completada`, `transaccion.creada`, `material.eliminado`… y cada módulo
 * nuevo añade las suyas. Un desplegable mantenido a mano se quedaría corto en
 * la primera sesión de trabajo.
 */
export async function vocabularioDeAuditoria(): Promise<{
  entidades: string[];
  acciones: string[];
}> {
  const filas = await consultar<{ clase: string; valor: string }>(
    `SELECT 'entidad' AS clase, entidad AS valor FROM audit_log GROUP BY entidad
      UNION ALL
     SELECT 'accion'  AS clase, accion  AS valor FROM audit_log GROUP BY accion
      ORDER BY clase, valor`,
  );

  return {
    entidades: filas.filter((f) => f.clase === "entidad").map((f) => f.valor),
    acciones: filas.filter((f) => f.clase === "accion").map((f) => f.valor),
  };
}

/** Las cuentas que han hecho algo, para el filtro por persona. */
export async function actoresDeAuditoria(): Promise<
  { id: string; nombre: string }[]
> {
  return consultar<{ id: string; nombre: string }>(
    `SELECT u.id, u.nombre
       FROM usuario u
      WHERE EXISTS (SELECT 1 FROM audit_log a WHERE a.usuario_id = u.id)
      ORDER BY u.nombre`,
  );
}

export { POR_PAGINA };
