// Tabla «regla → nº de rutas que fallan → ejemplos» a partir de e2e/.resultados/ux.ndjson.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const archivo = "e2e/.resultados/ux.ndjson";
if (!existsSync(archivo)) {
  console.log("Sin resultados: ¿falló el arranque?");
  process.exit(0);
}
const filas = readFileSync(archivo, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
const reglas = [...new Set(filas.map((f) => f.regla))];
const lineas = ["| Regla | Evaluadas | Fallan | Ejemplos |", "|---|---:|---:|---|"];
for (const r of reglas) {
  const todas = filas.filter((f) => f.regla === r);
  const malas = todas.filter((f) => !f.ok);
  const ej = [...new Map(malas.map((f) => [`${f.rol}${f.ruta}`, f])).values()]
    .slice(0, 3)
    .map((f) => `${f.rol} ${f.ruta}: ${f.detalle}`.slice(0, 110))
    .join(" · ");
  lineas.push(`| ${r} | ${todas.length} | ${malas.length} | ${ej} |`);
}
const md = lineas.join("\n");
console.log(`\n${md}\n`);
writeFileSync("e2e/.resultados/resumen.md", md + "\n");
