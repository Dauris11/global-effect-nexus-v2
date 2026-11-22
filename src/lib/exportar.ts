/**
 * Lo que se puede exportar y en qué formatos, en un archivo sin servidor para que lo usen a la
 * vez el menú «Exportar» (cliente) y el catálogo que genera los documentos (servidor): así no
 * se descuadran. Un documento nuevo se da de alta aquí y en `server/exportar/catalogo.ts`.
 */
export const FORMATOS_EXPORTACION = ["pdf", "docx", "xlsx", "csv"] as const;

export type FormatoExportacion = (typeof FORMATOS_EXPORTACION)[number];

const TODOS: readonly FormatoExportacion[] = ["pdf", "docx", "xlsx", "csv"];

export const FORMATOS_DE = {
  ficha: ["pdf", "docx"],
  record: TODOS,
  avance: TODOS,
  expedientes: TODOS,
  riesgo: TODOS,
  "estudiantes-universidad": TODOS,
  "notas-universidad": ["pdf", "xlsx", "csv"],
  "plan-estudios": TODOS,
  "clase-360": TODOS,
  "asistencia-360": ["pdf", "docx", "xlsx"],
  "estudiantes-patrocinador": TODOS,
} as const satisfies Record<string, readonly FormatoExportacion[]>;

export type TipoExportacion = keyof typeof FORMATOS_DE;

/** Dirección de descarga de un documento. `ver` abre el PDF en el navegador para imprimirlo. */
export function enlaceExportar(tipo: TipoExportacion, params: Record<string, string>, formato: FormatoExportacion, ver = false): string {
  const q = new URLSearchParams({ ...params, formato });

  if (ver) q.set("ver", "1");

  return `/api/exportar/${tipo}?${q.toString()}`;
}
