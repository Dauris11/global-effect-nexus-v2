// Carga (o recarga) los documentos de prueba de la base de conocimiento.
// Uso: node --env-file=.env.local scripts/sembrar-conocimiento-prueba.mjs [--borrar]
// Idempotente: cada documento tiene un id fijo derivado de su título, así que
// volver a correrlo lo reemplaza. `--borrar` quita todos los «[PRUEBA]».
import { createHash } from "node:crypto";

import pg from "pg";

import { DOCUMENTOS } from "../db/datos/conocimiento-prueba.mjs";
import { revisarEntrada } from "../src/lib/ia-seguridad.ts";
import { trocear } from "../src/lib/ia-conocimiento.ts";

const idDe = (titulo) => {
  const h = createHash("sha1").update(`prueba:${titulo}`).digest("hex");

  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });

await c.connect();
await c.query("BEGIN");

try {
  const borradas = await c.query(
    "DELETE FROM fragmento_conocimiento WHERE fuente_tipo = 'documento' AND titulo LIKE '[PRUEBA]%'",
  );

  if (process.argv.includes("--borrar")) {
    await c.query("COMMIT");
    console.log(`✓ ${borradas.rowCount} fragmentos de prueba borrados`);
    await c.end();
    process.exit(0);
  }

  let fragmentos = 0;

  for (const d of DOCUMENTOS) {
    // Los documentos de prueba pasan por la misma revisión que el formulario: si
    // uno se rechazara aquí, también se rechazaría al cargarlo a mano.
    for (const campo of [d.titulo, d.fuente, d.version, d.texto]) {
      const r = revisarEntrada(campo);

      if (!r.ok) throw new Error(`«${d.titulo}» rechazado por la capa de seguridad: ${r.motivo}`);
    }

    const id = idDe(d.titulo);

    for (const [orden, trozo] of trocear(d.texto).entries()) {
      await c.query(
        `INSERT INTO fragmento_conocimiento
           (fuente_tipo, fuente_id, titulo, fuente, version, contenido, agentes,
            vigente_hasta, verificado_el, activo, orden)
         VALUES ('documento', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [id, d.titulo, d.fuente, d.version, trozo, d.agentes, d.vigente ?? null, d.verificado ?? null, d.activo ?? true, orden],
      );
      fragmentos++;
    }
  }

  await c.query("COMMIT");
  console.log(`✓ ${DOCUMENTOS.length} documentos de prueba, ${fragmentos} fragmentos`);
} catch (e) {
  await c.query("ROLLBACK");
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
