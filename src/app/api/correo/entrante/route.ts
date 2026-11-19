import { createHash, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { autenticacionDe } from "@/lib/correos-patrocinador";
import { ipDeCabeceras, permitirFrecuencia } from "@/lib/frecuencia";
import { recibirCorreo } from "@/server/correos/procesar";

/**
 * Puerta de entrada de las cartas de los becados a sus patrocinadores.
 *
 * No depende de un proveedor de correo: cualquier cosa que reciba el buzón de
 * la Fundación (un flujo de n8n con un disparador de Gmail, el correo entrante de
 * Resend, un reenvío de Google Workspace) la llama con un mensaje ya
 * normalizado:
 *
 *   POST /api/correo/entrante
 *   Authorization: Bearer <CORREO_ENTRANTE_SECRET>
 *   { "message_id", "from", "subject", "text", "html", "received_at",
 *     "authentication": "pass"|"fail"|"desconocida" | cabecera Authentication-Results,
 *     "attachments": <número> }
 *
 * Es pública a propósito (no hay sesión), así que se protege con un secreto
 * compartido comparado en tiempo constante, tope de tamaño y tope de frecuencia.
 * La respuesta nunca dice qué decidió el agente.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAXIMO_BYTES = 256 * 1024;

const huella = (valor: string) => createHash("sha256").update(valor).digest();

const texto = (v: unknown, maximo: number): string | null =>
  typeof v === "string" ? v.slice(0, maximo) : null;

export async function POST(peticion: Request) {
  const secreto = process.env.CORREO_ENTRANTE_SECRET;

  if (!secreto) return NextResponse.json({ error: "no_configurado" }, { status: 503 });

  const ip = ipDeCabeceras(peticion.headers);

  if (!permitirFrecuencia(`correo-entrante:${ip}`, 120, 60_000)) {
    return NextResponse.json({ error: "demasiadas_peticiones" }, { status: 429 });
  }

  const enviado = (peticion.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");

  // Se comparan huellas del mismo largo: `timingSafeEqual` exige igual tamaño y
  // así no se filtra el largo del secreto.
  if (!timingSafeEqual(huella(enviado), huella(secreto))) {
    return NextResponse.json({ error: "no_autorizado" }, { status: 401 });
  }

  const declarado = Number(peticion.headers.get("content-length") ?? 0);

  if (declarado > MAXIMO_BYTES) return NextResponse.json({ error: "demasiado_grande" }, { status: 413 });

  const crudo = await peticion.text();

  if (crudo.length > MAXIMO_BYTES) return NextResponse.json({ error: "demasiado_grande" }, { status: 413 });

  let cuerpo: Record<string, unknown>;

  try {
    cuerpo = JSON.parse(crudo) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalido" }, { status: 400 });
  }

  const messageId = texto(cuerpo.message_id, 300)?.trim();
  const remitente = texto(cuerpo.from, 320)?.trim();
  const recibido = new Date(String(cuerpo.received_at ?? ""));

  if (!messageId || !remitente) return NextResponse.json({ error: "invalido" }, { status: 400 });

  const autenticacion = cuerpo.authentication;

  try {
    const estado = await recibirCorreo({
      messageId,
      remitente,
      asunto: texto(cuerpo.subject, 300),
      texto: texto(cuerpo.text, MAXIMO_BYTES),
      html: texto(cuerpo.html, MAXIMO_BYTES),
      // Sin fecha válida se usa la de llegada: nunca se confía en una futura.
      recibidoEn: Number.isNaN(recibido.getTime()) || recibido.getTime() > Date.now() ? new Date() : recibido,
      autenticacion:
        autenticacion === "pass" || autenticacion === "fail" || autenticacion === "desconocida"
          ? autenticacion
          : autenticacionDe(typeof autenticacion === "string" ? autenticacion : null),
      adjuntos: Number.isFinite(Number(cuerpo.attachments)) ? Math.max(0, Number(cuerpo.attachments)) : 0,
    });

    return NextResponse.json({ ok: true, recibido: estado !== "repetido" });
  } catch (error) {
    console.error("[api/correo/entrante] Error:", error);

    return NextResponse.json({ error: "error_servidor" }, { status: 500 });
  }
}
