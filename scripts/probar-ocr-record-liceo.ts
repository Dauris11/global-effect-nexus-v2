// Prueba REAL (gasta llamadas al modelo): lee fotos de un récord de secundaria y las compara
// con la transcripción del ejemplo. Uso: npx tsx scripts/probar-ocr-record-liceo.ts <foto1> [foto2…]
import { readFileSync } from "node:fs";

import { config } from "dotenv";

config({ path: ".env.local" });

const { leerRecordDeArchivo } = await import("../src/server/record-liceo/lectura");
const { fusionarGrados, normalizar, promediosDelRecord } = await import("../src/lib/record-liceo");
const { cadenaIA, capacidadesIA } = await import("../src/lib/modelo-ia");

const rutas = process.argv.slice(2);
const ejemplo = JSON.parse(readFileSync(new URL("./fixtures/record-liceo-ejemplo.json", import.meta.url), "utf8"));
let grados: Awaited<ReturnType<typeof fusionarGrados>> = [];

console.log("cadena:", cadenaIA(), "capacidades:", capacidadesIA());

for (const ruta of rutas) {
  const mime = ruta.endsWith(".pdf") ? "application/pdf" : ruta.endsWith(".png") ? "image/png" : "image/jpeg";
  const bytes = readFileSync(ruta);
  const r = await leerRecordDeArchivo({ mime, base64: bytes.toString("base64"), bytes: bytes.length });

  console.log(ruta, "→", r.estado, r.estado === "ok" ? r.grados.map((g) => `${g.grado}º ${g.anioInicio} (${g.notas.length})`).join(", ") : "");
  if (r.estado === "ok") grados = fusionarGrados(grados, r.grados);
}

const p = promediosDelRecord(grados);
const esperado = ejemplo.esperado;
let fallos = 0;
const comprobar = (nombre: string, obtenido: unknown, quiero: unknown) => {
  const bien = JSON.stringify(obtenido) === JSON.stringify(quiero);

  if (!bien) fallos += 1;
  console.log(bien ? "OK " : "MAL", nombre, "→", JSON.stringify(obtenido), bien ? "" : `(esperado ${JSON.stringify(quiero)})`);
};

comprobar("notas", p.totalNotas, esperado.totalNotas);
comprobar("suma total", p.sumaTotal, esperado.sumaTotal);
comprobar("sumas por grado", p.porGrado.map((g) => g.suma), esperado.sumasPorGrado);
comprobar("global", p.global, esperado.global);
comprobar("anual", p.anual, esperado.anual);
// El texto del centro varía un poco entre lecturas (punto final, «Jima Abajo…»): se compara por prefijo.
const prefijo = (c: string) => normalizar(c).split(" jima ")[0];

comprobar("centros", grados.map((g) => prefijo(g.centro)), ejemplo.grados.map((g: { centro: string }) => prefijo(g.centro)));

// Las notas se comparan por VALOR y en orden: los nombres del papel traen erratas
// («Informatices», «-Inglés-») que la lectura transcribe tal cual y no son un fallo.
for (const [i, g] of grados.entries()) {
  const quiero: number[] = ejemplo.grados[i]?.notas.map(([, n]: [string, number]) => n) ?? [];

  comprobar(`notas de ${g.grado}º`, g.notas.map((n) => n.nota), quiero);
}

console.log(fallos === 0 ? "\nLECTURA IDÉNTICA al ejemplo" : `\n${fallos} diferencias`);
process.exit(fallos === 0 ? 0 : 1);
