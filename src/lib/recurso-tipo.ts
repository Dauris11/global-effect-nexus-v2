import { BookOpen, FileText, Presentation, Shapes, type LucideIcon } from "lucide-react";

import type { TokenEstado } from "@/lib/status-map";

/**
 * El «tipo» con el que la biblioteca de Habitudes rotula un recurso: PPTX, PDF,
 * Guía o Dinámica (lo demás, «Archivo»). La categoría manda para guías y
 * dinámicas, que son una forma de trabajar y no un formato; para el resto manda
 * el formato del archivo.
 *
 * El color sale de los tokens `status-*` y no de matices propios: la marca no
 * tiene arcoíris, y reusar la paleta de estado deja un solo estándar. Cada tipo
 * lleva además su icono, para que se distinga también en escala de grises.
 */
export type TipoRecurso = "pptx" | "pdf" | "guia" | "dinamica" | "archivo";

export const VISUAL_TIPO: Record<TipoRecurso, { token: TokenEstado; icono: LucideIcon }> = {
  pptx: { token: "warning", icono: Presentation },
  pdf: { token: "danger", icono: FileText },
  guia: { token: "info", icono: BookOpen },
  dinamica: { token: "progress", icono: Shapes },
  archivo: { token: "neutral", icono: FileText },
};

export function tipoDeRecurso(recurso: { categoria: string; formato: string }): TipoRecurso {
  if (recurso.categoria === "guia_facilitador") return "guia";
  if (recurso.categoria === "dinamica_taller") return "dinamica";
  const formato = recurso.formato.toLowerCase();

  if (formato === "pptx") return "pptx";
  if (formato === "pdf") return "pdf";

  return "archivo";
}

/** PDF e imágenes se ven en el navegador («Abrir»); lo demás se baja («Descargar»). */
export function seAbreEnNavegador(formato: string): boolean {
  return ["pdf", "png", "jpg", "jpeg"].includes(formato.toLowerCase());
}
