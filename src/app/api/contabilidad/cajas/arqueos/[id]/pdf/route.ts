import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import sharp from "sharp";

import { redondear } from "@/lib/contabilidad/cajas";
import { esUuid, formatearMonto } from "@/lib/contabilidad/formato";
import { obtenerDatosActaArqueo } from "@/server/contabilidad/cajas/consultas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Normaliza caracteres a WinAnsi para evitar errores de codificación en pdf-lib
 * (por ejemplo el signo menos tipográfico U+2212 devuelto por formatearMonto).
 */
function seguroPdf(texto: string): string {
  return texto
    .replace(/\u2212/g, "-")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u00A0/g, " ")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
}

function formatearFechaDdMmYyyy(iso: string): string {
  const partes = iso.split("-");
  if (partes.length !== 3) return iso;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function formatearFechaHoraRd(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  return new Intl.DateTimeFormat("es-DO", {
    timeZone: "America/Santo_Domingo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(fecha);
}

function dividirLineas(texto: string, fuente: PDFFont, tamano: number, anchoMax: number): string[] {
  const limpio = seguroPdf(texto).replace(/\r\n/g, "\n").trim();
  if (!limpio) return [];
  const parrafos = limpio.split("\n");
  const resultado: string[] = [];

  for (const parrafo of parrafos) {
    const palabras = parrafo.trim().split(/\s+/).filter(Boolean);
    if (palabras.length === 0) {
      resultado.push("");
      continue;
    }
    let lineaActual = palabras[0];
    for (let i = 1; i < palabras.length; i++) {
      const candidata = `${lineaActual} ${palabras[i]}`;
      if (fuente.widthOfTextAtSize(candidata, tamano) <= anchoMax) {
        lineaActual = candidata;
      } else {
        resultado.push(lineaActual);
        lineaActual = palabras[i];
      }
    }
    resultado.push(lineaActual);
  }
  return resultado;
}

async function cargarLogoPng(): Promise<Uint8Array | null> {
  const raiz = process.cwd();
  try {
    const webp = await readFile(path.join(raiz, "public", "logo.webp"));
    const png = await sharp(webp).png().toBuffer();
    return new Uint8Array(png);
  } catch {
    try {
      const icono = await readFile(path.join(raiz, "public", "icon-192.png"));
      return new Uint8Array(icono);
    } catch {
      return null;
    }
  }
}

function textoDerecha(
  pagina: PDFPage,
  texto: string,
  xDerecha: number,
  y: number,
  fuente: PDFFont,
  tamano: number,
  color: ReturnType<typeof rgb>,
) {
  const s = seguroPdf(texto);
  const ancho = fuente.widthOfTextAtSize(s, tamano);
  pagina.drawText(s, { x: xDerecha - ancho, y, size: tamano, font: fuente, color });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!esUuid(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  let acta;
  try {
    acta = await obtenerDatosActaArqueo(id);
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }
  if (!acta) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const pdf = await PDFDocument.create();
  pdf.setTitle(`Acta de Arqueo de Caja Chica AR-${acta.numero}`);
  pdf.setAuthor("Fundacion Global Effect");
  pdf.setSubject(`Arqueo AR-${acta.numero} - ${acta.cajaNombre}`);

  const pagina = pdf.addPage([612, 792]); // Tamaño Carta (8.5 × 11 in)
  const { width, height } = pagina.getSize();
  const margen = 42;
  const anchoUtil = width - margen * 2;

  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // Paleta corporativa Global Effect
  const colorMarca = rgb(0.082, 0.435, 0.549); // #156F8C / marca-700
  const colorMarcaSuave = rgb(0.933, 0.973, 0.984); // #EEF8FB
  const colorTinta = rgb(0.078, 0.098, 0.122); // #14191F
  const colorGris = rgb(0.32, 0.37, 0.43);
  const colorGrisClaro = rgb(0.55, 0.6, 0.65);
  const colorLinea = rgb(0.84, 0.87, 0.9);
  const colorFondoSuave = rgb(0.965, 0.973, 0.98);
  const colorExito = rgb(0.082, 0.502, 0.239); // #15803D
  const colorPeligro = rgb(0.725, 0.11, 0.11); // #B91C1C
  const colorAlerta = rgb(0.706, 0.325, 0.035); // #B45309
  const colorBlanco = rgb(1, 1, 1);

  const m = (n: number) => seguroPdf(formatearMonto(n.toFixed(2), acta.cajaMoneda));
  const saldoSistema = redondear(Number(acta.saldoSistema) || 0);
  const saldoContado = redondear(Number(acta.saldoContado) || 0);
  const diferencia = redondear(Number(acta.diferencia) || 0);

  // Barra superior de marca
  pagina.drawRectangle({ x: 0, y: height - 8, width, height: 8, color: colorMarca });

  let y = height - 34;

  // Encabezado: logo + institución a la izquierda, folio y fecha a la derecha
  const logoBytes = await cargarLogoPng();
  let xTitulo = margen;
  if (logoBytes) {
    try {
      const logoImg = await pdf.embedPng(logoBytes);
      const escala = 34 / logoImg.height;
      const logoW = Math.min(130, logoImg.width * escala);
      const logoH = (logoW / logoImg.width) * logoImg.height;
      pagina.drawImage(logoImg, {
        x: margen,
        y: y - logoH + 6,
        width: logoW,
        height: logoH,
      });
      xTitulo = margen + logoW + 12;
    } catch {
      xTitulo = margen;
    }
  }

  pagina.drawText(seguroPdf("FUNDACION GLOBAL EFFECT"), {
    x: xTitulo,
    y: y - 4,
    size: 9,
    font: fontBold,
    color: colorMarca,
  });
  pagina.drawText(seguroPdf("ACTA DE ARQUEO DE CAJA CHICA"), {
    x: xTitulo,
    y: y - 20,
    size: 13.5,
    font: fontBold,
    color: colorTinta,
  });

  const codigoArqueo = `AR-${acta.numero}`;
  textoDerecha(pagina, `Folio: ${codigoArqueo}`, width - margen, y - 4, fontBold, 10, colorMarca);
  textoDerecha(
    pagina,
    `Fecha arqueo: ${formatearFechaDdMmYyyy(acta.fecha)}`,
    width - margen,
    y - 16,
    fontRegular,
    8.5,
    colorGris,
  );
  textoDerecha(
    pagina,
    `Cierre: ${formatearFechaHoraRd(acta.creadoEn)}`,
    width - margen,
    y - 27,
    fontRegular,
    8,
    colorGrisClaro,
  );

  y -= 42;
  pagina.drawLine({
    start: { x: margen, y },
    end: { x: width - margen, y },
    thickness: 1,
    color: colorLinea,
  });

  // Banda de identificación de la caja
  y -= 16;
  const cuentaTxt = acta.cuentaContableCodigo
    ? `${acta.cuentaContableCodigo}${acta.cuentaContableNombre ? ` · ${acta.cuentaContableNombre}` : ""}`
    : "—";
  pagina.drawText(seguroPdf(`Caja: ${acta.cajaNombre} (${acta.cajaCodigo})`), {
    x: margen,
    y,
    size: 9.5,
    font: fontBold,
    color: colorTinta,
  });
  textoDerecha(
    pagina,
    `Cuenta contable: ${cuentaTxt}`,
    width - margen,
    y,
    fontRegular,
    8.5,
    colorGris,
  );
  y -= 13;
  pagina.drawText(seguroPdf(`Responsable: ${acta.responsableNombre}`), {
    x: margen,
    y,
    size: 8.5,
    font: fontRegular,
    color: colorGris,
  });
  textoDerecha(
    pagina,
    `Realizado por: ${acta.creadoPorNombre}`,
    width - margen,
    y,
    fontRegular,
    8.5,
    colorGris,
  );

  // Bloque 2: Resumen del cuadre (4 celdas horizontales)
  y -= 16;
  const altoResumen = 46;
  pagina.drawRectangle({
    x: margen,
    y: y - altoResumen,
    width: anchoUtil,
    height: altoResumen,
    color: colorFondoSuave,
    borderColor: colorLinea,
    borderWidth: 0.8,
  });

  const colW = anchoUtil / 4;
  for (let i = 1; i < 4; i++) {
    pagina.drawLine({
      start: { x: margen + colW * i, y },
      end: { x: margen + colW * i, y: y - altoResumen },
      thickness: 0.6,
      color: colorLinea,
    });
  }

  const etiquetaDif =
    diferencia === 0
      ? `Cuadrado (${m(0)})`
      : diferencia < 0
        ? `Faltante: -${m(Math.abs(diferencia))}`
        : `Sobrante: +${m(diferencia)}`;
  const colorDif =
    diferencia === 0 ? colorExito : diferencia < 0 ? colorPeligro : colorAlerta;

  const estadoTexto =
    acta.estado === "aprobado"
      ? "Aprobado"
      : acta.estado === "cerrado"
        ? "Cerrado (firmado)"
        : "Abierto";

  const celdasResumen = [
    { label: "SALDO SEGUN SISTEMA", valor: m(saldoSistema), color: colorTinta },
    { label: "SALDO FISICO CONTADO", valor: m(saldoContado), color: colorMarca },
    { label: "DIFERENCIA", valor: etiquetaDif, color: colorDif },
    { label: "ESTADO DEL ARQUEO", valor: estadoTexto, color: colorTinta },
  ];

  celdasResumen.forEach((celda, idx) => {
    const cx = margen + idx * colW + 10;
    pagina.drawText(seguroPdf(celda.label), {
      x: cx,
      y: y - 15,
      size: 7,
      font: fontBold,
      color: colorGrisClaro,
    });
    const tamValor = celda.valor.length > 18 ? 9 : 10.5;
    pagina.drawText(seguroPdf(celda.valor), {
      x: cx,
      y: y - 32,
      size: tamValor,
      font: fontBold,
      color: celda.color,
    });
  });

  // Bloque 3: Tabla de desglose auditado
  y -= altoResumen + 20;
  pagina.drawText(seguroPdf("DETALLE DE DESGLOSE AUDITADO POR DENOMINACION"), {
    x: margen,
    y,
    size: 9,
    font: fontBold,
    color: colorMarca,
  });

  y -= 10;
  const cols = [
    { titulo: "Denominacion", x: margen, ancho: 138, alinear: "izq" as const },
    { titulo: "Cant. Esp.", x: margen + 138, ancho: 64, alinear: "der" as const },
    { titulo: "Subtotal Esp.", x: margen + 202, ancho: 94, alinear: "der" as const },
    { titulo: "Cant. Fis.", x: margen + 296, ancho: 64, alinear: "der" as const },
    { titulo: "Subtotal Fis.", x: margen + 360, ancho: 96, alinear: "der" as const },
    { titulo: "Diferencia", x: margen + 456, ancho: anchoUtil - 456, alinear: "der" as const },
  ];

  const altoEnc = 22;
  pagina.drawRectangle({
    x: margen,
    y: y - altoEnc,
    width: anchoUtil,
    height: altoEnc,
    color: colorMarca,
  });

  for (const col of cols) {
    if (col.alinear === "izq") {
      pagina.drawText(seguroPdf(col.titulo), {
        x: col.x + 8,
        y: y - 14.5,
        size: 8,
        font: fontBold,
        color: colorBlanco,
      });
    } else {
      textoDerecha(pagina, col.titulo, col.x + col.ancho - 6, y - 14.5, fontBold, 8, colorBlanco);
    }
  }

  y -= altoEnc;
  const altoFila = 20;
  let totalCantEsp = 0;
  let totalSubEsp = 0;
  let totalCantFis = 0;
  let totalSubFis = 0;

  acta.denominaciones.forEach((d, idx) => {
    totalCantEsp += d.cantidadEsperada;
    totalSubEsp = redondear(totalSubEsp + d.subtotalEsperado);
    totalCantFis += d.cantidad;
    totalSubFis = redondear(totalSubFis + d.subtotal);
    const difCant = d.cantidad - d.cantidadEsperada;

    if (idx % 2 === 1) {
      pagina.drawRectangle({
        x: margen,
        y: y - altoFila,
        width: anchoUtil,
        height: altoFila,
        color: colorFondoSuave,
      });
    }

    const tipoLbl = d.tipo === "billete" ? "Billete" : "Moneda";
    const textoY = y - 13.5;

    pagina.drawText(seguroPdf(`${m(d.denominacion)}  (${tipoLbl})`), {
      x: cols[0].x + 8,
      y: textoY,
      size: 8.5,
      font: fontRegular,
      color: colorTinta,
    });
    textoDerecha(
      pagina,
      String(d.cantidadEsperada),
      cols[1].x + cols[1].ancho - 6,
      textoY,
      fontRegular,
      8.5,
      colorGris,
    );
    textoDerecha(
      pagina,
      m(d.subtotalEsperado),
      cols[2].x + cols[2].ancho - 6,
      textoY,
      fontRegular,
      8.5,
      colorGris,
    );
    textoDerecha(
      pagina,
      String(d.cantidad),
      cols[3].x + cols[3].ancho - 6,
      textoY,
      fontBold,
      8.5,
      colorTinta,
    );
    textoDerecha(
      pagina,
      m(d.subtotal),
      cols[4].x + cols[4].ancho - 6,
      textoY,
      fontBold,
      8.5,
      colorTinta,
    );
    const difTexto = difCant === 0 ? "0" : difCant > 0 ? `+${difCant}` : String(difCant);
    const difColor =
      difCant === 0 ? colorGrisClaro : difCant < 0 ? colorPeligro : colorAlerta;
    textoDerecha(
      pagina,
      difTexto,
      cols[5].x + cols[5].ancho - 6,
      textoY,
      difCant === 0 ? fontRegular : fontBold,
      8.5,
      difColor,
    );

    pagina.drawLine({
      start: { x: margen, y: y - altoFila },
      end: { x: width - margen, y: y - altoFila },
      thickness: 0.4,
      color: colorLinea,
    });

    y -= altoFila;
  });

  // Fila de totales de la tabla
  const altoTotal = 24;
  pagina.drawRectangle({
    x: margen,
    y: y - altoTotal,
    width: anchoUtil,
    height: altoTotal,
    color: colorMarcaSuave,
    borderColor: colorLinea,
    borderWidth: 0.8,
  });

  const yTotalTexto = y - 15.5;
  pagina.drawText(seguroPdf("TOTALES"), {
    x: cols[0].x + 8,
    y: yTotalTexto,
    size: 8.5,
    font: fontBold,
    color: colorTinta,
  });
  textoDerecha(
    pagina,
    String(totalCantEsp),
    cols[1].x + cols[1].ancho - 6,
    yTotalTexto,
    fontBold,
    8.5,
    colorGris,
  );
  textoDerecha(
    pagina,
    m(totalSubEsp),
    cols[2].x + cols[2].ancho - 6,
    yTotalTexto,
    fontBold,
    8.5,
    colorTinta,
  );
  textoDerecha(
    pagina,
    String(totalCantFis),
    cols[3].x + cols[3].ancho - 6,
    yTotalTexto,
    fontBold,
    8.5,
    colorMarca,
  );
  textoDerecha(
    pagina,
    m(totalSubFis),
    cols[4].x + cols[4].ancho - 6,
    yTotalTexto,
    fontBold,
    8.5,
    colorMarca,
  );
  const difTotalTxt =
    diferencia === 0
      ? m(0)
      : diferencia > 0
        ? `+${m(diferencia)}`
        : `-${m(Math.abs(diferencia))}`;
  textoDerecha(
    pagina,
    difTotalTxt,
    cols[5].x + cols[5].ancho - 6,
    yTotalTexto,
    fontBold,
    8.5,
    colorDif,
  );

  // Borde exterior de la tabla
  const alturaTabla = altoEnc + acta.denominaciones.length * altoFila + altoTotal;
  pagina.drawRectangle({
    x: margen,
    y: y - altoTotal,
    width: anchoUtil,
    height: alturaTabla,
    borderColor: colorLinea,
    borderWidth: 0.8,
  });

  // Bloque 4: Justificación / Observaciones
  y -= altoTotal + 22;
  pagina.drawText(seguroPdf("JUSTIFICACION / OBSERVACIONES"), {
    x: margen,
    y,
    size: 9,
    font: fontBold,
    color: colorMarca,
  });

  const textoObs =
    acta.justificacion?.trim() ||
    (diferencia === 0
      ? "Sin novedades. El efectivo fisico coincide con el saldo del sistema."
      : "Sin observaciones adicionales.");

  const lineasObs = dividirLineas(textoObs, fontRegular, 9, anchoUtil - 20).slice(0, 5);
  const altoObs = Math.max(40, lineasObs.length * 13 + 18);
  y -= 8;
  pagina.drawRectangle({
    x: margen,
    y: y - altoObs,
    width: anchoUtil,
    height: altoObs,
    color: colorFondoSuave,
    borderColor: colorLinea,
    borderWidth: 0.8,
  });

  lineasObs.forEach((linea, idx) => {
    pagina.drawText(linea, {
      x: margen + 10,
      y: y - 16 - idx * 13,
      size: 9,
      font: fontRegular,
      color: colorTinta,
    });
  });

  // Bloque 5: Firmas formales al pie del documento
  const yFirmaLinea = 104;
  const anchoFirma = (anchoUtil - 48) / 2;
  const xIzq = margen;
  const xDer = margen + anchoFirma + 48;

  // Firma izquierda: Responsable de Caja Chica
  pagina.drawLine({
    start: { x: xIzq, y: yFirmaLinea },
    end: { x: xIzq + anchoFirma, y: yFirmaLinea },
    thickness: 0.9,
    color: colorTinta,
  });
  pagina.drawText(seguroPdf(acta.responsableNombre), {
    x: xIzq,
    y: yFirmaLinea - 14,
    size: 9.5,
    font: fontBold,
    color: colorTinta,
  });
  pagina.drawText(seguroPdf("Responsable de Caja Chica"), {
    x: xIzq,
    y: yFirmaLinea - 26,
    size: 8.5,
    font: fontRegular,
    color: colorGris,
  });

  // Firma derecha: Supervisor / Realizado por
  pagina.drawLine({
    start: { x: xDer, y: yFirmaLinea },
    end: { x: xDer + anchoFirma, y: yFirmaLinea },
    thickness: 0.9,
    color: colorTinta,
  });
  pagina.drawText(seguroPdf(acta.creadoPorNombre), {
    x: xDer,
    y: yFirmaLinea - 14,
    size: 9.5,
    font: fontBold,
    color: colorTinta,
  });
  pagina.drawText(seguroPdf("Supervisor / Realizado por"), {
    x: xDer,
    y: yFirmaLinea - 26,
    size: 8.5,
    font: fontRegular,
    color: colorGris,
  });

  // Pie de página discreto
  pagina.drawLine({
    start: { x: margen, y: 46 },
    end: { x: width - margen, y: 46 },
    thickness: 0.5,
    color: colorLinea,
  });
  pagina.drawText(seguroPdf("Portal GlobalEffect · Fundacion Global Effect (La Vega, RD)"), {
    x: margen,
    y: 33,
    size: 7.5,
    font: fontRegular,
    color: colorGrisClaro,
  });
  textoDerecha(
    pagina,
    `Documento ${codigoArqueo} · Pagina 1 de 1`,
    width - margen,
    33,
    fontRegular,
    7.5,
    colorGrisClaro,
  );

  const bytes = await pdf.save();
  const url = new URL(request.url);
  const descargar = url.searchParams.get("download") === "1";

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${descargar ? "attachment" : "inline"}; filename="acta-arqueo-${codigoArqueo}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
