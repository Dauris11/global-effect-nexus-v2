import { NextRequest, NextResponse } from "next/server";

import { obtenerUsuarioActual } from "@/lib/auth";
import { usuarioTienePermiso } from "@/lib/rbac";
import { registrarLectura } from "@/server/contabilidad/bitacora";
import { contextoDe } from "@/server/contabilidad/sesion";
import { exportarCostoPorCarreraExcel, exportarCostoPorEstudianteExcel } from "@/server/costos/excel";

/**
 * Excel del costo por estudiante (`?vista=carreras|estudiantes`). El permiso se
 * comprueba aquí y no solo en la pantalla: la URL se puede abrir sin pasar por
 * ella. Cada descarga queda en la bitácora de contabilidad.
 */
export async function GET(request: NextRequest) {
  const usuario = await obtenerUsuarioActual();

  if (!usuario || !usuarioTienePermiso(usuario, "expedientes.costos.leer")) {
    return new NextResponse("No autorizado", { status: 403 });
  }

  const vista = request.nextUrl.searchParams.get("vista") === "estudiantes" ? "estudiantes" : "carreras";

  try {
    const buffer = vista === "estudiantes" ? await exportarCostoPorEstudianteExcel() : await exportarCostoPorCarreraExcel();

    await registrarLectura(
      await contextoDe(usuario),
      "exportar",
      "public.v_estudiante_costo_total",
      undefined,
      `Exportación de costo por estudiante (${vista})`,
    );

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Costo_por_${vista === "estudiantes" ? "estudiante" : "carrera"}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("[costos] error al exportar", error);
    return new NextResponse("Error al generar el archivo Excel", { status: 500 });
  }
}
