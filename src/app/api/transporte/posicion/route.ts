import { NextResponse } from "next/server";

import { obtenerViajePorId } from "@/server/transporte/consultas";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Rastreo en vivo de un viaje. Es público a propósito (lo consume la puerta
 * `/transporte` sin sesión), así que no devuelve ids internos del chofer.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const viajeId = searchParams.get("viajeId");

  if (!viajeId || !UUID.test(viajeId)) {
    return NextResponse.json({ error: "viaje_invalido" }, { status: 400 });
  }

  try {
    const viaje = await obtenerViajePorId(viajeId);

    if (!viaje) {
      return NextResponse.json({ error: "no_encontrado" }, { status: 404 });
    }

    return NextResponse.json({
      ...viaje,
      chofer_id: "",
      incidencias: viaje.incidencias?.map((i) => ({ ...i, chofer_id: "" })),
    });
  } catch (error) {
    console.error("[api/transporte/posicion] Error:", error);
    return NextResponse.json({ error: "error_servidor" }, { status: 500 });
  }
}
