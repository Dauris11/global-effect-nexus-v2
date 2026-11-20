// Sube los logos de db/datos/logos al bucket público y los enlaza en `universidad`.
// Uso: npx tsx --env-file=.env.local scripts/cargar-logos-universidades.ts
// Solo las universidades del programa; las que no existan en el catálogo se omiten.
import { readFileSync } from "node:fs";

import { consultarUna } from "@/lib/db";
import { subirAvatar } from "@/lib/supabase/almacen";

const LOGOS = [
  { siglas: "UCATECI", archivo: "ucateci.png" },
  { siglas: "UNPHU", archivo: "unphu.jpg" },
  { siglas: "UTESA", archivo: "utesa.png" },
  { siglas: "UASD", archivo: "uasd.png" },
];

for (const l of LOGOS) {
  const u = await consultarUna<{ id: string }>("SELECT id FROM universidad WHERE siglas = $1", [l.siglas]);

  if (!u) { console.log(`- sin universidad ${l.siglas}`); continue; }

  const ext = l.archivo.split(".").pop()!;
  const tipo = ext === "jpg" ? "image/jpeg" : "image/png";
  const ruta = `universidades/${u.id}.${ext}`;
  const r = await subirAvatar(ruta, new File([readFileSync(`db/datos/logos/${l.archivo}`)], l.archivo, { type: tipo }));

  if (!r.ok) { console.log(`✗ ${l.siglas}: no se pudo subir`); continue; }

  await consultarUna("UPDATE universidad SET logo_ruta = $2 WHERE id = $1 RETURNING id", [u.id, `${ruta}?v=${Date.now()}`]);
  console.log(`✓ ${l.siglas}`);
}

process.exit(0);
