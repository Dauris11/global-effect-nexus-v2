import { createHash, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { vaciarColaCorreo } from "@/server/correos/cola";

/**
 * Vacía la cola de correos salientes. Pensada para un cron cada pocos minutos
 * (el planificador del hosting o n8n): reintenta lo que falló al enviarse.
 * Se protege con `CRON_SECRET` (`Authorization: Bearer …`).
 */

export const dynamic = "force-dynamic";

const huella = (v: string) => createHash("sha256").update(v).digest();

export async function GET(peticion: Request) {
  const secreto = process.env.CRON_SECRET;

  if (!secreto) return NextResponse.json({ error: "no_configurado" }, { status: 503 });

  const enviado = (peticion.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");

  if (!timingSafeEqual(huella(enviado), huella(secreto))) {
    return NextResponse.json({ error: "no_autorizado" }, { status: 401 });
  }

  return NextResponse.json(await vaciarColaCorreo(50));
}
