import { createHmac, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { autenticacionDe } from "@/lib/correos-patrocinador";
import { ipDeCabeceras, permitirFrecuencia } from "@/lib/frecuencia";
import { recibirCorreo } from "@/server/correos/procesar";

/**
 * Correo entrante de Resend: el estudiante escribe a la dirección de cartas y
 * Resend avisa aquí con el evento `email.received`.
 *
 * El aviso trae solo metadatos (no el cuerpo ni las cabeceras), así que se pide
 * el correo completo a la API de recepción y se entrega a `recibirCorreo`, el
 * mismo recorrido que usa `/api/correo/entrante`.
 *
 * Es pública (no hay sesión), así que la protege la firma Svix del webhook:
 * HMAC-SHA256 de `id.fecha.cuerpo` con el secreto `whsec_…`, comparada en
 * tiempo constante y con una ventana de 5 minutos contra repeticiones.
 *
 * Si algo falla se responde 500 para que Resend reintente: `recibirCorreo` es
 * idempotente por `message_id`, así que un reintento no duplica la carta.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAXIMO_BYTES = 256 * 1024;
const VENTANA_SEGUNDOS = 5 * 60;

function firmaValida(secreto: string, id: string, marca: string, cuerpo: string, cabecera: string) {
  const segundos = Number(marca);

  if (!Number.isFinite(segundos) || Math.abs(Date.now() / 1000 - segundos) > VENTANA_SEGUNDOS) {
    return false;
  }

  const clave = Buffer.from(secreto.replace(/^whsec_/, ""), "base64");
  const esperada = createHmac("sha256", clave).update(`${id}.${marca}.${cuerpo}`).digest();

  // La cabecera trae una o más firmas "v1,<base64>" separadas por espacio.
  return cabecera.split(" ").some((parte) => {
    const [version, firma] = parte.split(",");

    if (version !== "v1" || !firma) return false;

    const recibida = Buffer.from(firma, "base64");

    return recibida.length === esperada.length && timingSafeEqual(recibida, esperada);
  });
}

type CorreoRecibido = {
  text?: string | null;
  html?: string | null;
  subject?: string | null;
  from?: string | null;
  message_id?: string | null;
  created_at?: string | null;
  headers?: Record<string, unknown> | Array<{ name?: string; value?: string }> | null;
  attachments?: unknown[] | null;
};

/** Las cabeceras llegan como objeto o como lista según la versión de la API. */
function cabecera(headers: CorreoRecibido["headers"], nombre: string): string | null {
  if (!headers) return null;

  if (Array.isArray(headers)) {
    const fila = headers.find((h) => h.name?.toLowerCase() === nombre);

    return typeof fila?.value === "string" ? fila.value : null;
  }

  const clave = Object.keys(headers).find((k) => k.toLowerCase() === nombre);
  const valor = clave ? headers[clave] : null;

  return typeof valor === "string" ? valor : Array.isArray(valor) ? valor.join(" ") : null;
}

export async function POST(peticion: Request) {
  const secreto = process.env.RESEND_WEBHOOK_SECRET;
  const clave = process.env.RESEND_API_KEY;

  if (!secreto || !clave) return NextResponse.json({ error: "no_configurado" }, { status: 503 });

  if (!permitirFrecuencia(`correo-resend:${ipDeCabeceras(peticion.headers)}`, 120, 60_000)) {
    return NextResponse.json({ error: "demasiadas_peticiones" }, { status: 429 });
  }

  const crudo = await peticion.text();

  if (crudo.length > MAXIMO_BYTES) return NextResponse.json({ error: "demasiado_grande" }, { status: 413 });

  const id = peticion.headers.get("svix-id") ?? "";
  const marca = peticion.headers.get("svix-timestamp") ?? "";
  const firma = peticion.headers.get("svix-signature") ?? "";

  if (!id || !marca || !firma || !firmaValida(secreto, id, marca, crudo, firma)) {
    return NextResponse.json({ error: "no_autorizado" }, { status: 401 });
  }

  let evento: { type?: string; data?: { email_id?: string; created_at?: string } };

  try {
    evento = JSON.parse(crudo);
  } catch {
    return NextResponse.json({ error: "invalido" }, { status: 400 });
  }

  // Otros eventos del mismo webhook no son cartas: se confirman y se ignoran.
  if (evento.type !== "email.received") return NextResponse.json({ ok: true, ignorado: true });

  const emailId = evento.data?.email_id;

  if (!emailId) return NextResponse.json({ error: "invalido" }, { status: 400 });

  try {
    const respuesta = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`, {
      headers: { Authorization: `Bearer ${clave}` },
      cache: "no-store",
    });

    if (!respuesta.ok) throw new Error(`Resend ${respuesta.status}`);

    const correo = (await respuesta.json()) as CorreoRecibido;
    const remitente = correo.from?.trim();

    if (!remitente) return NextResponse.json({ error: "invalido" }, { status: 400 });

    const recibido = new Date(correo.created_at ?? evento.data?.created_at ?? "");
    const adjuntos = Array.isArray(correo.attachments) ? correo.attachments.length : 0;

    const estado = await recibirCorreo({
      // El Message-ID del remitente es estable entre reintentos; el id de Resend
      // es el respaldo si el correo no lo trae.
      messageId: (correo.message_id ?? cabecera(correo.headers, "message-id") ?? `resend:${emailId}`).slice(0, 300),
      remitente: remitente.slice(0, 320),
      asunto: correo.subject?.slice(0, 300) ?? null,
      texto: correo.text?.slice(0, MAXIMO_BYTES) ?? null,
      html: correo.html?.slice(0, MAXIMO_BYTES) ?? null,
      // Sin fecha válida se usa la de llegada: nunca se confía en una futura.
      recibidoEn: Number.isNaN(recibido.getTime()) || recibido.getTime() > Date.now() ? new Date() : recibido,
      // Sin la cabecera la carta queda «desconocida» y se retiene: es la salida segura.
      autenticacion: autenticacionDe(cabecera(correo.headers, "authentication-results")),
      adjuntos,
    });

    return NextResponse.json({ ok: true, recibido: estado !== "repetido" });
  } catch (error) {
    console.error("[api/correo/resend] Error:", error);

    return NextResponse.json({ error: "error_servidor" }, { status: 500 });
  }
}
