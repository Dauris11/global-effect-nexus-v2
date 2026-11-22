/**
 * Un documento exportable, descrito una sola vez y generado en cuatro formatos (PDF, Word,
 * Excel y CSV). Quien lo arma (`documentos/*.ts`) solo dice QUÉ lleva —secciones, datos,
 * tablas—; cómo se ve en cada formato lo deciden los generadores. Así una ficha, una lista
 * de clase o un récord salen iguales de ordenados vengan de donde vengan.
 */

export const FORMATOS = ["pdf", "docx", "xlsx", "csv"] as const;

export type Formato = (typeof FORMATOS)[number];

export type Celda = string | number | null | undefined;

export type Bloque =
  | { tipo: "seccion"; titulo: string }
  /** Pares etiqueta/valor. Un valor largo o con saltos de línea ocupa todo el ancho. */
  | { tipo: "datos"; filas: readonly (readonly [string, Celda])[] }
  | { tipo: "tabla"; columnas: readonly string[]; filas: readonly (readonly Celda[])[]; /** Nombre de la hoja en Excel. */ nombreHoja?: string; /** `r` = número alineado a la derecha, `c` = centrado. */ alinear?: readonly ("l" | "r" | "c")[]; /** Anchos relativos; si falta se reparte según el contenido. */ anchos?: readonly number[]; /** Líneas entre columnas y filas altas: para hojas que se llenan a mano (asistencia). */ cuadricula?: boolean }
  | { tipo: "parrafo"; texto: string };

export type Documento = {
  titulo: string;
  /** Una línea bajo el título: «UCATECI · Ingeniería…», «Período 2025-II». */
  subtitulo?: string;
  /** Foto en JPEG (la de un expediente). */
  foto?: Buffer | null;
  bloques: readonly Bloque[];
  /** Horizontal para tablas anchas. */
  horizontal?: boolean;
  /** Sin extensión: `expediente-maria-perez`. */
  nombreArchivo: string;
};

/** Texto de una celda, siempre cadena. */
export const texto = (c: Celda): string => (c === null || c === undefined ? "" : String(c));

/** Nombre de archivo seguro: sin tildes ni signos, en minúsculas. */
export const nombreSeguro = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 60) || "documento";
