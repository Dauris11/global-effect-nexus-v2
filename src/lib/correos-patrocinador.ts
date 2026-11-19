/**
 * Reglas puras de las cartas de los becados a sus patrocinadores.
 *
 * Sin base ni red para poder probarlas sin clave. Aquí vive todo lo que decide
 * código y no el modelo: en qué mes cuenta una carta, qué se acepta como
 * respuesta del clasificador y qué cosas NO pueden salir en la traducción que
 * llega al patrocinador. El modelo solo clasifica y traduce; que una carta se
 * envíe lo decide este archivo.
 */

/** Motivos que puede dar el clasificador. Lista cerrada: nada fuera de ella vale. */
export const MOTIVOS_MODELO = [
  "dinero",
  "telefono",
  "ropa_objetos",
  "chisme_fundacion",
  "datos_personales",
  "otro",
] as const;

/** Motivos que pone el sistema, no el modelo. */
export const MOTIVOS_SISTEMA = [
  "remitente_no_verificado",
  "traduccion_sospechosa",
  "clasificador_no_disponible",
  "adjuntos",
] as const;

export type MotivoModelo = (typeof MOTIVOS_MODELO)[number];
export type MotivoCorreo = MotivoModelo | (typeof MOTIVOS_SISTEMA)[number];

export type VeredictoCorreo = {
  veredicto: "limpio" | "revisar";
  motivos: MotivoModelo[];
  traduccion: string;
};

/** La República Dominicana no usa horario de verano: UTC−4 todo el año. */
const DESFASE_RD_MS = 4 * 60 * 60 * 1000;

/**
 * Mes al que cuenta una carta y si llegó a tiempo, en hora de La Vega.
 *
 * Se calcula aquí y no con `new Date().getMonth()`: la base y el servidor corren
 * en UTC, y a las 8 PM del día 20 ya es el 21 en UTC. «A tiempo» incluye el día
 * límite completo (hasta las 23:59 hora RD).
 */
export function mesYATiempo(
  recibidoEn: Date,
  diaLimite: number,
): { mes: string; aTiempo: boolean } {
  const rd = new Date(recibidoEn.getTime() - DESFASE_RD_MS);
  const anio = rd.getUTCFullYear();
  const mes = String(rd.getUTCMonth() + 1).padStart(2, "0");

  return { mes: `${anio}-${mes}`, aTiempo: rd.getUTCDate() <= diaLimite };
}

const ENTIDADES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

/**
 * HTML a texto plano. Nunca se reenvía el HTML del estudiante: solo texto.
 * Se quitan scripts y estilos con su contenido, después las etiquetas, y los
 * bloques (`p`, `br`, `div`, `li`) se vuelven saltos de línea.
 */
export function htmlATexto(html: string): string {
  return html
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\s*br\s*\/?\s*>|<\/\s*(p|div|li|tr|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (e) => ENTIDADES[e] ?? e)
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const MAXIMO_CARACTERES_CARTA = 8000;

/** El cuerpo de la carta como texto plano y acotado. */
export function cuerpoDeCarta(texto: string | null, html: string | null): string {
  const base = texto?.trim() ? texto : html ? htmlATexto(html) : "";

  return base
    .normalize("NFKC")
    .replace(/[\u0000-\u0008\u000B\u000E-\u001F\u007F-\u009F​-‏‪-‮⁠-⁤﻿]/g, "")
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, MAXIMO_CARACTERES_CARTA);
}

/** `"Ana Pérez" <ana@x.org>` → `ana@x.org`, en minúsculas; `null` si no hay dirección. */
export function direccionDe(remitente: string): string | null {
  const dentro = remitente.match(/<([^<>\s]+@[^<>\s]+)>/);
  const candidata = (dentro?.[1] ?? remitente).trim().toLowerCase();

  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(candidata) ? candidata : null;
}

/**
 * Resultado de SPF/DKIM/DMARC a partir de la cabecera `Authentication-Results`
 * (o de lo que ya resuelva el proveedor). Un solo `fail` o `softfail` es `fail`;
 * `pass` solo si DMARC pasa, o SPF y DKIM pasan. Sin datos, `desconocida`.
 */
export function autenticacionDe(
  cabecera: string | null | undefined,
): "pass" | "fail" | "desconocida" {
  if (!cabecera) return "desconocida";

  const c = cabecera.toLowerCase();

  if (/\b(spf|dkim|dmarc)=(fail|softfail|permerror|temperror)\b/.test(c)) return "fail";
  if (/\bdmarc=pass\b/.test(c) || (/\bspf=pass\b/.test(c) && /\bdkim=pass\b/.test(c))) {
    return "pass";
  }

  return "desconocida";
}

/**
 * Valida lo que devolvió el clasificador. Estricto a propósito: cualquier forma
 * distinta de la esperada es `null` y la carta se retiene. Una carta marcada
 * «limpia» pero con motivos se trata como «revisar»: la contradicción es mala señal.
 */
export function validarVeredicto(crudo: unknown): VeredictoCorreo | null {
  if (!crudo || typeof crudo !== "object") return null;

  const { veredicto, motivos, traduccion } = crudo as Record<string, unknown>;

  if (veredicto !== "limpio" && veredicto !== "revisar") return null;
  if (!Array.isArray(motivos) || motivos.length > MOTIVOS_MODELO.length) return null;
  if (!motivos.every((m) => (MOTIVOS_MODELO as readonly unknown[]).includes(m))) return null;
  if (typeof traduccion !== "string") return null;

  const texto = traduccion.trim();

  if (!texto || texto.length > MAXIMO_CARACTERES_CARTA * 2) return null;

  const unicos = [...new Set(motivos)] as MotivoModelo[];

  return {
    veredicto: veredicto === "limpio" && unicos.length === 0 ? "limpio" : "revisar",
    motivos: unicos,
    traduccion: texto,
  };
}

const COMPROBACIONES_SALIDA: readonly [MotivoCorreo, RegExp][] = [
  ["traduccion_sospechosa", /https?:\/\/|www\.|\b[\w-]+\.(com|org|net|do|io|co)\b\/?/i],
  ["traduccion_sospechosa", /[^\s@]+@[^\s@]+\.[^\s@]+/],
  ["traduccion_sospechosa", /(\+?\d[\s().-]?){8,}/], // teléfonos y cuentas
  [
    "traduccion_sospechosa",
    /(\$|us\$|rd\$|usd|dop|eur)\s*\d|\d\s*(\$|usd|dop|eur|pesos|dollars?|d[oó]lares)\b/i,
  ],
  [
    "traduccion_sospechosa",
    /\b(western\s+union|paypal|zelle|venmo|cash\s*app|wire\s+transfer|bank\s+account|account\s+number|transferencia|cuenta\s+bancaria|n[uú]mero\s+de\s+cuenta|dep[oó]sito|iban|swift)\b/i,
  ],
];

/**
 * Lo que NUNCA debe salir en la traducción que recibe el patrocinador,
 * independientemente de lo que haya dicho el modelo: una carta puede pedirle al
 * modelo que «añada» un enlace, una cuenta o un monto. Cualquier acierto fuerza
 * la retención.
 */
export function revisarTraduccion(traduccion: string): MotivoCorreo[] {
  const texto = traduccion.normalize("NFKC");

  return [...new Set(COMPROBACIONES_SALIDA.filter(([, p]) => p.test(texto)).map(([m]) => m))];
}

const escaparHtml = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * El correo que recibe el patrocinador: solo la traducción, el nombre del
 * estudiante y una nota de que la Fundación lo revisó. Todo se escapa: el texto
 * viene de un estudiante y de un modelo, nunca se inserta como HTML.
 */
export function armarCartaParaPatrocinador({
  idioma,
  estudiante,
  traduccion,
}: {
  idioma: "es" | "en";
  estudiante: string;
  traduccion: string;
}): { asunto: string; html: string; texto: string } {
  const en = idioma === "en";
  const asunto = en ? `Letter from ${estudiante}` : `Carta de ${estudiante}`;
  const pie = en
    ? `This letter was reviewed and delivered by Fundación Global Effect on behalf of ${estudiante}. Replies to this address reach the Foundation.`
    : `Esta carta fue revisada y entregada por la Fundación Global Effect en nombre de ${estudiante}. Las respuestas a esta dirección llegan a la Fundación.`;

  return {
    asunto,
    texto: `${traduccion}\n\n— ${estudiante}\n\n${pie}`,
    html:
      `<div style="font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.6;color:#171A1D">` +
      `<p>${escaparHtml(traduccion).replace(/\n/g, "<br>")}</p>` +
      `<p>— ${escaparHtml(estudiante)}</p>` +
      `<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">` +
      `<p style="font-size:13px;color:#6b7280">${escaparHtml(pie)}</p></div>`,
  };
}

/** Estado del mes de un estudiante, derivado de sus cartas (ver `planillaDelMes`). */
export type EstadoCarta = "cumplio" | "en_revision" | "tardia" | "no_envio" | "no_aplica";
