// Runner de migraciones: aplica en orden los .sql de db/migrations/,
// registrando los ya aplicados en la tabla _migracion (idempotente).
// Uso: npm run db:migrate
import { config } from "dotenv";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

config({ path: ".env.local" });

const __dirname = dirname(fileURLToPath(import.meta.url));
const dir = join(__dirname, "..", "db", "migrations");

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
await client.query(
  `CREATE TABLE IF NOT EXISTS _migracion (nombre TEXT PRIMARY KEY, aplicada_en TIMESTAMPTZ DEFAULT now())`,
);

const { rows } = await client.query("SELECT nombre FROM _migracion");
const aplicadas = new Set(rows.map((r) => r.nombre));

const archivos = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
let nuevas = 0;
for (const f of archivos) {
  if (aplicadas.has(f)) {
    console.log(`= ya aplicada: ${f}`);
    continue;
  }
  console.log(`+ aplicando: ${f}`);
  await client.query("BEGIN");
  try {
    await client.query(readFileSync(join(dir, f), "utf8"));
    await client.query("INSERT INTO _migracion(nombre) VALUES ($1)", [f]);
    await client.query("COMMIT");
    nuevas++;
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(`! error en ${f}:`, e.message);
    process.exit(1);
  }
}
await client.end();
console.log(nuevas ? `Listo: ${nuevas} migración(es) aplicada(s).` : "Base de datos al día.");
