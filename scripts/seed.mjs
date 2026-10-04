// Runner de sembrado: ejecuta db/seed.sql (idempotente vía ON CONFLICT).
// Uso: npm run db:seed
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

config({ path: ".env.local" });

const __dirname = dirname(fileURLToPath(import.meta.url));
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query(readFileSync(join(__dirname, "..", "db", "seed.sql"), "utf8"));
  console.log("Seed aplicado.");
} catch (e) {
  console.error("Error en seed:", e.message);
  process.exit(1);
} finally {
  await client.end();
}
