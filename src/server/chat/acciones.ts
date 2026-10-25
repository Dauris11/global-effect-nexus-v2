"use server";

import { revalidatePath } from "next/cache";
import { requerirUsuario } from "@/lib/auth";
import { consultar, consultarUna, enTransaccion } from "@/lib/db";
import { notificarUsuario } from "@/server/compartidos/notificaciones";

/**
 * Envía un mensaje en un canal de chat.
 */
export async function enviarMensajeChat(datos: {
  canalId: string;
  contenido?: string;
  tipo?: "texto" | "imagen" | "archivo" | "nota_voz" | "comprobante_gasto";
  documentoId?: string;
  datosExtra?: Record<string, unknown>;
}): Promise<{ ok: boolean; mensajeId?: string; error?: string }> {
  const usuario = await requerirUsuario();

  if (!datos.canalId) {
    return { ok: false, error: "Canal inválido" };
  }

  const fila = await consultarUna<{ id: string }>(
    `INSERT INTO public.chat_mensaje (
       canal_id, remitente_id, contenido, tipo, documento_id, datos_extra
     ) VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      datos.canalId,
      usuario.id,
      datos.contenido ?? null,
      datos.tipo ?? "texto",
      datos.documentoId ?? null,
      datos.datosExtra ? JSON.stringify(datos.datosExtra) : null,
    ],
  );

  // Marcar como último leído para el propio remitente
  if (fila?.id) {
    await consultar(
      `INSERT INTO public.chat_participante (canal_id, usuario_id, ultimo_leido_mensaje_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (canal_id, usuario_id) DO UPDATE
          SET ultimo_leido_mensaje_id = EXCLUDED.ultimo_leido_mensaje_id`,
      [datos.canalId, usuario.id, fila.id],
    );
  }

  revalidatePath("/chat");
  return { ok: true, mensajeId: fila?.id };
}

/**
 * Reporta un gasto / comprobante fotográfico desde el chat y lo ingresa
 * automáticamente a la Bandeja de Comprobantes Recibidos de Contabilidad.
 */
export async function reportarGastoDesdeChat(datos: {
  canalId: string;
  monto: number;
  moneda?: string;
  itbis?: number;
  proveedor?: string;
  rnc?: string;
  ncf?: string;
  concepto: string;
  categoria?: string;
  documentoId?: string;
  archivoUrl?: string;
  archivoSha256?: string;
  proyectoId?: string;
  cajaId?: string;
}): Promise<{ ok: boolean; comprobanteId?: string; error?: string }> {
  const usuario = await requerirUsuario();

  if (!datos.monto || datos.monto <= 0) {
    return { ok: false, error: "El monto debe ser mayor a cero" };
  }
  if (!datos.concepto) {
    return { ok: false, error: "El concepto o descripción es obligatorio" };
  }

  return enTransaccion(async (cliente) => {
    // 1. Crear el mensaje estructurado de tipo comprobante_gasto en el canal
    const { rows: rowsMensaje } = await cliente.query(
      `INSERT INTO public.chat_mensaje (
         canal_id, remitente_id, contenido, tipo, documento_id, datos_extra
       ) VALUES ($1, $2, $3, 'comprobante_gasto', $4, $5)
       RETURNING id`,
      [
        datos.canalId,
        usuario.id,
        datos.concepto,
        datos.documentoId ?? null,
        JSON.stringify({
          monto: datos.monto,
          moneda: datos.moneda ?? "DOP",
          proveedor: datos.proveedor,
          rnc: datos.rnc,
          ncf: datos.ncf,
          categoria: datos.categoria,
          estado_aprobacion: "recibido",
        }),
      ],
    );
    const mensajeId = rowsMensaje[0].id;

    // 2. Insertar en la Bandeja de Comprobantes Recibidos de Contabilidad
    const { rows: rowsComp } = await cliente.query(
      `INSERT INTO contabilidad.comprobante_recibido (
         mensaje_id, remitente_id, documento_id, archivo_url, archivo_sha256,
         monto, moneda, itbis, proveedor_nombre, proveedor_rnc, ncf,
         concepto, categoria, proyecto_id, caja_id, estado
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'recibido')
       RETURNING id, folio`,
      [
        mensajeId,
        usuario.id,
        datos.documentoId ?? null,
        datos.archivoUrl ?? null,
        datos.archivoSha256 ?? null,
        datos.monto,
        datos.moneda ?? "DOP",
        datos.itbis ?? 0,
        datos.proveedor ?? null,
        datos.rnc ?? null,
        datos.ncf ?? null,
        datos.concepto,
        datos.categoria ?? "otro",
        datos.proyectoId ?? null,
        datos.cajaId ?? null,
      ],
    );
    const comprobanteId = rowsComp[0].id;

    // 3. Notificar a los administradores y contadores sobre el nuevo comprobante en vivo
    const { rows: contadores } = await cliente.query(
      `SELECT u.id FROM public.usuario u
         JOIN public.rol r ON r.id = u.rol_id
        WHERE r.nombre IN ('contabilidad', 'super_admin', 'admin') AND u.activo = true`,
    );

    for (const c of contadores) {
      await notificarUsuario({
        usuarioId: c.id,
        titulo: "Nuevo comprobante de gasto recibido",
        mensaje: `${usuario.nombre} envió comprobante por ${datos.moneda ?? "DOP"} ${datos.monto} (${datos.concepto})`,
        tipo: "alerta",
        enlace: `/contabilidad/comprobantes-recibidos`,
      });
    }

    revalidatePath("/chat");
    revalidatePath("/contabilidad/comprobantes-recibidos");
    return { ok: true, comprobanteId };
  });
}

/**
 * Crea o abre un canal de chat directo entre dos personas.
 */
export async function obtenerOCrearCanalDirecto(
  otroUsuarioId: string,
): Promise<{ ok: boolean; canalId?: string; error?: string }> {
  const usuario = await requerirUsuario();

  if (usuario.id === otroUsuarioId) {
    return { ok: false, error: "No puedes crear un chat directo contigo mismo" };
  }

  // Buscar si ya existe un canal directo compartido entre ambos
  const existente = await consultarUna<{ id: string }>(
    `SELECT c.id
       FROM public.chat_canal c
       JOIN public.chat_participante cp1 ON cp1.canal_id = c.id AND cp1.usuario_id = $1
       JOIN public.chat_participante cp2 ON cp2.canal_id = c.id AND cp2.usuario_id = $2
      WHERE c.tipo = 'directo'
      LIMIT 1`,
    [usuario.id, otroUsuarioId],
  );

  if (existente?.id) {
    return { ok: true, canalId: existente.id };
  }

  return enTransaccion(async (cliente) => {
    const { rows: canalRows } = await cliente.query(
      `INSERT INTO public.chat_canal (tipo, creado_por)
       VALUES ('directo', $1)
       RETURNING id`,
      [usuario.id],
    );
    const canalId = canalRows[0].id;

    await cliente.query(
      `INSERT INTO public.chat_participante (canal_id, usuario_id)
       VALUES ($1, $2), ($1, $3)`,
      [canalId, usuario.id, otroUsuarioId],
    );

    revalidatePath("/chat");
    return { ok: true, canalId };
  });
}
