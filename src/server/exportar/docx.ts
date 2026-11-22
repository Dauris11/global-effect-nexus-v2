import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  ImageRun,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  PageOrientation,
} from "docx";

import { logoPng } from "./logo";
import { texto, type Documento } from "./documento";

const MARCA = "2096BA";
const GRIS = "667075";
const BORDE = { style: BorderStyle.SINGLE, size: 4, color: "D9DEE2" } as const;
const SIN_BORDE = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } as const;

const parrafo = (t: string, opciones: { negrita?: boolean; tamano?: number; color?: string; espacio?: number; alinear?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}) =>
  new Paragraph({
    alignment: opciones.alinear,
    spacing: { after: opciones.espacio ?? 60 },
    children: t.split("\n").flatMap((linea, i) => [new TextRun({ text: linea, bold: opciones.negrita, size: opciones.tamano ?? 20, color: opciones.color, break: i > 0 ? 1 : undefined })]),
  });

/** Word de un `Documento`: logo y fecha en el encabezado, número de página en el pie, tablas con encabezado sombreado. */
export async function documentoADocx(doc: Documento, fechaTexto: string): Promise<Buffer> {
  const logo = await logoPng();
  const anchoUtil = doc.horizontal ? 13000 : 9800; // en veinteavos de punto (dxa)

  const encabezado = new Header({
    children: [
      new Paragraph({
        spacing: { after: 120 },
        children: [
          ...(logo ? [new ImageRun({ type: "png", data: logo, transformation: { width: 96, height: 26 } })] : []),
          new TextRun({ text: `\t${fechaTexto}`, size: 16, color: GRIS }),
        ],
        tabStops: [{ type: "right", position: anchoUtil }],
      }),
    ],
  });

  const pie = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: `Fundación Global Effect · ${doc.titulo} · Página `, size: 16, color: GRIS }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: GRIS }), new TextRun({ text: " de ", size: 16, color: GRIS }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: GRIS })],
      }),
    ],
  });

  const hijos: (Paragraph | Table)[] = [];

  // Título (con la foto a la derecha si la hay): una tabla de dos celdas sin bordes.
  const titulo = [parrafo(doc.titulo, { negrita: true, tamano: 36, espacio: 40 }), ...(doc.subtitulo ? [parrafo(doc.subtitulo, { tamano: 20, color: GRIS, espacio: 120 })] : [])];

  if (doc.foto) {
    hijos.push(
      new Table({
        width: { size: anchoUtil, type: WidthType.DXA },
        columnWidths: [anchoUtil - 1800, 1800],
        borders: { top: SIN_BORDE, bottom: SIN_BORDE, left: SIN_BORDE, right: SIN_BORDE, insideHorizontal: SIN_BORDE, insideVertical: SIN_BORDE },
        rows: [
          new TableRow({
            children: [
              new TableCell({ width: { size: anchoUtil - 1800, type: WidthType.DXA }, children: titulo }),
              new TableCell({ width: { size: 1800, type: WidthType.DXA }, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new ImageRun({ type: "jpg", data: doc.foto, transformation: { width: 84, height: 105 } })] })] }),
            ],
          }),
        ],
      }),
    );
  } else {
    hijos.push(...titulo);
  }

  for (const b of doc.bloques) {
    if (b.tipo === "seccion") {
      hijos.push(
        new Paragraph({
          spacing: { before: 240, after: 100 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "D9DEE2", space: 2 } },
          children: [new TextRun({ text: b.titulo, bold: true, size: 24, color: MARCA })],
        }),
      );
    } else if (b.tipo === "parrafo") {
      hijos.push(parrafo(b.texto));
    } else if (b.tipo === "datos") {
      const mitad = Math.floor(anchoUtil / 2);
      const filas: TableRow[] = [];
      let i = 0;

      const celda = (e: string, v: string, ancho: number, span = 1) =>
        new TableCell({
          columnSpan: span,
          width: { size: ancho, type: WidthType.DXA },
          borders: { top: SIN_BORDE, bottom: SIN_BORDE, left: SIN_BORDE, right: SIN_BORDE },
          margins: { top: 40, bottom: 60, left: 0, right: 120 },
          children: [parrafo(e, { tamano: 16, color: GRIS, espacio: 0 }), parrafo(v || "—", { tamano: 20, espacio: 0 })],
        });
      const largo = (v: string) => v.length > 70 || v.includes("\n");

      while (i < b.filas.length) {
        const [e1, v1] = b.filas[i];
        const sig = b.filas[i + 1];

        if (largo(texto(v1)) || !sig || largo(texto(sig[1]))) {
          filas.push(new TableRow({ children: [celda(e1, texto(v1), anchoUtil, 2)] }));
          i += 1;
        } else {
          filas.push(new TableRow({ children: [celda(e1, texto(v1), mitad), celda(sig[0], texto(sig[1]), mitad)] }));
          i += 2;
        }
      }

      hijos.push(new Table({ width: { size: anchoUtil, type: WidthType.DXA }, columnWidths: [mitad, mitad], rows: filas, borders: { top: SIN_BORDE, bottom: SIN_BORDE, left: SIN_BORDE, right: SIN_BORDE, insideHorizontal: SIN_BORDE, insideVertical: SIN_BORDE } }));
    } else {
      const n = b.columnas.length;
      const pesos = b.anchos ?? b.columnas.map((col, k) => Math.min(40, Math.max(6, col.length, ...b.filas.slice(0, 60).map((f) => texto(f[k]).length))));
      const total = pesos.reduce((a, p) => a + p, 0);
      const anchos = pesos.map((p) => Math.floor((p / total) * anchoUtil));
      const tamano = n > 8 ? 15 : 17;
      const alinear = (k: number) => (b.alinear?.[k] === "r" ? AlignmentType.RIGHT : b.alinear?.[k] === "c" ? AlignmentType.CENTER : AlignmentType.LEFT);
      const celda = (t: string, k: number, encabezado: boolean) =>
        new TableCell({
          width: { size: anchos[k], type: WidthType.DXA },
          borders: { top: BORDE, bottom: BORDE, left: BORDE, right: BORDE },
          shading: encabezado ? { type: ShadingType.CLEAR, fill: "EDF5F9", color: "auto" } : undefined,
          margins: { top: 40, bottom: 40, left: 80, right: 80 },
          children: [new Paragraph({ alignment: alinear(k), children: [new TextRun({ text: t, bold: encabezado, size: tamano })] })],
        });

      hijos.push(
        new Table({
          width: { size: anchoUtil, type: WidthType.DXA },
          columnWidths: anchos,
          rows: [
            new TableRow({ tableHeader: true, children: b.columnas.map((col, k) => celda(col, k, true)) }),
            ...b.filas.map((f) => new TableRow({ cantSplit: true, children: b.columnas.map((_, k) => celda(texto(f[k]), k, false)) })),
          ],
        }),
      );
      if (b.filas.length === 0) hijos.push(parrafo("Sin registros.", { color: GRIS }));
      hijos.push(parrafo("", { espacio: 120 }));
    }
  }

  const documento = new Document({
    creator: "Fundación Global Effect",
    title: doc.titulo,
    sections: [
      {
        properties: { page: { size: { orientation: doc.horizontal ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT }, margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } } },
        headers: { default: encabezado },
        footers: { default: pie },
        children: hijos,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(documento));
}
