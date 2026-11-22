import { NextResponse } from "next/server";

import { registrar } from "@/lib/auditoria";
import { obtenerUsuarioActual } from "@/lib/auth";
import { fechaLarga } from "@/lib/fechas";
import { usuarioTieneAlgunPermiso } from "@/lib/rbac";
import { estudianteDeUsuario } from "@/server/estudiantes/portal";
import { EXPORTACIONES } from "@/server/exportar/catalogo";
import { documentoACsv } from "@/server/exportar/csv";
import { documentoADocx } from "@/server/exportar/docx";
import { FORMATOS, type Formato } from "@/server/exportar/documento";
import { documentoAPdf } from "@/server/exportar/pdf";
import { documentoAXlsx } from "@/server/exportar/xlsx";

const TIPOS_MIME: Record<Formato, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv; charset=utf-8",
};

/**
 * Genera y entrega un documento del catálogo (`server/exportar/catalogo.ts`) en el formato
 * pedido: `/api/exportar/ficha?id=…&formato=pdf`. Con `ver=1` el PDF se abre en el navegador
 * (para imprimir) en vez de descargarse. Cada descarga queda en la bitácora.
 */
export async function GET(peticion: Request, { params }: { params: Promise<{ tipo: string }> }) {
  const usuario = await obtenerUsuarioActual();

  if (!usuario) return new NextResponse("No autorizado", { status: 401 });

  const { tipo } = await params;
  const definicion = Object.hasOwn(EXPORTACIONES, tipo) ? EXPORTACIONES[tipo] : null;

  if (!definicion) return new NextResponse("No encontrado", { status: 404 });

  // Cada estudiante puede bajar SU récord y SU avance (para entregarlos a su universidad o patrocinador).
  const url = new URL(peticion.url);
  const esSuyo = (tipo === "record" || tipo === "avance") && usuario.rol === "estudiante" && (await estudianteDeUsuario(usuario.id)).id === url.searchParams.get("id");

  if (!esSuyo && !usuarioTieneAlgunPermiso(usuario, [...definicion.permisos])) return new NextResponse("No encontrado", { status: 404 });
  const pedido = url.searchParams.get("formato") ?? "pdf";
  const formato = (FORMATOS as readonly string[]).includes(pedido) ? (pedido as Formato) : null;

  if (!formato || !definicion.formatos.includes(formato)) return new NextResponse("Formato no disponible para este documento", { status: 400 });

  try {
    const doc = await definicion.construir(url.searchParams);

    if (!doc) return new NextResponse("No encontrado", { status: 404 });

    const fecha = fechaLarga(new Date().toISOString(), "es");
    const cuerpo: Buffer | string =
      formato === "pdf" ? await documentoAPdf(doc, fecha) : formato === "docx" ? await documentoADocx(doc, fecha) : formato === "xlsx" ? await documentoAXlsx(doc) : documentoACsv(doc);

    await registrar({
      usuarioId: usuario.id,
      accion: "exportacion.generada",
      entidad: definicion.entidad,
      entidadId: url.searchParams.get("id"),
      datos: { documento: tipo, formato },
    });

    const enLinea = formato === "pdf" && url.searchParams.get("ver") === "1";

    return new Response(typeof cuerpo === "string" ? cuerpo : new Uint8Array(cuerpo), {
      headers: {
        "Content-Type": TIPOS_MIME[formato],
        "Content-Disposition": `${enLinea ? "inline" : "attachment"}; filename="${doc.nombreArchivo}.${formato}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error(`[exportar] no se pudo generar ${tipo}`, error);

    return new NextResponse("No se pudo generar el documento", { status: 500 });
  }
}
