import { NextRequest, NextResponse } from "next/server";
import { obtenerUsuarioActual } from "@/lib/auth";
import { usuarioTienePermiso } from "@/lib/rbac";
import { contextoDe } from "@/server/contabilidad/sesion";
import { registrarLectura } from "@/server/contabilidad/bitacora";
import {
  exportarFormato606Excel,
  exportarFormato607Excel,
  exportarLibroBancoExcel,
  exportarCxpExcel,
} from "@/server/contabilidad/excel/exportaciones";
import {
  exportarBalanzaExcel,
  exportarDiarioExcel,
  exportarMayorExcel,
} from "@/server/contabilidad/excel/libros";
import { leerFiltroLibros } from "@/server/contabilidad/libros/consultas";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tipo: string }> },
) {
  const usuario = await obtenerUsuarioActual();
  // El permiso y no el rol: así las excepciones por usuario (`usuario_permiso`)
  // valen también aquí, igual que en cada pantalla del departamento.
  if (!usuario || !usuarioTienePermiso(usuario, "contabilidad.leer")) {
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
    } else if (tipo === "606-txt" || tipo === "607-txt" || tipo === "608-txt" || tipo === "609-txt") {
      const hoy = new Date();
      const anio = parseInt(searchParams.get("anio") ?? String(hoy.getFullYear()), 10);
      const mes = parseInt(searchParams.get("mes") ?? String(hoy.getMonth() + 1), 10);
      const enCero = searchParams.get("enCero") === "1" || searchParams.get("enCero") === "true";

      const { generarTxt606, generarTxt607, generarTxt608, generarTxt609 } = await import(
        "@/server/contabilidad/dgii/formatos-txt"
      );

      let resultado;
      if (tipo === "606-txt") {
        resultado = await generarTxt606(anio, mes, enCero);
      } else if (tipo === "607-txt") {
        resultado = await generarTxt607(anio, mes, enCero);
      } else if (tipo === "608-txt") {
        resultado = await generarTxt608(anio, mes, enCero);
      } else {
        resultado = await generarTxt609(anio, mes, enCero);
      }

      const nombreTxt = `${tipo.replace("-txt", "")}_${anio}${String(mes).padStart(2, "0")}.txt`;

      await registrarLectura(
        contexto,
        "exportar",
        "contabilidad.declaracion",
        undefined,
        `Exportación TXT DGII ${tipo} de ${anio}-${mes} (en cero: ${resultado.esEnvioEnCero})`
      );

      return new NextResponse(resultado.contenido, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="${nombreTxt}"`,
        },
      });
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
    } else if (tipo === "diario" || tipo === "mayor" || tipo === "balanza") {
      // El mismo lector de filtros que la pantalla: lo descargado es
      // exactamente lo que se estaba viendo.
      const filtro = await leerFiltroLibros(Object.fromEntries(searchParams));
      const rango = filtro.periodo ?? `${filtro.desde}_${filtro.hasta}`;

      if (tipo === "mayor") {
        buffer = await exportarMayorExcel(filtro);
        nombreArchivo = `Libro_Mayor_${rango}.xlsx`;
      } else if (tipo === "diario") {
        buffer = await exportarDiarioExcel(filtro);
        nombreArchivo = `Libro_Diario_${rango}.xlsx`;
      } else {
        buffer = await exportarBalanzaExcel(filtro);
        nombreArchivo = `Balanza_Comprobacion_${rango}.xlsx`;
      }

      await registrarLectura(
        contexto,
        "exportar",
        tipo === "mayor" ? "contabilidad.cuenta_contable" : "contabilidad.asiento",
        undefined,
        `Exportación ${tipo} de ${filtro.desde} a ${filtro.hasta}` +
          (tipo === "mayor" ? ` · cuentas ${filtro.cuentaDesde ?? "inicio"}–${filtro.cuentaHasta ?? "fin"}` : ""),
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
