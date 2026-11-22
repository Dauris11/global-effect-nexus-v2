// Prueba contra la base de las herramientas de Elly para poner notas a UN estudiante:
// buscar, ver lo que le falta y registrar (todo o nada). Crea un estudiante TEMPORAL y lo borra.
// Uso: npx tsx scripts/probar-notas-elly-bd.ts
import assert from "node:assert/strict";

import { config } from "dotenv";

config({ path: ".env.local" });

const { consultar, consultarUna, pool } = await import("../src/lib/db");
const { buscarHerramienta } = await import("../src/server/ia/herramientas");

const uni = await consultarUna<{ id: string }>(`SELECT id FROM universidad WHERE siglas = 'UCATECI'`);
const pensum = await consultarUna<{ id: string; carrera_id: string }>(
  `SELECT p.id, p.carrera_id FROM pensum p JOIN carrera c ON c.id = p.carrera_id WHERE c.universidad_id = $1 AND c.nombre = 'Ingeniería en Sistemas de Computación'`,
  [uni!.id],
);
const est = await consultarUna<{ id: string }>(
  `INSERT INTO estudiante (nombre, matricula, universidad_id, carrera_id, pensum_id) VALUES ('Zzprueba Notas Temporal', '9999-0002', $1, $2, $3) RETURNING id`,
  [uni!.id, pensum!.carrera_id, pensum!.id],
);
const admin = await consultarUna<{ id: string; nombre: string }>(`SELECT u.id, u.nombre FROM usuario u JOIN rol r ON r.id = u.rol_id WHERE r.nombre = 'super_admin' ORDER BY u.created_at LIMIT 1`);
const usuario = { id: admin!.id, nombre: admin!.nombre, rol: "super_admin" as const, idioma: "es" as const };
const ctx = { agente: "agente_direccion" };
let fallo: unknown = null;

try {
  const buscar = await buscarHerramienta("buscar_estudiantes")!.ejecutar(usuario as never, { texto: "Zzprueba" }, ctx);

  assert.ok(buscar.ok && buscar.texto.includes(est!.id), "buscar por nombre");
  assert.ok((await buscarHerramienta("buscar_estudiantes")!.ejecutar(usuario as never, { texto: "99990002" }, ctx)).texto.includes(est!.id), "buscar por matrícula con otro formato");

  const pend = await buscarHerramienta("materias_pendientes_estudiante")!.ejecutar(usuario as never, { estudiante_id: est!.id }, ctx);
  const datos = JSON.parse(pend.texto) as { letras: string[]; faltan: { codigo: string }[] };

  assert.ok(datos.faltan.length > 100 && datos.letras.includes("A"));

  const [a, b] = datos.faltan;
  const reg = buscarHerramienta("registrar_calificaciones_estudiante")!;

  // Una materia que no es de su plan: no se guarda NADA (ni la buena).
  const mala = await reg.ejecutar(usuario as never, { estudiante_id: est!.id, periodo: "2025-1", calificaciones: [{ codigo: a.codigo, letra: "A" }, { codigo: "XXX999", letra: "A" }] }, ctx);

  assert.equal(mala.ok, false);
  assert.equal((await consultar(`SELECT 1 FROM resultado_materia WHERE estudiante_id = $1`, [est!.id])).length, 0);

  const buena = await reg.ejecutar(usuario as never, { estudiante_id: est!.id, periodo: "2025-1", calificaciones: [{ codigo: a.codigo, letra: "A", nota: "95" }, { codigo: b.codigo.toLowerCase(), letra: "B" }] }, ctx);

  assert.ok(buena.ok, buena.texto);

  const guardadas = await consultar<{ codigo: string; letra: string; fuente: string }>(`SELECT codigo, letra, fuente FROM resultado_materia WHERE estudiante_id = $1`, [est!.id]);

  assert.equal(guardadas.length, 2);

  // Lo ya dado deja de «faltar».
  const despues = JSON.parse((await buscarHerramienta("materias_pendientes_estudiante")!.ejecutar(usuario as never, { estudiante_id: est!.id }, ctx)).texto) as { faltan: { codigo: string }[] };

  assert.equal(despues.faltan.length, datos.faltan.length - 2);
  console.log("✓ Elly: buscar, materias que faltan y poner notas a un estudiante (todo o nada)");
} catch (error) {
  fallo = error;
} finally {
  await consultar(`DELETE FROM notificacion WHERE enlace = $1`, [`/expedientes/${est!.id}`]);
  await consultar(`DELETE FROM estudiante WHERE id = $1`, [est!.id]);
  await pool.end();
}

if (fallo) {
  console.error("✗", fallo);
  process.exit(1);
}
