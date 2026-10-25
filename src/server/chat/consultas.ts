import { consultar, consultarUna } from "@/lib/db";

export type CanalChat = {
  id: string;
  tipo: "directo" | "grupo" | "departamento" | "hilo_caso";
  nombre: string | null;
  departamento_id: string | null;
  entidad_tipo: string | null;
  entidad_id: string | null;
  creado_por: string;
  created_at: string;
  sin_leer: number;
  ultimo_mensaje_contenido: string | null;
  ultimo_mensaje_fecha: string | null;
};

export type MensajeChat = {
  id: string;
  canal_id: string;
  remitente_id: string;
  remitente_nombre: string;
  remitente_foto: string | null;
  contenido: string | null;
  tipo: "texto" | "imagen" | "archivo" | "nota_voz" | "comprobante_gasto" | "sistema";
  documento_id: string | null;
  datos_extra: {
    monto?: number;
    moneda?: string;
    rnc?: string;
    ncf?: string;
    proveedor?: string;
    concepto?: string;
    categoria?: string;
    estado_aprobacion?: string;
    comprobante_recibido_id?: string;
  } | null;
  editado: boolean;
  created_at: string;
};

/**
 * Lista todos los canales accesibles por el usuario:
 * - Canales donde es participante directo.
 * - Canales departamentales de su departamento.
 */
export async function listarCanalesUsuario(usuarioId: string): Promise<CanalChat[]> {
  return consultar<CanalChat>(
    `SELECT c.id,
            c.tipo,
            c.nombre,
            c.departamento_id,
            c.entidad_tipo,
            c.entidad_id,
            c.creado_por,
            c.created_at::text,
            (
              SELECT count(*)::int
                FROM public.chat_mensaje m
               WHERE m.canal_id = c.id
                 AND (
                   cp.ultimo_leido_mensaje_id IS NULL
                   OR m.created_at > (
                     SELECT created_at FROM public.chat_mensaje WHERE id = cp.ultimo_leido_mensaje_id
                   )
                 )
                 AND m.remitente_id <> $1
            ) AS sin_leer,
            (
              SELECT m.contenido
                FROM public.chat_mensaje m
               WHERE m.canal_id = c.id
               ORDER BY m.created_at DESC
               LIMIT 1
            ) AS ultimo_mensaje_contenido,
            (
              SELECT m.created_at::text
                FROM public.chat_mensaje m
               WHERE m.canal_id = c.id
               ORDER BY m.created_at DESC
               LIMIT 1
            ) AS ultimo_mensaje_fecha
       FROM public.chat_canal c
       LEFT JOIN public.chat_participante cp ON cp.canal_id = c.id AND cp.usuario_id = $1
      WHERE cp.usuario_id = $1
         OR c.tipo = 'departamento'
      ORDER BY ultimo_mensaje_fecha DESC NULLS LAST, c.created_at DESC`,
    [usuarioId],
  );
}

/**
 * Obtiene los mensajes de un canal ordenados cronológicamente.
 */
export async function mensajesDeCanal(
  canalId: string,
  limite = 50,
): Promise<MensajeChat[]> {
  const filas = await consultar<MensajeChat>(
    `SELECT m.id,
            m.canal_id,
            m.remitente_id,
            u.nombre AS remitente_nombre,
            u.foto_url AS remitente_foto,
            m.contenido,
            m.tipo,
            m.documento_id,
            m.datos_extra,
            m.editado,
            m.created_at::text
       FROM public.chat_mensaje m
       JOIN public.usuario u ON u.id = m.remitente_id
      WHERE m.canal_id = $1
      ORDER BY m.created_at DESC
      LIMIT $2`,
    [canalId, limite],
  );

  return filas.reverse();
}

/**
 * Obtiene los detalles de un canal por su ID.
 */
export async function detalleCanal(canalId: string): Promise<CanalChat | null> {
  return consultarUna<CanalChat>(
    `SELECT c.id,
            c.tipo,
            c.nombre,
            c.departamento_id,
            c.entidad_tipo,
            c.entidad_id,
            c.creado_por,
            c.created_at::text,
            0 AS sin_leer,
            NULL AS ultimo_mensaje_contenido,
            NULL AS ultimo_mensaje_fecha
       FROM public.chat_canal c
      WHERE c.id = $1`,
    [canalId],
  );
}
