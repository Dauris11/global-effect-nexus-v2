// Prueba REAL (gasta una llamada al modelo) de la lectura de listados de calificaciones.
// Uso: npx tsx scripts/probar-ocr-calificaciones.ts <archivo.pdf|png|jpg>
import { readFileSync } from "node:fs";

import { config } from "dotenv";

config({ path: ".env.local" });

const { universidadDeCarga, leerFilasDeArchivo } = await import("../src/server/universidades/carga-nucleo");
const { consultarUna, pool } = await import("../src/lib/db");
const { cadenaIA, capacidadesIA } = await import("../src/lib/modelo-ia");

const ruta = process.argv[2];
const mime = ruta.endsWith(".pdf") ? "application/pdf" : ruta.endsWith(".png") ? "image/png" : "image/jpeg";
const u = await consultarUna<{ id: string }>(`SELECT id FROM universidad WHERE siglas = 'UCATECI'`);
const universidad = await universidadDeCarga(u!.id);
const bytes = readFileSync(ruta);

console.log("cadena:", cadenaIA(), "capacidades:", capacidadesIA());

const r = await leerFilasDeArchivo({ mime, base64: bytes.toString("base64"), bytes: bytes.length }, universidad!);

console.log(JSON.stringify(r, null, 1));
await pool.end();
