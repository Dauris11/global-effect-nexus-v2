/**
 * CSV que Excel abre bien: con BOM (para que las tildes no se rompan), comas como
 * separador y comillas en lo que las necesite. Un valor que empieza con `=`, `+`, `-` o
 * `@` se antepone con una comilla para que una hoja de cálculo no lo ejecute como fórmula.
 */
const celda = (valor: unknown): string => {
  let texto = valor === null || valor === undefined ? "" : String(valor);

  if (/^[=+\-@\t\r]/.test(texto) && !/^-?\d+([.,]\d+)?$/.test(texto)) texto = `'${texto}`;

  return /[",\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
};

export function aCsv(columnas: readonly string[], filas: readonly (readonly unknown[])[]): string {
  const lineas = [columnas, ...filas].map((fila) => fila.map(celda).join(","));

  return `﻿${lineas.join("\r\n")}\r\n`;
}

/** Respuesta HTTP lista para descargar. */
export function respuestaCsv(nombreArchivo: string, contenido: string): Response {
  return new Response(contenido, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nombreArchivo.replace(/[^\w.-]/g, "_")}"`,
      "Cache-Control": "no-store",
    },
  });
}
