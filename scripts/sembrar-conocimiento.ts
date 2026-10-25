// Carga el reglamento institucional a la base de conocimiento de los agentes.
// Idempotente: si el documento ya existe (mismo título), no hace nada.
// Las normas fiscales de Contabilidad NO se siembran: las carga quien las
// verifica (configuracion/conocimiento), para no poner en boca del agente una
// ley transcrita de memoria.
// Uso: npx tsx scripts/sembrar-conocimiento.ts
import { randomUUID } from "node:crypto";

import { config } from "dotenv";

config({ path: ".env.local" });

const { consultarUna, enTransaccion, pool } = await import("../src/lib/db");
const { REGLAMENTO_FUNDACION } = await import("../src/server/ia/reglamento");
const { trocear, AGENTES_CLAVES } = await import("../src/lib/ia-conocimiento");

const TITULO = "Reglamento institucional y política de becas";

const ya = await consultarUna("SELECT 1 FROM fragmento_conocimiento WHERE titulo = $1 LIMIT 1", [TITULO]);

if (ya) {
  console.log("= ya cargado:", TITULO);
} else {
  const trozos = trocear(REGLAMENTO_FUNDACION);
  const id = randomUUID();

  await enTransaccion(async (cliente) => {
    for (const trozo of trozos) {
      await cliente.query(
        `INSERT INTO fragmento_conocimiento
           (fuente_tipo, fuente_id, titulo, fuente, version, contenido, agentes, verificado_el)
         VALUES ('documento', $1, $2, 'Reglamento de la Fundación Global Effect', '2026-10', $3, $4, current_date)`,
        [id, TITULO, trozo, [...AGENTES_CLAVES]],
      );
    }
  });

  console.log(`+ cargado: ${TITULO} (${trozos.length} fragmentos, ${AGENTES_CLAVES.length} agentes)`);
}

await pool.end();
