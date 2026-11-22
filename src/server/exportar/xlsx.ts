import ExcelJS from "exceljs";

import { texto, type Celda, type Documento } from "./documento";

/**
 * Excel de un `Documento`. Cada tabla es una hoja con su encabezado en la FILA 1 (para filtrar
 * y ordenar sin limpiar nada); los datos sueltos, secciones y párrafos van juntos en la hoja
 * «Datos». Los números se guardan como número, no como texto.
 */

const nombreHoja = (n: string, usados: Set<string>): string => {
  const base = n.replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 28) || "Hoja";
  let nombre = base;
  let i = 2;

  while (usados.has(nombre.toLowerCase())) nombre = `${base.slice(0, 25)} ${i++}`;
  usados.add(nombre.toLowerCase());

  return nombre;
};

const valor = (c: Celda): string | number | null => (typeof c === "number" ? c : c === null || c === undefined || c === "" ? null : String(c));

const anchoDe = (valores: readonly string[]) => Math.min(60, Math.max(10, ...valores.map((v) => v.length + 2)));

export async function documentoAXlsx(doc: Documento): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();

  libro.creator = "Fundación Global Effect";
  libro.title = doc.titulo;

  const usados = new Set<string>();
  const datos = doc.bloques.filter((b) => b.tipo !== "tabla");
  const tablas = doc.bloques.filter((b): b is Extract<(typeof doc.bloques)[number], { tipo: "tabla" }> => b.tipo === "tabla");

  if (datos.length > 0) {
    const hoja = libro.addWorksheet(nombreHoja(tablas.length === 0 ? doc.titulo : "Datos", usados));

    hoja.columns = [{ width: 34 }, { width: 70 }];
    hoja.addRow([doc.titulo]).font = { bold: true, size: 14 };
    if (doc.subtitulo) hoja.addRow([doc.subtitulo]).font = { color: { argb: "FF667075" } };
    hoja.addRow([]);

    for (const b of datos) {
      if (b.tipo === "seccion") {
        hoja.addRow([]);
        const f = hoja.addRow([b.titulo]);

        f.font = { bold: true, color: { argb: "FF2096BA" }, size: 12 };
      } else if (b.tipo === "datos") {
        for (const [e, v] of b.filas) {
          const f = hoja.addRow([e, valor(v)]);

          f.getCell(1).font = { color: { argb: "FF667075" } };
          f.getCell(2).alignment = { wrapText: true, vertical: "top" };
        }
      } else if (b.tipo === "parrafo") {
        const f = hoja.addRow([b.texto]);

        hoja.mergeCells(f.number, 1, f.number, 2);
        f.getCell(1).alignment = { wrapText: true, vertical: "top" };
      }
    }
  }

  for (const t of tablas) {
    const hoja = libro.addWorksheet(nombreHoja(t.nombreHoja ?? doc.titulo, usados));
    const encabezado = hoja.addRow([...t.columnas]);

    encabezado.font = { bold: true };
    encabezado.eachCell((c) => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDF5F9" } };
      c.border = { bottom: { style: "thin", color: { argb: "FFD9DEE2" } } };
    });

    for (const f of t.filas) hoja.addRow(t.columnas.map((_, k) => valor(f[k])));

    hoja.columns = t.columnas.map((col, k) => ({ width: anchoDe([col, ...t.filas.slice(0, 200).map((f) => texto(f[k]))]) }));
    hoja.views = [{ state: "frozen", ySplit: 1 }];
    if (t.filas.length > 0) hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: t.columnas.length } };
    t.alinear?.forEach((a, k) => {
      if (a !== "l") hoja.getColumn(k + 1).alignment = { horizontal: a === "r" ? "right" : "center" };
    });
  }

  return Buffer.from(await libro.xlsx.writeBuffer());
}
