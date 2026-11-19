// Carga un pénsum desde un archivo de lista (ver db/datos/*.txt) en la base.
// Uso: node --env-file=.env.local scripts/cargar-pensum.mjs <archivo> <SIGLAS> "<carrera>" <versión>
// Es idempotente: crea la carrera y el pénsum si faltan y actualiza materias por código.
import { readFileSync } from "node:fs";

import pg from "pg";

import { leerListaDePensum } from "../src/lib/pensum.ts";

const [archivo, siglas, carrera, version] = process.argv.slice(2);

if (!archivo || !siglas || !carrera || !version) {
  console.error('Uso: cargar-pensum.mjs <archivo> <SIGLAS> "<carrera>" <versión>');
  process.exit(1);
}

const { materias, rechazadas } = leerListaDePensum(readFileSync(archivo, "utf8"));

if (rechazadas.length > 0) {
  console.error("Líneas ilegibles:", rechazadas.join(", "));
  process.exit(1);
}

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });

await c.connect();
await c.query("BEGIN");

try {
  const u = await c.query("SELECT id FROM universidad WHERE siglas = $1", [siglas.toUpperCase()]);

  if (u.rows.length === 0) throw new Error(`No existe la universidad ${siglas}`);

  const car = await c.query(
    `INSERT INTO carrera (universidad_id, nombre) VALUES ($1, $2)
     ON CONFLICT (universidad_id, nombre) DO UPDATE SET nombre = EXCLUDED.nombre RETURNING id`,
    [u.rows[0].id, carrera],
  );
  const p = await c.query(
    `INSERT INTO pensum (carrera_id, version) VALUES ($1, $2)
     ON CONFLICT (carrera_id, version) DO UPDATE SET version = EXCLUDED.version RETURNING id`,
    [car.rows[0].id, version],
  );

  for (const m of materias) {
    await c.query(
      `INSERT INTO pensum_materia (pensum_id, codigo, nombre, creditos, periodo_sugerido, prerrequisitos)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (pensum_id, codigo) DO UPDATE SET nombre = EXCLUDED.nombre, creditos = EXCLUDED.creditos,
         periodo_sugerido = EXCLUDED.periodo_sugerido, prerrequisitos = EXCLUDED.prerrequisitos`,
      [p.rows[0].id, m.codigo, m.nombre, m.creditos, m.periodoSugerido, m.prerrequisitos],
    );
  }

  const t = await c.query("SELECT count(*)::int n, sum(creditos)::int cr FROM pensum_materia WHERE pensum_id = $1", [p.rows[0].id]);

  await c.query("COMMIT");
  console.log(`✓ ${siglas} · ${carrera} · ${version}: ${t.rows[0].n} materias, ${t.rows[0].cr} créditos`);
} catch (e) {
  await c.query("ROLLBACK");
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
