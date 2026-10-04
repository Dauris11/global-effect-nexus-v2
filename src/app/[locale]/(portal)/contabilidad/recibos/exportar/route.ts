import { requerirPermiso } from "@/lib/auth";
import { numeroDocumento, SERIE_RECIBO } from "@/lib/contabilidad/formato";
import { registrarLectura } from "@/server/contabilidad/bitacora";
import { leerFiltroRecibos, recibosParaExportar } from "@/server/contabilidad/recibos/consultas";
import { contextoDe } from "@/server/contabilidad/sesion";

/**
 * Exportación CSV de la consulta de recibos, con el mismo filtro de la URL.
 *
 * CSV y no Excel en esta fase: lo abre cualquier hoja de cálculo y no exige
 * una dependencia. Los reportes con Excel y PDF son la Fase 7. Los montos
 * salen tal como los da la base (punto decimal, sin separador de miles),
 * para que la hoja los lea como números y no como texto.
 *
 * Toda exportación queda en la bitácora con el filtro usado (§3.6).
 */
export async function GET(request: Request) {
  const usuario = await requerirPermiso("contabilidad.leer");
  const parametros = Object.fromEntries(new URL(request.url).searchParams);
  const filtro = leerFiltroRecibos(parametros);
  const filas = await recibosParaExportar(filtro);

  await registrarLectura(
    await contextoDe(usuario),
    "exportar",
    "recibo",
    undefined,
    `Exportación CSV de recibos (${filas.length} filas). Filtro: ${JSON.stringify(filtro)}`,
  );

  const cabecera = [
    "numero", "tipo", "fecha", "estado", "cuenta", "moneda", "monto", "monto_dop", "concepto",
    "categoria", "fondo", "proyecto", "tercero", "forma_pago", "referencia", "creado_por", "contabilizado_por",
  ];
  const lineas = filas.map((f) =>
    [
      numeroDocumento(SERIE_RECIBO[f.tipo], f.numero), f.tipo, f.fecha, f.estado, f.cuenta, f.moneda,
      f.monto, f.monto_dop, f.concepto, f.categoria, f.fondo, f.proyecto, f.tercero, f.forma_pago,
      f.referencia, f.creado_por, f.aprobado_por,
    ]
      .map(celda)
      .join(","),
  );

  // BOM para que Excel abra las tildes en UTF-8 y no en Windows-1252.
  const cuerpo = `﻿${[cabecera.join(","), ...lineas].join("\r\n")}\r\n`;
  const hoy = new Date().toISOString().slice(0, 10);

  return new Response(cuerpo, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="recibos-${hoy}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Comillas cuando hace falta, y un apóstrofo delante de lo que empiece por
 * = + - @: sin él, una hoja de cálculo ejecuta como fórmula un concepto
 * escrito con mala intención (inyección CSV). Los montos negativos no
 * pasan por aquí con signo: en la base son siempre positivos.
 */
function celda(valor: string | null): string {
  if (valor === null) return "";
  const seguro = /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
  return /[",\r\n]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}
