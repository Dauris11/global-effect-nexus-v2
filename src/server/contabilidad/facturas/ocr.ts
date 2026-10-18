import { consultarUna } from "@/lib/db";
import {
  leerDocumento,
  MAXIMO_DOCUMENTO_OCR,
  TIPOS_DOCUMENTO_OCR,
} from "@/lib/ia";

/**
 * OCR inteligente de facturas y comprobantes fiscales (DGII) dominicanos.
 *
 * Utiliza el modelo de visión IA para extraer de forma automática y estructurada
 * los datos de la factura: RNC del emisor, Razón Social, NCF (B01, B02, B11...) o e-CF,
 * fechas, desglose impositivo (subtotal, ITBIS 18%, retenciones) y total.
 *
 * Reglas:
 *   1. "La IA propone, el contable confirma": nunca asienta directamente.
 *   2. Devuelve confianza (0–100) y valida cada campo con lógica fiscal dominicana.
 *   3. Deja rastro en `extraccion_ocr` para auditoría y trazabilidad.
 */

const INSTRUCCIONES_FACTURA = [
  "Eres un experto en lectura OCR de facturas comerciales y comprobantes fiscales de la República Dominicana.",
  "Extraes con precisión quirúrgica los datos del documento escaneado (factura, comprobante fiscal o recibo).",
  "Transcribes lo que VES. No inventas, no redondeas, no asumes.",
  "Responde ÚNICAMENTE con un objeto JSON, sin texto explicativo alrededor y sin bloques de código.",
  "Campos:",
  '  "rnc": RNC o cédula del proveedor/emisor (solo dígitos, 9 u 11 caracteres), o null.',
  '  "proveedor_nombre": Nombre o razón social del proveedor emisor, o null.',
  '  "ncf": Número de comprobante fiscal NCF (B01, B02, B11, B14, B15, etc.) o e-CF (E31, E41, etc.), o null.',
  '  "fecha_emision": Fecha en formato YYYY-MM-DD, o null.',
  '  "fecha_vencimiento": Fecha de vencimiento si aparece en la factura en formato YYYY-MM-DD, o null.',
  '  "moneda": "DOP" o "USD" (por defecto "DOP").',
  '  "subtotal": número decimal positivo con el subtotal antes de impuestos, o null.',
  '  "itbis": número decimal con el monto de ITBIS (18%), o 0.',
  '  "retencion_isr": número decimal con la retención de ISR si aplica, o 0.',
  '  "retencion_itbis": número decimal con la retención de ITBIS si aplica, o 0.',
  '  "total": número decimal positivo con el total de la factura, o null.',
  '  "concepto": descripción breve y concisa de lo adquirido (máximo 120 caracteres), o null.',
  '  "confianza": número entero de 0 a 100 indicando la certeza global de la lectura.',
  "Si el documento no es legible o no es una factura/comprobante, devuelve todos los campos en null y confianza 0.",
].join("\n");

const PETICION_FACTURA =
  "Lee este comprobante fiscal o factura y devuelve el JSON con los campos estructurados.";

export type DatosFacturaLeidos = {
  rnc: string | null;
  proveedorNombre: string | null;
  ncf: string | null;
  fechaEmision: string | null;
  fechaVencimiento: string | null;
  moneda: "DOP" | "USD";
  subtotal: number | null;
  itbis: number;
  retencionIsr: number;
  retencionItbis: number;
  total: number | null;
  concepto: string | null;
  confianza: number;
};

export type ResultadoFacturaOcr =
  | { estado: "ok"; datos: DatosFacturaLeidos }
  | { estado: "tipo_no_admitido" }
  | { estado: "demasiado_grande" }
  | { estado: "sin_clave" }
  | { estado: "ilegible" }
  | { estado: "error" };

export async function leerFacturaOcr(
  archivo: File,
  usuarioId: string,
): Promise<ResultadoFacturaOcr> {
  if (!(TIPOS_DOCUMENTO_OCR as readonly string[]).includes(archivo.type)) {
    return { estado: "tipo_no_admitido" };
  }

  if (archivo.size > MAXIMO_DOCUMENTO_OCR) {
    return { estado: "demasiado_grande" };
  }

  const base64 = Buffer.from(await archivo.arrayBuffer()).toString("base64");

  const lectura = await leerDocumento(
    { mime: archivo.type, base64 },
    INSTRUCCIONES_FACTURA,
    PETICION_FACTURA,
  );

  if (lectura.estado === "sin_clave") return { estado: "sin_clave" };
  if (lectura.estado === "ilegible") return { estado: "ilegible" };

  if (lectura.estado !== "ok") {
    await anotarExtraccionOcr({
      usuarioId,
      estado: "error",
      modelo: null,
      datos: null,
      confianza: null,
      mensaje: lectura.estado,
    });
    return { estado: "error" };
  }

  const datos = validarFactura(lectura.datos);

  await anotarExtraccionOcr({
    usuarioId,
    estado: "completado",
    modelo: lectura.modelo,
    datos,
    confianza: datos.confianza,
    mensaje: null,
  });

  if (!datos.total && !datos.subtotal && !datos.ncf && !datos.rnc) {
    return { estado: "ilegible" };
  }

  return { estado: "ok", datos };
}

function validarFactura(bruto: Record<string, unknown>): DatosFacturaLeidos {
  const rncCrudo = texto(bruto.rnc, 20);
  const rncLimpio = rncCrudo ? rncCrudo.replace(/\D/g, "") : null;
  const rncValido = rncLimpio && (rncLimpio.length === 9 || rncLimpio.length === 11) ? rncLimpio : null;

  const ncfCrudo = texto(bruto.ncf, 20);
  const ncfLimpio = ncfCrudo ? ncfCrudo.trim().toUpperCase() : null;
  const ncfValido = ncfLimpio && /^([BE][0-9]{10,12})$/.test(ncfLimpio) ? ncfLimpio : null;

  const fEmision = texto(bruto.fecha_emision, 10);
  const fVencimiento = texto(bruto.fecha_vencimiento, 10);

  const subtotal = numeroPositivo(bruto.subtotal);
  const itbis = numeroPositivo(bruto.itbis) ?? 0;
  const retIsr = numeroPositivo(bruto.retencion_isr) ?? 0;
  const retItbis = numeroPositivo(bruto.retencion_itbis) ?? 0;
  let total = numeroPositivo(bruto.total);

  if (!total && subtotal !== null) {
    total = Math.round((subtotal + itbis) * 100) / 100;
  }

  const moneda = bruto.moneda === "USD" ? "USD" : "DOP";

  return {
    rnc: rncValido,
    proveedorNombre: texto(bruto.proveedor_nombre, 200),
    ncf: ncfValido,
    fechaEmision: fEmision && esFechaIso(fEmision) ? fEmision : null,
    fechaVencimiento: fVencimiento && esFechaIso(fVencimiento) ? fVencimiento : null,
    moneda,
    subtotal,
    itbis,
    retencionIsr: retIsr,
    retencionItbis: retItbis,
    total,
    concepto: texto(bruto.concepto, 250),
    confianza: Math.min(100, Math.max(0, Math.round(Number(bruto.confianza) || 0))),
  };
}

function texto(valor: unknown, largo: number): string | null {
  if (typeof valor !== "string") return null;
  const limpio = valor.trim().slice(0, largo);
  return limpio === "" ? null : limpio;
}

function numeroPositivo(valor: unknown): number | null {
  if (typeof valor === "number" && !isNaN(valor) && valor > 0) {
    return Math.round(valor * 100) / 100;
  }
  if (typeof valor === "string") {
    const parseado = parseFloat(valor.replace(/,/g, ""));
    if (!isNaN(parseado) && parseado > 0) {
      return Math.round(parseado * 100) / 100;
    }
  }
  return null;
}

function esFechaIso(cadena: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cadena)) return false;
  const [anio, mes, dia] = cadena.split("-").map(Number);
  const fecha = new Date(anio, mes - 1, dia);
  return (
    fecha.getFullYear() === anio &&
    fecha.getMonth() === mes - 1 &&
    fecha.getDate() === dia
  );
}

async function anotarExtraccionOcr(params: {
  usuarioId: string;
  estado: string;
  modelo: string | null;
  datos: unknown;
  confianza: number | null;
  mensaje: string | null;
}) {
  try {
    await consultarUna(
      `INSERT INTO extraccion_ocr
         (creado_por_id, estado, modelo, confianza, datos_extraidos, mensaje_error)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        params.usuarioId,
        params.estado,
        params.modelo,
        params.confianza,
        params.datos ? JSON.stringify(params.datos) : null,
        params.mensaje,
      ],
    );
  } catch (err) {
    console.error("[ocr-factura] No se pudo guardar la extracción:", err);
  }
}
