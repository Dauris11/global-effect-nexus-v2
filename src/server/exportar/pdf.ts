import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from "pdf-lib";

import { logoPng } from "./logo";
import { texto, type Documento } from "./documento";

/**
 * PDF de un `Documento`, dibujado a mano con pdf-lib (sin navegador ni librerías nativas, así
 * funciona igual en el servidor de producción). Carta, márgenes de 40 pt, logo y fecha arriba de
 * cada hoja, «Página n de m» abajo, tablas con el encabezado repetido al cambiar de hoja.
 * Usa Helvetica: los caracteres que no tiene se cambian por «?» en vez de romper el archivo.
 */

const TINTA = rgb(0.09, 0.1, 0.11);
const GRIS = rgb(0.4, 0.43, 0.46);
const LINEA = rgb(0.85, 0.87, 0.89);
const MARCA = rgb(0.125, 0.588, 0.729);
const MARGEN = 40;

type Ctx = {
  pdf: PDFDocument;
  normal: PDFFont;
  negrita: PDFFont;
  logo: Awaited<ReturnType<PDFDocument["embedPng"]>> | null;
  ancho: number;
  alto: number;
  pagina: PDFPage;
  y: number;
  fecha: string;
};

const seguro = (f: PDFFont, s: string): string => {
  const permitidos = new Set(f.getCharacterSet());

  return [...s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/ /g, " ")]
    .map((c) => (c === "\n" || permitidos.has(c.codePointAt(0) ?? 0) ? c : "?"))
    .join("");
};

/** Parte un texto en líneas que quepan en `ancho`; respeta los saltos de línea y corta las palabras enormes. */
function envolver(f: PDFFont, s: string, tamano: number, ancho: number): string[] {
  const salida: string[] = [];

  for (const parrafo of seguro(f, s).split("\n")) {
    let linea = "";

    for (const palabra of parrafo.split(/\s+/).filter(Boolean)) {
      let p = palabra;

      while (f.widthOfTextAtSize(p, tamano) > ancho) {
        let corte = p.length - 1;

        while (corte > 1 && f.widthOfTextAtSize(p.slice(0, corte), tamano) > ancho) corte--;
        if (linea) {
          salida.push(linea);
          linea = "";
        }
        salida.push(p.slice(0, corte));
        p = p.slice(corte);
      }

      const prueba = linea ? `${linea} ${p}` : p;

      if (f.widthOfTextAtSize(prueba, tamano) <= ancho) linea = prueba;
      else {
        salida.push(linea);
        linea = p;
      }
    }

    salida.push(linea);
  }

  return salida.length ? salida : [""];
}

function nuevaPagina(c: Ctx): void {
  c.pagina = c.pdf.addPage([c.ancho, c.alto]);
  c.y = c.alto - MARGEN;

  if (c.logo) {
    const h = 26;
    const w = (c.logo.width / c.logo.height) * h;

    c.pagina.drawImage(c.logo, { x: MARGEN, y: c.y - h, width: w, height: h });
  }

  c.pagina.drawText(seguro(c.normal, c.fecha), { x: c.ancho - MARGEN - c.normal.widthOfTextAtSize(seguro(c.normal, c.fecha), 8), y: c.y - 14, size: 8, font: c.normal, color: GRIS });
  c.y -= 40;
  c.pagina.drawLine({ start: { x: MARGEN, y: c.y }, end: { x: c.ancho - MARGEN, y: c.y }, thickness: 0.5, color: LINEA });
  c.y -= 18;
}

/** Asegura `alto` puntos libres; si no caben, abre otra hoja. */
function espacio(c: Ctx, alto: number): void {
  if (c.y - alto < MARGEN + 24) nuevaPagina(c);
}

function dibujarLineas(c: Ctx, lineas: string[], x: number, tamano: number, fuente: PDFFont, color = TINTA, interlinea = 1.3): void {
  for (const l of lineas) {
    c.pagina.drawText(l, { x, y: c.y - tamano, size: tamano, font: fuente, color });
    c.y -= tamano * interlinea;
  }
}

export async function documentoAPdf(doc: Documento, fechaTexto: string): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const [normal, negrita, logoBytes] = await Promise.all([pdf.embedFont(StandardFonts.Helvetica), pdf.embedFont(StandardFonts.HelveticaBold), logoPng()]);
  const [ancho, alto] = doc.horizontal ? [792, 612] : [612, 792];
  const c: Ctx = { pdf, normal, negrita, logo: logoBytes ? await pdf.embedPng(logoBytes) : null, ancho, alto, pagina: undefined as unknown as PDFPage, y: 0, fecha: fechaTexto };
  const util = ancho - MARGEN * 2;

  pdf.setTitle(seguro(normal, doc.titulo));
  pdf.setAuthor("Fundación Global Effect");
  nuevaPagina(c);

  // Título, subtítulo y, si hay, la foto a la derecha.
  const foto = doc.foto ? await pdf.embedJpg(doc.foto) : null;
  const anchoFoto = foto ? 84 : 0;
  const altoFoto = foto ? Math.min(108, (foto.height / foto.width) * anchoFoto) : 0;
  const yInicio = c.y;

  if (foto) c.pagina.drawImage(foto, { x: ancho - MARGEN - anchoFoto, y: c.y - altoFoto, width: anchoFoto, height: altoFoto });

  dibujarLineas(c, envolver(negrita, doc.titulo, 18, util - anchoFoto - (foto ? 12 : 0)), MARGEN, 18, negrita, TINTA, 1.25);

  if (doc.subtitulo) {
    c.y -= 2;
    dibujarLineas(c, envolver(normal, doc.subtitulo, 10, util - anchoFoto - (foto ? 12 : 0)), MARGEN, 10, normal, GRIS);
  }

  if (foto) c.y = Math.min(c.y, yInicio - altoFoto);
  c.y -= 14;

  for (const b of doc.bloques) {
    if (b.tipo === "seccion") {
      espacio(c, 40);
      c.y -= 6;
      dibujarLineas(c, [seguro(negrita, b.titulo)], MARGEN, 12, negrita, MARCA);
      c.pagina.drawLine({ start: { x: MARGEN, y: c.y + 2 }, end: { x: ancho - MARGEN, y: c.y + 2 }, thickness: 0.5, color: LINEA });
      c.y -= 8;
    } else if (b.tipo === "parrafo") {
      const lineas = envolver(normal, b.texto, 10, util);

      for (let i = 0; i < lineas.length; i += 40) {
        espacio(c, 30);
        dibujarLineas(c, lineas.slice(i, i + 40), MARGEN, 10, normal);
      }
      c.y -= 6;
    } else if (b.tipo === "datos") {
      const colAncho = (util - 20) / 2;
      let i = 0;

      const celda = (etiqueta: string, valor: string, w: number) => ({ etiqueta: envolver(normal, etiqueta, 8, w), valor: envolver(normal, valor || "—", 10, w) });

      while (i < b.filas.length) {
        const [e1, v1] = b.filas[i];
        const t1 = texto(v1);
        const largo1 = t1.length > 70 || t1.includes("\n");
        const siguiente = b.filas[i + 1];
        const largo2 = siguiente ? texto(siguiente[1]).length > 70 || texto(siguiente[1]).includes("\n") : false;

        if (largo1 || !siguiente || largo2) {
          const a = celda(e1, t1, util);

          espacio(c, 14 + a.etiqueta.length * 10);
          dibujarLineas(c, a.etiqueta, MARGEN, 8, normal, GRIS, 1.2);
          // Un valor muy largo se parte entre hojas en lugar de dejar un hueco enorme.
          for (let k = 0; k < a.valor.length; k += 45) {
            espacio(c, 16);
            dibujarLineas(c, a.valor.slice(k, k + 45), MARGEN, 10, normal);
          }
          c.y -= 6;
          i += 1;
        } else {
          const a = celda(e1, t1, colAncho);
          const b2 = celda(siguiente[0], texto(siguiente[1]), colAncho);
          const alturaFila = Math.max(a.etiqueta.length * 9.6 + a.valor.length * 13, b2.etiqueta.length * 9.6 + b2.valor.length * 13) + 6;

          espacio(c, alturaFila);

          const yFila = c.y;

          dibujarLineas(c, a.etiqueta, MARGEN, 8, normal, GRIS, 1.2);
          dibujarLineas(c, a.valor, MARGEN, 10, normal);
          c.y = yFila;
          dibujarLineas(c, b2.etiqueta, MARGEN + colAncho + 20, 8, normal, GRIS, 1.2);
          dibujarLineas(c, b2.valor, MARGEN + colAncho + 20, 10, normal);
          c.y = yFila - alturaFila;
          i += 2;
        }
      }
    } else {
      const n = b.columnas.length;
      const tamano = n > 8 ? 7.5 : 8.5;
      // Ancho de cada columna: el indicado o proporcional al contenido (con tope y mínimo).
      const pesos = b.anchos ?? b.columnas.map((col, k) => Math.min(40, Math.max(6, col.length, ...b.filas.slice(0, 60).map((f) => texto(f[k]).length))));
      const total = pesos.reduce((a, p) => a + p, 0);
      const anchos = pesos.map((p) => (p / total) * util);
      const pad = 3;
      const alinear = b.alinear ?? [];

      const encabezado = () => pintarFila([...b.columnas], negrita, true);

      // Pinta una fila ya sabiendo que cabe en la hoja actual.
      const pintarFila = (celdas: string[], fuente: PDFFont, fondo = false) => {
        const lineas = celdas.map((t, k) => envolver(fuente, t, tamano, anchos[k] - pad * 2));
        const alturaFila = Math.max(Math.max(...lineas.map((l) => l.length)) * tamano * 1.25 + pad * 2, b.cuadricula && !fondo ? 22 : 0);

        if (fondo) c.pagina.drawRectangle({ x: MARGEN, y: c.y - alturaFila, width: util, height: alturaFila, color: rgb(0.93, 0.96, 0.98) });

        let x = MARGEN;

        lineas.forEach((l, k) => {
          l.forEach((linea, r) => {
            const w = fuente.widthOfTextAtSize(linea, tamano);
            const px = alinear[k] === "r" ? x + anchos[k] - pad - w : alinear[k] === "c" ? x + (anchos[k] - w) / 2 : x + pad;

            c.pagina.drawText(linea, { x: px, y: c.y - pad - tamano - r * tamano * 1.25, size: tamano, font: fuente, color: TINTA });
          });
          x += anchos[k];
        });

        if (b.cuadricula) {
          let xl = MARGEN;

          for (let k = 0; k <= anchos.length; k++) {
            c.pagina.drawLine({ start: { x: xl, y: c.y }, end: { x: xl, y: c.y - alturaFila }, thickness: 0.4, color: LINEA });
            xl += anchos[k] ?? 0;
          }
        }

        c.y -= alturaFila;
        c.pagina.drawLine({ start: { x: MARGEN, y: c.y }, end: { x: ancho - MARGEN, y: c.y }, thickness: 0.4, color: LINEA });
      };

      const alturaDe = (celdas: string[], fuente: PDFFont) =>
        Math.max(Math.max(...celdas.map((t, k) => envolver(fuente, t, tamano, anchos[k] - pad * 2).length)) * tamano * 1.25 + pad * 2, b.cuadricula ? 22 : 0);

      espacio(c, 50);
      encabezado();

      for (const fila of b.filas) {
        const celdas = b.columnas.map((_, k) => texto(fila[k]));

        // Si no cabe, hoja nueva con el encabezado repetido y luego la fila: nunca se duplica.
        if (c.y - alturaDe(celdas, normal) < MARGEN + 24) {
          nuevaPagina(c);
          encabezado();
        }

        pintarFila(celdas, normal);
      }

      if (b.filas.length === 0) dibujarLineas(c, ["Sin registros."], MARGEN, 9, normal, GRIS);
      c.y -= 10;
    }
  }

  // Pie de cada hoja.
  const paginas = pdf.getPages();

  paginas.forEach((p, i) => {
    const pie = seguro(normal, `Fundación Global Effect · ${doc.titulo}`).slice(0, 90);
    const num = `Página ${i + 1} de ${paginas.length}`;

    p.drawText(pie, { x: MARGEN, y: 24, size: 8, font: normal, color: GRIS });
    p.drawText(num, { x: ancho - MARGEN - normal.widthOfTextAtSize(num, 8), y: 24, size: 8, font: normal, color: GRIS });
  });

  return Buffer.from(await pdf.save());
}
