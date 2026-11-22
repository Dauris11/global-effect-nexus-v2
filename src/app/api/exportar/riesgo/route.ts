import { NextResponse } from "next/server";

import { registrar } from "@/lib/auditoria";
import { obtenerUsuarioActual } from "@/lib/auth";
import { aCsv, respuestaCsv } from "@/lib/csv";
import { usuarioTienePermiso } from "@/lib/rbac";
import { estudiantesEnRiesgo } from "@/server/academico/riesgo";

/** Lista de estudiantes en riesgo académico, para abrir en Excel. */
export async function GET() {
  const usuario = await obtenerUsuarioActual();

  if (!usuario || !usuarioTienePermiso(usuario, "expedientes.leer")) return new NextResponse("No autorizado", { status: 401 });

  const filas = await estudiantesEnRiesgo();
  const csv = aCsv(
    ["Nombre", "Universidad", "Carrera", "Correo", "Teléfono", "Índice acumulado", "Mínimo acumulado", "Último período", "Índice del período", "Mínimo del período", "Materias reprobadas"],
    filas.map((f) => [f.nombre, f.universidad, f.carrera, f.email, f.telefono, f.indice?.toFixed(2), f.umbralAcumulado.toFixed(2), f.periodo, f.indicePeriodo?.toFixed(2), f.umbralPeriodo.toFixed(2), f.reprobadas]),
  );

  await registrar({ usuarioId: usuario.id, accion: "exportacion.descargada", entidad: "estudiante", entidadId: null, datos: { que: "riesgo", filas: filas.length } });

  return respuestaCsv("estudiantes-en-riesgo.csv", csv);
}
