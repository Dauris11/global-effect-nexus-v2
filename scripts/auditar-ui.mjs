/**
 * Auditoría de la norma visual (docs/09-sistema-visual.md).
 *
 * Dos comprobaciones, y cualquiera de las dos falla la orden:
 *
 *   1. Ningún matiz fuera de marca en `src/`: las clases de Tailwind con
 *      emerald, amber, rojo, verde… Es la grep de siempre de
 *      `.claude/rules/design-system.md`.
 *   2. Ningún hex suelto en un `.tsx`. El color sale de un token
 *      (`marca-500`, `tinta`, `linea`…) o de `src/lib/paleta.ts`; un hex
 *      escrito a mano es lo que obligaba a tocar noventa archivos para
 *      cambiar el aspecto.
 *
 * EXCEPCIONES del hex, y por qué:
 *   · Los dos verdes y rojos de `SEMAFORO` (#1E9E6A, #B4342B): la norma pide
 *     escribirlos como `bg-[#1E9E6A]` precisamente para que no sean `green-*`.
 *   · Los componentes que pintan con `fill`/`stroke` o con un `<canvas>`
 *     (gráficas de Recharts, el globo de cobe): necesitan el color crudo y lo
 *     toman de las constantes de `paleta.ts`, pero a veces lo escriben en el
 *     propio SVG.
 *
 * Uso: npm run audit:ui
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ARCOIRIS =
  /\b(bg|text|border|from|to|via|ring|fill|stroke|divide|outline|shadow|decoration|accent|caret|placeholder)-(emerald|amber|orange|rose|violet|red|green|yellow|purple|teal|pink|indigo|lime|fuchsia|cyan|sky)-[0-9]/;
const HEX = /#[0-9A-Fa-f]{6}\b/g;
/** Colores estrictos de la marca y del semáforo institucional (docs/09-sistema-visual.md). */
const PERMITIDOS_HEX = new Set([
  "#1E9E6A", // Semáforo entidad activa / aprobado
  "#B4342B", // Semáforo entidad inactiva / rechazado / alerta
  "#2096BA", // Turquesa institucional
  "#187A99", // Turquesa institucional hover
  "#0A6A8A", // Turquesa institucional oscuro
  "#5FB8D4", // Turquesa suave institucional
  "#171A1D", // Tinta institucional
  "#FFFFFF", // Blanco puro
  "#000000", // Negro puro
]);
const EXCEPCIONES_HEX = [
  "src/lib/paleta.ts",
  "src/components/dashboard/graficas.tsx",
  "src/components/landing/globe.tsx",
];

const archivos = [];
(function recorrer(dir) {
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) recorrer(ruta);
    else if (/\.(tsx?|css)$/.test(ruta)) archivos.push(ruta);
  }
})("src");

let arcoiris = 0;
let hex = 0;
const porArchivo = new Map();

for (const archivo of archivos) {
  const lineas = readFileSync(archivo, "utf8").split("\n");
  lineas.forEach((linea, i) => {
    if (ARCOIRIS.test(linea)) {
      arcoiris++;
      console.log(`arcoíris  ${archivo}:${i + 1}  ${linea.trim().slice(0, 100)}`);
    }
    if (!archivo.endsWith(".tsx") || EXCEPCIONES_HEX.includes(archivo)) return;
    // Un comentario que cita un color no pinta nada.
    if (/^\s*(\*|\/\/|\/\*)/.test(linea)) return;
    for (const [valor] of linea.matchAll(HEX)) {
      if (PERMITIDOS_HEX.has(valor.toUpperCase())) continue;
      hex++;
      porArchivo.set(archivo, (porArchivo.get(archivo) ?? 0) + 1);
    }
  });
}

if (hex > 0) {
  console.log(`\nHex sueltos en .tsx (${hex} en ${porArchivo.size} archivos):`);
  for (const [archivo, n] of [...porArchivo].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${archivo}`);
  }
}

if (arcoiris || hex) {
  console.log(`\n✗ audit:ui — ${arcoiris} arcoíris, ${hex} hex sueltos`);
  process.exit(1);
}
console.log("✓ audit:ui — sin arcoíris y sin hex sueltos");
