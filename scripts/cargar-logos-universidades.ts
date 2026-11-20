// Sube los logos de db/datos/logos al bucket público y los enlaza en `universidad`.
// Uso: npx tsx --env-file=.env.local scripts/cargar-logos-universidades.ts
// PUCMM no venía en el catálogo inicial pero ya figura en expedientes: se crea si falta.
import { readFileSync } from "node:fs";

import { consultarUna } from "@/lib/db";
import { subirAvatar } from "@/lib/supabase/almacen";

const LOGOS = [
  { siglas: "UCATECI", archivo: "ucateci.png" },
  { siglas: "UNPHU", archivo: "unphu.jpg" },
  { siglas: "UTESA", archivo: "utesa.png" },
  { siglas: "UASD", archivo: "uasd.png" },
  { siglas: "PUCMM", archivo: "pucmm.png", nombre: "Pontificia Universidad Católica Madre y Maestra" },
];

for (const l of LOGOS) {
  let u = await consultarUna<{ id: string }>("SELECT id FROM universidad WHERE siglas = $1", [l.siglas]);

  if (!u && l.nombre) {
    u = await consultarUna<{ id: string }>("INSERT INTO universidad (siglas, nombre) VALUES ($1, $2) RETURNING id", [l.siglas, l.nombre]);
    console.log(`+ creada ${l.siglas}`);
  }

  if (!u) { console.log(`- sin universidad ${l.siglas}`); continue; }

  const ext = l.archivo.split(".").pop()!;
  const tipo = ext === "jpg" ? "image/jpeg" : "image/png";
  const ruta = `universidades/${u.id}.${ext}`;
  const r = await subirAvatar(ruta, new File([readFileSync(`db/datos/logos/${l.archivo}`)], l.archivo, { type: tipo }));

  if (!r.ok) { console.log(`✗ ${l.siglas}: no se pudo subir`); continue; }

  await consultarUna("UPDATE universidad SET logo_ruta = $2 WHERE id = $1 RETURNING id", [u.id, `${ruta}?v=${Date.now()}`]);
  console.log(`✓ ${l.siglas}`);
}

// Enlaza expedientes cuyo texto menciona PUCMM.
const e = await consultarUna<{ n: string }>(
  `WITH x AS (UPDATE estudiante e SET universidad_id = u.id FROM universidad u
              WHERE u.siglas = 'PUCMM' AND e.universidad_id IS NULL AND e.universidad ILIKE '%PUCMM%' RETURNING 1)
   SELECT count(*)::text AS n FROM x`,
);

console.log(`expedientes enlazados a PUCMM: ${e?.n}`);
process.exit(0);
