import { consultar, consultarUna } from "@/lib/db";
import type { EstadoCarta } from "@/lib/correos-patrocinador";

/**
 * Lo que se sigue del estudiante mes a mes y lo que lo ata a su patrocinador.
 * Se pide una sola vez al abrir la ficha (las pestañas del detalle son del
 * cliente y no recargan): son unas decenas de filas de UNA persona.
 */

export type MesSeguimiento = {
  mes: string;
  servicio: boolean;
  reunion: boolean;
  /** Derivado de `correo_patrocinador`: nadie lo marca a mano. */
  carta: EstadoCarta;
};

export type EtapaExpediente = {
  estado_anterior: string | null;
  estado_nuevo: string;
  motivo: string | null;
  por: string | null;
  cuando: string;
};

export type AsignacionPatrocinio = {
  id: string;
  patrocinador_id: string;
  patrocinador: string;
  pais: string | null;
  idioma: "es" | "en";
  monto: number;
  desde: string;
  hasta: string | null;
  activa: boolean;
};

export type SeguimientoExpediente = {
  meses: MesSeguimiento[];
  etapas: EtapaExpediente[];
  /** Fecha en que pasó a «graduado» según el historial de etapas, si consta. */
  graduadoEl: string | null;
  asignaciones: AsignacionPatrocinio[];
};

export async function seguimientoDelEstudiante(estudianteId: string): Promise<SeguimientoExpediente> {
  const [meses, etapas, graduado, asignaciones] = await Promise.all([
    consultar<MesSeguimiento>(
      `WITH rd AS (SELECT date_trunc('month', now() AT TIME ZONE 'America/Santo_Domingo')::date AS mes0),
            meses AS (SELECT to_char(d, 'YYYY-MM') AS mes
                        FROM rd, generate_series(rd.mes0 - interval '11 months', rd.mes0, interval '1 month') d),
            alta AS (SELECT to_char(fecha_ingreso, 'YYYY-MM') AS desde,
                            EXISTS (SELECT 1 FROM asignacion_beca a WHERE a.estudiante_id = e.id) AS con_patrocinio
                       FROM estudiante e WHERE e.id = $1)
       SELECT m.mes,
              coalesce(r.hizo_servicio, false)   AS servicio,
              coalesce(r.asistio_reunion, false) AS reunion,
              CASE WHEN NOT alta.con_patrocinio THEN 'no_aplica'
                   WHEN c.ok THEN 'cumplio' WHEN c.rev THEN 'en_revision' WHEN c.tarde THEN 'tardia'
                   ELSE 'no_envio' END AS carta
         FROM meses m
         CROSS JOIN alta
         LEFT JOIN registro_servicio r ON r.estudiante_id = $1 AND r.mes = m.mes
         LEFT JOIN LATERAL (
                SELECT bool_or(estado = 'reenviado' AND a_tiempo)                    AS ok,
                       bool_or(estado = 'retenido'  AND a_tiempo)                    AS rev,
                       bool_or(estado IN ('reenviado', 'retenido') AND NOT a_tiempo) AS tarde
                  FROM correo_patrocinador
                 WHERE estudiante_id = $1 AND mes = m.mes) c ON TRUE
        -- Antes del ingreso no hay nada que seguir.
        WHERE alta.desde IS NULL OR m.mes >= alta.desde
        ORDER BY m.mes DESC`,
      [estudianteId],
    ),
    consultar<EtapaExpediente>(
      `SELECT et.estado_anterior::text AS estado_anterior, et.estado_nuevo::text AS estado_nuevo,
              et.motivo, u.nombre AS por, et.creado_en::text AS cuando
         FROM estudiante_etapa et
         LEFT JOIN usuario u ON u.id = et.usuario_id
        WHERE et.estudiante_id = $1
        ORDER BY et.creado_en DESC, et.id DESC`,
      [estudianteId],
    ),
    consultarUna<{ cuando: string }>(
      `SELECT min(creado_en)::date::text AS cuando
         FROM estudiante_etapa
        WHERE estudiante_id = $1 AND estado_nuevo = 'graduado'`,
      [estudianteId],
    ),
    consultar<AsignacionPatrocinio>(
      `SELECT a.id, a.patrocinador_id, p.nombre AS patrocinador, p.pais, p.idioma,
              a.monto::float8 AS monto, a.fecha_inicio::text AS desde, a.fecha_fin::text AS hasta,
              (a.estado = 'activo') AS activa
         FROM asignacion_beca a
         JOIN patrocinador p ON p.id = a.patrocinador_id
        WHERE a.estudiante_id = $1
        ORDER BY (a.estado = 'activo') DESC, a.fecha_inicio DESC`,
      [estudianteId],
    ),
  ]);

  return { meses, etapas, graduadoEl: graduado?.cuando ?? null, asignaciones };
}
