import { NextRequest, NextResponse } from "next/server";

import { registrar } from "@/lib/auditoria";
import { obtenerUsuarioActual } from "@/lib/auth";
import { actividadParaExportar, rangoValido } from "@/server/auditoria/actividad";

/**
 * Descarga de la actividad del equipo en CSV, para guardarla fuera del sistema.
 *
 * Solo `super_admin`, y la propia descarga queda en el registro: quien se lleva
 * el historial de todos también deja constancia de que lo hizo.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ORIGENES = ["sistema", "contabilidad", "asistente", "inventario"];

/**
 * Una celda que empieza por `=`, `+`, `-` o `@` la ejecuta una hoja de cálculo
 * como fórmula. Los nombres y objetos salen de la base y alguien pudo escribirlos:
 * se les antepone un apóstrofo para que se lean como texto.
 */
function celda(valor: unknown): string {
  let texto = valor === null || valor === undefined ? "" : String(valor);

  if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;

  return `"${texto.replace(/"/g, '""')}"`;
}

export async function GET(peticion: NextRequest) {
  const usuario = await obtenerUsuarioActual();

  if (!usuario || usuario.rol !== "super_admin") {
    return new NextResponse("No autorizado", { status: 403 });
  }

  const p = peticion.nextUrl.searchParams;
  const dias = rangoValido(p.get("dias"));
  const usuarioId = p.get("usuario") && UUID.test(p.get("usuario")!) ? p.get("usuario") : null;
  const modulo = p.get("modulo") && /^[a-z0-9_]{1,40}$/.test(p.get("modulo")!) ? p.get("modulo") : null;
  const origen = ORIGENES.includes(p.get("origen") ?? "") ? p.get("origen") : null;

  const filas = await actividadParaExportar({ dias, usuarioId, modulo, origen });

  const formato = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Santo_Domingo",
    dateStyle: "short",
    timeStyle: "medium",
  });

  const lineas = [
    ["fecha_hora", "persona", "correo", "rol", "accion", "objeto", "origen"].map(celda).join(","),
    ...filas.map((f) =>
      [formato.format(f.cuando), f.persona, f.correo, f.rol, f.accion, f.objeto, f.origen]
        .map(celda)
        .join(","),
    ),
  ];

  await registrar({
    usuarioId: usuario.id,
    accion: "actividad.exportada",
    entidad: "actividad",
    datos: { dias, filas: filas.length, usuario: usuarioId, modulo, origen },
  });

  // BOM para que Excel lea las tildes como UTF-8.
  return new NextResponse(`﻿${lineas.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="actividad-${dias}d.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
