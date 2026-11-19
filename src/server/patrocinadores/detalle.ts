import { consultar, consultarUna } from "@/lib/db";
import type { EstadoCarta } from "@/lib/correos-patrocinador";

/**
 * Un patrocinador y los estudiantes a los que patrocina: el eslabón que unía la
 * lista de patrocinadores, las becas y los expedientes y que no existía. Una
 * persona puede tener varios becados, de ahí que sea una lista.
 */

export type PatrocinadorDetalle = {
  id: string;
  nombre: string;
  tipo: string;
  email: string | null;
  telefono: string | null;
  pais: string | null;
  idioma: "es" | "en";
  estado: string;
  monto_mensual: number;
  notas: string | null;
};

export async function patrocinadorPorId(id: string): Promise<PatrocinadorDetalle | null> {
  return consultarUna<PatrocinadorDetalle>(
    `SELECT id, nombre, tipo::text AS tipo, email::text AS email, telefono, pais, idioma, estado,
            coalesce(monto_mensual, 0)::float8 AS monto_mensual, notas
       FROM patrocinador WHERE id = $1`,
    [id],
  );
}

export type BecadoDePatrocinador = {
  estudiante_id: string;
  nombre: string;
  estado_estudiante: string;
  programa: string | null;
  universidad: string | null;
  grupo: number | null;
  foto_url: string | null;
  monto: number;
  desde: string;
  hasta: string | null;
  activa: boolean;
  /** Carta de este mes, derivada de `correo_patrocinador`. */
  carta: EstadoCarta;
};

/** Becados del patrocinador, los vigentes primero. `mes` es `YYYY-MM`. */
export async function becadosDelPatrocinador(patrocinadorId: string, mes: string): Promise<BecadoDePatrocinador[]> {
  return consultar<BecadoDePatrocinador>(
    `SELECT e.id AS estudiante_id, e.nombre, e.estado::text AS estado_estudiante, e.programa, e.universidad,
            e.grupo::int AS grupo, e.foto_url,
            a.monto::float8 AS monto, a.fecha_inicio::text AS desde, a.fecha_fin::text AS hasta,
            (a.estado = 'activo') AS activa,
            CASE WHEN a.estado <> 'activo' THEN 'no_aplica'
                 WHEN c.ok THEN 'cumplio' WHEN c.rev THEN 'en_revision' WHEN c.tarde THEN 'tardia'
                 ELSE 'no_envio' END AS carta
       FROM asignacion_beca a
       JOIN estudiante e ON e.id = a.estudiante_id
       LEFT JOIN LATERAL (
              SELECT bool_or(estado = 'reenviado' AND a_tiempo)                    AS ok,
                     bool_or(estado = 'retenido'  AND a_tiempo)                    AS rev,
                     bool_or(estado IN ('reenviado', 'retenido') AND NOT a_tiempo) AS tarde
                FROM correo_patrocinador
               WHERE estudiante_id = e.id AND mes = $2) c ON TRUE
      WHERE a.patrocinador_id = $1
      ORDER BY (a.estado = 'activo') DESC, e.nombre`,
    [patrocinadorId, mes],
  );
}
