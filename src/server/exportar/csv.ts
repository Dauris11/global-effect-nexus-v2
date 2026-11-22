import { aCsv } from "@/lib/csv";

import { texto, type Documento } from "./documento";

/**
 * CSV de un `Documento`: si tiene una sola tabla, es esa tabla tal cual; si tiene varias o
 * datos sueltos, van una tras otra separadas por una línea en blanco y con su título.
 */
export function documentoACsv(doc: Documento): string {
  const tablas = doc.bloques.filter((b) => b.tipo === "tabla");

  if (tablas.length === 1 && doc.bloques.every((b) => b.tipo === "tabla")) return aCsv(tablas[0].columnas, tablas[0].filas);

  const partes: string[] = [];

  for (const b of doc.bloques) {
    if (b.tipo === "seccion") partes.push(aCsv([b.titulo], []).trim());
    else if (b.tipo === "parrafo") partes.push(aCsv([b.texto], []).trim());
    else if (b.tipo === "datos") partes.push(aCsv(["Campo", "Valor"], b.filas.map(([e, v]) => [e, texto(v)])).trim());
    else partes.push(aCsv(b.columnas, b.filas).trim());
  }

  return `﻿${partes.map((p) => p.replace(/^﻿/, "")).join("\r\n\r\n")}\r\n`;
}
