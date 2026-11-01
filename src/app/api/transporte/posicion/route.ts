import { NextResponse } from "next/server";

import { consultarUna } from "@/lib/db";
import type { TransporteViaje } from "@/lib/transporte";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const viajeId = searchParams.get("viajeId");

  if (!viajeId) {
    return NextResponse.json({ error: "viajeId requerido" }, { status: 400 });
  }

  try {
    const viaje = await consultarUna<TransporteViaje>(
      `SELECT v.id,
              v.horario_id,
              h.nombre AS horario_nombre,
              to_char(h.hora_salida, 'HH24:MI') AS hora_salida,
              v.chofer_id,
              u.nombre AS chofer_nombre,
              to_char(v.fecha, 'YYYY-MM-DD') AS fecha,
              v.estado,
              v.lat_actual::float AS lat_actual,
              v.lng_actual::float AS lng_actual,
              v.rumbo::float AS rumbo,
              v.velocidad_kmh::float AS velocidad_kmh,
              v.parada_actual_id,
              p.nombre AS parada_actual_nombre,
              to_char(v.iniciado_en, 'YYYY-MM-DD HH24:MI') AS iniciado_en,
              to_char(v.finalizado_en, 'YYYY-MM-DD HH24:MI') AS finalizado_en
         FROM transporte_viaje v
         JOIN transporte_horario h ON h.id = v.horario_id
         JOIN usuario u ON u.id = v.chofer_id
         LEFT JOIN transporte_parada p ON p.id = v.parada_actual_id
        WHERE v.id = $1`,
      [viajeId],
    );

    if (!viaje) {
      return NextResponse.json({ error: "no_encontrado" }, { status: 404 });
    }

    return NextResponse.json(viaje);
  } catch (error) {
    console.error("[api/transporte/posicion] Error:", error);
    return NextResponse.json({ error: "error_servidor" }, { status: 500 });
  }
}

