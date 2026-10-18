import { NextRequest, NextResponse } from "next/server";
import { obtenerUsuarioActual } from "@/lib/auth";
import { contextoDe } from "@/server/contabilidad/sesion";
import { registrarLectura } from "@/server/contabilidad/bitacora";
import {
  exportarFormato606Excel,
  exportarFormato607Excel,
  exportarLibroBancoExcel,
  exportarCxpExcel,
} from "@/server/contabilidad/excel/exportaciones";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tipo: string }> },
) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario || (usuario.rol !== "contabilidad" && usuario.rol !== "super_admin")) {
    return new NextResponse("No autorizado", { status: 403 });
  }

  const { tipo } = await params;
  const { searchParams } = request.nextUrl;
  const contexto = await contextoDe(usuario);

  try {
    let buffer: Buffer;
    let nombreArchivo: string;

    if (tipo === "606") {
      const hoy = new Date();
      const anio = parseInt(searchParams.get("anio") ?? String(hoy.getFullYear()), 10);
      const mes = parseInt(searchParams.get("mes") ?? String(hoy.getMonth() + 1), 10);

      buffer = await exportarFormato606Excel({ anio, mes });
      nombreArchivo = `DGII_606_${anio}_${String(mes).padStart(2, "0")}.xlsx`;

      await registrarLectura(
        contexto,
        "exportar",
        "contabilidad.factura_proveedor",
        undefined,
        `Exportación reporte DGII 606 de ${anio}-${mes}`,
      );
    } else if (tipo === "607") {
      const hoy = new Date();
      const anio = parseInt(searchParams.get("anio") ?? String(hoy.getFullYear()), 10);
      const mes = parseInt(searchParams.get("mes") ?? String(hoy.getMonth() + 1), 10);

      buffer = await exportarFormato607Excel({ anio, mes });
      nombreArchivo = `DGII_607_${anio}_${String(mes).padStart(2, "0")}.xlsx`;

      await registrarLectura(
        contexto,
        "exportar",
        "contabilidad.recibo",
        undefined,
        `Exportación reporte DGII 607 de ${anio}-${mes}`,
      );
    } else if (tipo === "bancos") {
      const cuentaId = searchParams.get("cuentaId");
      if (!cuentaId) {
        return new NextResponse("Falta cuentaId", { status: 400 });
      }

      buffer = await exportarLibroBancoExcel(cuentaId);
      nombreArchivo = `Libro_Banco_${new Date().toISOString().slice(0, 10)}.xlsx`;

      await registrarLectura(
        contexto,
        "exportar",
        "contabilidad.movimiento_bancario",
        cuentaId,
        `Exportación libro de banco`,
      );
    } else if (tipo === "cxp") {
      buffer = await exportarCxpExcel();
      nombreArchivo = `Cuentas_Por_Pagar_${new Date().toISOString().slice(0, 10)}.xlsx`;

      await registrarLectura(
        contexto,
        "exportar",
        "contabilidad.cuenta_por_pagar",
        undefined,
        `Exportación cuentas por pagar y antigüedad`,
      );
    } else {
      return new NextResponse("Tipo de exportación no soportado", { status: 400 });
    }

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
      },
    });
  } catch (error) {
    console.error(`[exportar-excel] error en exportación de ${tipo}:`, error);
    return new NextResponse("Error al generar el archivo Excel", { status: 500 });
  }
}
