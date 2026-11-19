import { consultar } from "@/lib/db";
import type { EstadoCarta } from "@/lib/correos-patrocinador";

export type CartaPorRevisar = {
  id: string;
  remitente: string;
  asunto: string | null;
  estado: "sin_identificar" | "sin_patrocinador" | "retenido";
  mes: string;
  a_tiempo: boolean;
  estudiante: string | null;
  patrocinador: string | null;
  veredicto: "limpio" | "revisar" | null;
  motivos: string[];
  autenticacion: string;
  /** Recortados: la bandeja es una lista, no un lector de correo. */
  traduccion: string | null;
  original: string;
};

/** Cartas que esperan a una persona. Lo de otros estados ya está resuelto. */
export async function cartasPorRevisar(): Promise<CartaPorRevisar[]> {
  return consultar<CartaPorRevisar>(
    `SELECT c.id, c.remitente::text AS remitente, c.asunto, c.estado, c.mes, c.a_tiempo,
            e.nombre AS estudiante, p.nombre AS patrocinador,
            c.veredicto, c.motivos, c.autenticacion,
            left(c.traduccion, 2500)     AS traduccion,
            left(c.texto_original, 2500) AS original
       FROM correo_patrocinador c
       LEFT JOIN estudiante   e ON e.id = c.estudiante_id
       LEFT JOIN patrocinador p ON p.id = c.patrocinador_id
      WHERE c.estado IN ('sin_identificar', 'sin_patrocinador', 'retenido')
      ORDER BY c.recibido_en`,
  );
}

export type FilaPatrocinadorMes = {
  patrocinador_id: string;
  patrocinador: string;
  idioma: string;
  estudiante_id: string;
  estudiante: string;
  correo: EstadoCarta;
};

/**
 * Cada patrocinador con sus becados activos y el estado de la carta del mes.
 * Un patrocinador puede tener varios estudiantes, de ahí que sea una fila por
 * pareja y no por patrocinador.
 */
export async function cartasPorPatrocinador(mes: string): Promise<FilaPatrocinadorMes[]> {
  return consultar<FilaPatrocinadorMes>(
    `SELECT p.id AS patrocinador_id, p.nombre AS patrocinador, p.idioma,
            e.id AS estudiante_id, e.nombre AS estudiante,
            CASE
              WHEN c.ok    THEN 'cumplio'
              WHEN c.rev   THEN 'en_revision'
              WHEN c.tarde THEN 'tardia'
              ELSE 'no_envio'
            END AS correo
       FROM asignacion_beca a
       JOIN patrocinador p ON p.id = a.patrocinador_id
       JOIN estudiante   e ON e.id = a.estudiante_id AND e.estado = 'activo'
       LEFT JOIN LATERAL (
              SELECT bool_or(estado = 'reenviado' AND a_tiempo)                    AS ok,
                     bool_or(estado = 'retenido'  AND a_tiempo)                    AS rev,
                     bool_or(estado IN ('reenviado', 'retenido') AND NOT a_tiempo) AS tarde
                FROM correo_patrocinador
               WHERE estudiante_id = e.id AND mes = $1) c ON TRUE
      WHERE a.estado = 'activo' AND p.estado = 'activo'
      ORDER BY p.nombre, e.nombre`,
    [mes],
  );
}

/** Estudiantes activos, para vincular una carta de remitente desconocido. */
export async function estudiantesActivosParaVincular(): Promise<{ id: string; nombre: string; email: string | null }[]> {
  return consultar(
    `SELECT id, nombre, email::text AS email FROM estudiante WHERE estado = 'activo' ORDER BY nombre`,
  );
}
