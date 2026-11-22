import { NextResponse } from "next/server";

import { registrar } from "@/lib/auditoria";
import { obtenerUsuarioActual } from "@/lib/auth";
import { aCsv, respuestaCsv } from "@/lib/csv";
import { consultar } from "@/lib/db";
import { usuarioTienePermiso } from "@/lib/rbac";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Todas las calificaciones de los estudiantes de una universidad, una fila por materia
 * cursada, para abrir en Excel (`?universidad=<id>`). Es el récord completo tal como está
 * en el sistema: sirve para entregar a la universidad, a un patrocinador o para respaldo.
 */
export async function GET(peticion: Request) {
  const usuario = await obtenerUsuarioActual();

  if (!usuario || !usuarioTienePermiso(usuario, "expedientes.leer")) return new NextResponse("No autorizado", { status: 401 });

  const id = new URL(peticion.url).searchParams.get("universidad") ?? "";

  if (!UUID.test(id)) return new NextResponse("Falta la universidad", { status: 400 });

  const filas = await consultar<{ siglas: string; matricula: string | null; nombre: string; carrera: string | null; anio: number; ronda: number; codigo: string; materia: string; creditos: number; letra: string; nota: string | null }>(
    `SELECT u.siglas, e.matricula, e.nombre, c.nombre AS carrera, r.anio, r.ronda, r.codigo, r.nombre AS materia, r.creditos, r.letra, r.nota_numerica::text AS nota
       FROM resultado_materia r
       JOIN estudiante e ON e.id = r.estudiante_id
       JOIN universidad u ON u.id = e.universidad_id
       LEFT JOIN carrera c ON c.id = e.carrera_id
      WHERE e.universidad_id = $1
      ORDER BY e.nombre, r.anio, r.ronda, r.codigo`,
    [id],
  );

  if (filas.length === 0) return new NextResponse("Sin calificaciones", { status: 404 });

  const csv = aCsv(
    ["Matrícula", "Estudiante", "Carrera", "Año", "Período", "Código", "Materia", "Créditos", "Letra", "Nota"],
    filas.map((f) => [f.matricula, f.nombre, f.carrera, f.anio, f.ronda, f.codigo, f.materia, f.creditos, f.letra, f.nota]),
  );

  await registrar({ usuarioId: usuario.id, accion: "exportacion.descargada", entidad: "universidad", entidadId: id, datos: { que: "notas", filas: filas.length } });

  return respuestaCsv(`calificaciones-${filas[0].siglas}.csv`, csv);
}
