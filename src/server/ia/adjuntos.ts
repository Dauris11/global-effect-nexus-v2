import { consultar, consultarUna } from "@/lib/db";
import { MAXIMO_DOCUMENTO_OCR, TIPOS_DOCUMENTO_OCR } from "@/lib/ia";

/**
 * Adjuntos del chat de Elly: el archivo se guarda unos minutos para que las
 * herramientas lo lean por id (ver la migración 0103). Siempre del dueño: una
 * persona no puede pedir el adjunto de otra aunque adivine el id.
 */

export type Adjunto = { id: string; mime: string; nombre: string };

export type ResultadoAdjunto = { estado: "ok"; adjunto: Adjunto; base64: string } | { estado: "tipo_no_admitido" | "demasiado_grande" | "vacio" };

export async function guardarAdjunto(usuarioId: string, archivo: File): Promise<ResultadoAdjunto> {
  if (archivo.size === 0) return { estado: "vacio" };
  if (!(TIPOS_DOCUMENTO_OCR as readonly string[]).includes(archivo.type)) return { estado: "tipo_no_admitido" };
  if (archivo.size > MAXIMO_DOCUMENTO_OCR) return { estado: "demasiado_grande" };

  const bytes = Buffer.from(await archivo.arrayBuffer());

  // Lo que se guarda es lo que se verificó: la firma real, no el tipo que declaró el navegador.
  const esPdf = bytes.subarray(0, 5).toString("latin1") === "%PDF-";
  const esPng = bytes[0] === 0x89 && bytes[1] === 0x50;
  const esJpg = bytes[0] === 0xff && bytes[1] === 0xd8;
  const esWebp = bytes.subarray(0, 4).toString("latin1") === "RIFF" && bytes.subarray(8, 12).toString("latin1") === "WEBP";
  const mime = esPdf ? "application/pdf" : esPng ? "image/png" : esJpg ? "image/jpeg" : esWebp ? "image/webp" : null;

  if (!mime) return { estado: "tipo_no_admitido" };

  await consultar(`DELETE FROM ia_adjunto WHERE created_at < now() - interval '1 hour'`);

  const nombre = archivo.name.replace(/[^\p{L}\p{N}._ -]/gu, "").slice(0, 120) || "adjunto";
  const fila = await consultarUna<{ id: string }>(
    `INSERT INTO ia_adjunto (usuario_id, mime, nombre, contenido) VALUES ($1, $2, $3, $4) RETURNING id`,
    [usuarioId, mime, nombre, bytes],
  );

  return { estado: "ok", adjunto: { id: fila!.id, mime, nombre }, base64: bytes.toString("base64") };
}

export async function obtenerAdjunto(usuarioId: string, id: string): Promise<(Adjunto & { bytes: Buffer }) | null> {
  const fila = await consultarUna<{ id: string; mime: string; nombre: string; contenido: Buffer }>(
    `SELECT id, mime, nombre, contenido FROM ia_adjunto WHERE id = $1 AND usuario_id = $2 AND created_at > now() - interval '1 hour'`,
    [id, usuarioId],
  );

  return fila ? { id: fila.id, mime: fila.mime, nombre: fila.nombre, bytes: fila.contenido } : null;
}

export const borrarAdjunto = (usuarioId: string, id: string) =>
  consultar(`DELETE FROM ia_adjunto WHERE id = $1 AND usuario_id = $2`, [id, usuarioId]);
