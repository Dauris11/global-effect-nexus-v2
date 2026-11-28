import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import sharp from "sharp";

import { esUuid, formatearMonto } from "@/lib/contabilidad/formato";
import { obtenerPasajeParaPdf } from "@/server/contabilidad/pasaje/consultas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIAS_ES: Record<string, string> = {
  lunes: "Lunes",
  martes: "Martes",
  miercoles: "Miércoles",
  jueves: "Jueves",
  viernes: "Viernes",
  sabado: "Sábado",
  domingo: "Domingo",
};

const PERIODOS_ES: Record<string, string> = {
  hoy: "Hoy",
  semana: "Semana",
  personalizado: "Personalizado",
};

/** Normaliza caracteres a WinAnsi para evitar errores de codificación en pdf-lib. */
function seguroPdf(texto: string): string {
  return texto
    .replace(/\u2212/g, "-")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u00A0/g, " ")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
}

function formatearFechaHoraRd(iso: string | null): string {
  if (!iso) return "-";
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

function dividirLineas(
  texto: string,
  fuente: PDFFont,
  tamano: number,
  anchoMax: number,
): string[] {
  const limpio = seguroPdf(texto).replace(/\r\n/g, "\n").trim();
  if (!limpio) return [];
  const resultado: string[] = [];

  for (const parrafo of limpio.split("\n")) {
    const palabras = parrafo.trim().split(/\s+/).filter(Boolean);
    if (palabras.length === 0) {
      resultado.push("");
      continue;
    }
    let linea = palabras[0];
    for (let i = 1; i < palabras.length; i++) {
      const candidata = `${linea} ${palabras[i]}`;
      if (fuente.widthOfTextAtSize(candidata, tamano) <= anchoMax) {
        linea = candidata;
      } else {
        resultado.push(linea);
        linea = palabras[i];
      }
    }
    resultado.push(linea);
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

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!esUuid(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  let pasaje;
  try {
    pasaje = await obtenerPasajeParaPdf(id);
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }
  if (!pasaje) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const pdf = await PDFDocument.create();
  pdf.setTitle(`Comprobante de Entrega de Pasaje #${pasaje.folio}`);
  pdf.setAuthor("Fundacion Global Effect");
  pdf.setSubject(`Entrega de pasaje - Solicitud #${pasaje.folio}`);

  const pagina = pdf.addPage([612, 792]); // Carta (8.5 x 11 in)
  const { width, height } = pagina.getSize();
  const margen = 44;
  const anchoUtil = width - margen * 2;

  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const colorMarca = rgb(0.082, 0.435, 0.549); // #156F8C
  const colorMarcaSuave = rgb(0.933, 0.973, 0.984);
  const colorTinta = rgb(0.078, 0.098, 0.122);
  const colorGris = rgb(0.35, 0.4, 0.45);
  const colorLinea = rgb(0.84, 0.87, 0.9);
  const colorFondoSuave = rgb(0.968, 0.975, 0.982);

  // Barra superior corporativa
  pagina.drawRectangle({ x: 0, y: height - 8, width, height: 8, color: colorMarca });

  let y = height - 40;

  // Logo + encabezado institucional
  const logoBytes = await cargarLogoPng();
  let xTitulo = margen;
  if (logoBytes) {
    try {
      const img = await pdf.embedPng(logoBytes);
      const altoLogo = 38;
      const anchoLogo = (img.width / img.height) * altoLogo;
      pagina.drawImage(img, {
        x: margen,
        y: y - altoLogo + 10,
        width: anchoLogo,
        height: altoLogo,
      });
      xTitulo = margen + anchoLogo + 12;
    } catch {
      // Sin logo si no se pudo incrustar
    }
  }

  pagina.drawText(seguroPdf("FUNDACION GLOBAL EFFECT"), {
    x: xTitulo,
    y: y - 4,
    size: 13,
    font: fontBold,
    color: colorMarca,
  });
  pagina.drawText(seguroPdf("Comprobante de Entrega de Pasaje"), {
    x: xTitulo,
    y: y - 20,
    size: 11,
    font: fontRegular,
    color: colorTinta,
  });

  const folioTexto = seguroPdf(`Solicitud #${pasaje.folio}`);
  const anchoFolio = fontBold.widthOfTextAtSize(folioTexto, 12);
  pagina.drawText(folioTexto, {
    x: width - margen - anchoFolio,
    y: y - 4,
    size: 12,
    font: fontBold,
    color: colorTinta,
  });

  const estadoTexto = seguroPdf(
    pasaje.estado_pasaje === "entregado" ? "Estado: Entregado" : "Estado: Pendiente",
  );
  const anchoEstado = fontRegular.widthOfTextAtSize(estadoTexto, 9.5);
  pagina.drawText(estadoTexto, {
    x: width - margen - anchoEstado,
    y: y - 20,
    size: 9.5,
    font: fontRegular,
    color: colorGris,
  });

  y -= 44;
  pagina.drawLine({
    start: { x: margen, y },
    end: { x: width - margen, y },
    thickness: 1,
    color: colorLinea,
  });

  // Tarjetas de resumen de montos
  y -= 18;
  const gapTarjetas = 14;
  const anchoTarjeta = (anchoUtil - gapTarjetas) / 2;
  const altoTarjeta = 58;

  // Tarjeta 1: Monto a entregar
  pagina.drawRectangle({
    x: margen,
    y: y - altoTarjeta,
    width: anchoTarjeta,
    height: altoTarjeta,
    color: colorFondoSuave,
    borderColor: colorLinea,
    borderWidth: 1,
  });
  pagina.drawText(seguroPdf("MONTO A ENTREGAR (CALCULADO)"), {
    x: margen + 14,
    y: y - 20,
    size: 8.5,
    font: fontBold,
    color: colorGris,
  });
  pagina.drawText(
    seguroPdf(formatearMonto(pasaje.monto_a_entregar.toFixed(2), pasaje.moneda)),
    {
      x: margen + 14,
      y: y - 43,
      size: 16,
      font: fontBold,
      color: colorTinta,
    },
  );

  // Tarjeta 2: Monto entregado
  const xTarjeta2 = margen + anchoTarjeta + gapTarjetas;
  pagina.drawRectangle({
    x: xTarjeta2,
    y: y - altoTarjeta,
    width: anchoTarjeta,
    height: altoTarjeta,
    color: colorMarcaSuave,
    borderColor: colorMarca,
    borderWidth: 1,
  });
  pagina.drawText(seguroPdf("MONTO ENTREGADO"), {
    x: xTarjeta2 + 14,
    y: y - 20,
    size: 8.5,
    font: fontBold,
    color: colorMarca,
  });
  const textoEntregado =
    pasaje.monto_entregado !== null
      ? formatearMonto(pasaje.monto_entregado.toFixed(2), pasaje.moneda)
      : "-";
  pagina.drawText(seguroPdf(textoEntregado), {
    x: xTarjeta2 + 14,
    y: y - 43,
    size: 16,
    font: fontBold,
    color: colorMarca,
  });

  y -= altoTarjeta + 26;

  // Tabla de detalles de la entrega
  pagina.drawText(seguroPdf("DETALLES DE LA SOLICITUD Y ENTREGA"), {
    x: margen,
    y,
    size: 10,
    font: fontBold,
    color: colorMarca,
  });
  y -= 10;

  const periodoNombre = pasaje.periodo_pasaje
    ? (PERIODOS_ES[pasaje.periodo_pasaje] ?? pasaje.periodo_pasaje)
    : "-";
  const diasTexto =
    pasaje.periodo_pasaje === "personalizado" && pasaje.dias_pasaje?.length
      ? pasaje.dias_pasaje.map((d) => DIAS_ES[d] ?? d).join(", ")
      : null;
  const periodoDetalle =
    pasaje.periodo_pasaje === "personalizado" && diasTexto
      ? `${periodoNombre} (x${pasaje.factor_periodo}) - ${diasTexto}`
      : `${periodoNombre} (x${pasaje.factor_periodo})`;

  const filasDetalle: [string, string][] = [
    ["Solicitante", pasaje.solicitante ?? "-"],
    ["Lugar", pasaje.lugar_visible],
    ["Motivo", pasaje.motivo_visible],
    ["Periodo", periodoDetalle],
    ["Monto base", formatearMonto(pasaje.monto_base.toFixed(2), pasaje.moneda)],
    ["Monto a entregar", formatearMonto(pasaje.monto_a_entregar.toFixed(2), pasaje.moneda)],
    ["Monto entregado", textoEntregado],
    ["Fecha de solicitud", formatearFechaHoraRd(pasaje.creada)],
    ["Fecha de entrega", formatearFechaHoraRd(pasaje.entregado_en)],
    ["Entregado por", pasaje.entregado_por_nombre ?? "-"],
  ];

  const anchoColEtiqueta = 155;
  const anchoColValor = anchoUtil - anchoColEtiqueta - 20;

  for (let idx = 0; idx < filasDetalle.length; idx++) {
    const [etiqueta, valor] = filasDetalle[idx];
    const lineasValor = dividirLineas(valor, fontRegular, 10, anchoColValor);
    const numLineas = Math.max(1, lineasValor.length);
    const altoFila = numLineas * 14 + 12;

    pagina.drawRectangle({
      x: margen,
      y: y - altoFila,
      width: anchoUtil,
      height: altoFila,
      color: idx % 2 === 0 ? colorFondoSuave : rgb(1, 1, 1),
      borderColor: colorLinea,
      borderWidth: 0.6,
    });

    pagina.drawText(seguroPdf(etiqueta), {
      x: margen + 10,
      y: y - 16,
      size: 9.5,
      font: fontBold,
      color: colorGris,
    });

    lineasValor.forEach((linea, li) => {
      pagina.drawText(linea, {
        x: margen + anchoColEtiqueta,
        y: y - 16 - li * 14,
        size: 10,
        font: fontRegular,
        color: colorTinta,
      });
    });

    y -= altoFila;
  }

  if (pasaje.detalle) {
    y -= 14;
    pagina.drawText(seguroPdf("Observaciones:"), {
      x: margen,
      y,
      size: 9.5,
      font: fontBold,
      color: colorGris,
    });
    y -= 14;
    const lineasObs = dividirLineas(pasaje.detalle, fontRegular, 9.5, anchoUtil);
    for (const linea of lineasObs.slice(0, 5)) {
      pagina.drawText(linea, {
        x: margen,
        y,
        size: 9.5,
        font: fontRegular,
        color: colorTinta,
      });
      y -= 13;
    }
  }

  // Bloque de firmas (Solicitante y Quien entrega)
  const yFirma = Math.min(y - 75, 165);
  const anchoFirma = (anchoUtil - 48) / 2;
  const xFirmaIzq = margen;
  const xFirmaDer = margen + anchoFirma + 48;

  // Firma izquierda: Quien solicita
  pagina.drawLine({
    start: { x: xFirmaIzq, y: yFirma },
    end: { x: xFirmaIzq + anchoFirma, y: yFirma },
    thickness: 1,
    color: colorTinta,
  });
  pagina.drawText(seguroPdf("Firma de quien solicita"), {
    x: xFirmaIzq,
    y: yFirma - 15,
    size: 9.5,
    font: fontBold,
    color: colorTinta,
  });
  pagina.drawText(seguroPdf(pasaje.solicitante ?? "Nombre y firma"), {
    x: xFirmaIzq,
    y: yFirma - 29,
    size: 9,
    font: fontRegular,
    color: colorGris,
  });

  // Firma derecha: Quien entrega
  pagina.drawLine({
    start: { x: xFirmaDer, y: yFirma },
    end: { x: xFirmaDer + anchoFirma, y: yFirma },
    thickness: 1,
    color: colorTinta,
  });
  pagina.drawText(seguroPdf("Firma de quien entrega"), {
    x: xFirmaDer,
    y: yFirma - 15,
    size: 9.5,
    font: fontBold,
    color: colorTinta,
  });
  pagina.drawText(seguroPdf(pasaje.entregado_por_nombre ?? "Nombre y firma"), {
    x: xFirmaDer,
    y: yFirma - 29,
    size: 9,
    font: fontRegular,
    color: colorGris,
  });

  // Pie de página
  const pie = seguroPdf(
    `Portal GlobalEffect - Fundacion Global Effect (La Vega, RD) - Generado el ${formatearFechaHoraRd(new Date().toISOString())}`,
  );
  pagina.drawText(pie, {
    x: margen,
    y: 34,
    size: 8,
    font: fontRegular,
    color: colorGris,
  });

  const bytes = await pdf.save();

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Comprobante-Pasaje-${pasaje.folio}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
