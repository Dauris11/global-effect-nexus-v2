// Prueba de la carga guiada de calificaciones contra la base: borrador, emparejamiento,
// asignación a mano, confirmación y alertas. Crea un estudiante TEMPORAL de UCATECI y
// lo borra al final (con sus resultados y su carga), así que no toca récords reales.
// Uso: npx tsx scripts/probar-carga-calificaciones-bd.ts
import assert from "node:assert/strict";

import { config } from "dotenv";

config({ path: ".env.local" });

const { consultar, consultarUna, pool } = await import("../src/lib/db");
const { filasDeLista } = await import("../src/lib/carga-calificaciones");
const { asignarEstudianteAFila, confirmarCarga, guardarBorrador, universidadDeCarga } = await import("../src/server/universidades/carga-nucleo");

const uni = await consultarUna<{ id: string }>(`SELECT id FROM universidad WHERE siglas = 'UCATECI'`);
const universidad = uni ? await universidadDeCarga(uni.id) : null;

assert.ok(universidad, "falta UCATECI");

const pensum = await consultarUna<{ id: string }>(
  `SELECT p.id FROM pensum p JOIN carrera c ON c.id = p.carrera_id WHERE c.universidad_id = $1 AND c.nombre = 'Ingeniería en Sistemas de Computación'`,
  [universidad.id],
);

assert.ok(pensum, "falta el pénsum ISC de UCATECI");

const materias = await consultar<{ codigo: string; nombre: string; creditos: number }>(
  `SELECT codigo, nombre, creditos FROM pensum_materia WHERE pensum_id = $1 AND creditos > 0 ORDER BY codigo LIMIT 3`,
  [pensum.id],
);
const carrera = await consultarUna<{ id: string }>(`SELECT carrera_id AS id FROM pensum WHERE id = $1`, [pensum.id]);
const matricula = "9999-0001";
const est = await consultarUna<{ id: string }>(
  `INSERT INTO estudiante (nombre, matricula, universidad_id, carrera_id, pensum_id) VALUES ('Zzprueba Carga Temporal', $1, $2, $3, $4) RETURNING id`,
  [matricula, universidad.id, carrera!.id, pensum.id],
);
const usuario = await consultarUna<{ id: string }>(`SELECT id FROM usuario ORDER BY created_at LIMIT 1`);
const cargas: string[] = [];
let fallo: unknown = null;

try {
  // 1. Matrícula con otro formato, nombre en otro orden, código con espacio; una letra inventada y una materia que no es del pénsum.
  const lista = [
    `99990001 ; TEMPORAL ZZPRUEBA CARGA ; ${materias[0].codigo.slice(0, 3)} ${materias[0].codigo.slice(3)} ; F ; 40`,
    `9999-0001 ; Zzprueba Carga Temporal ; ${materias[1].codigo} ; A ; 95`,
    `9999-0001 ; Zzprueba Carga Temporal ; ${materias[2].codigo} ; Q`,
    `9999-0001 ; Zzprueba Carga Temporal ; XXX999 ; A`,
    `0000-0000 ; Persona Que No Existe ; ${materias[0].codigo} ; A`,
  ].join("\n");
  const r = await guardarBorrador({ universidad, anio: 2025, ronda: 1, medio: "lista", filas: filasDeLista(lista), usuarioId: usuario!.id });

  cargas.push(r.cargaId);
  assert.equal(r.filas, 5);
  assert.equal(r.sinEmparejar, 1, "solo la persona inexistente queda sin emparejar");

  const filas = await consultar<{ orden: number; estudiante_id: string | null; problemas: string[]; emparejado_por: string | null }>(
    `SELECT orden, estudiante_id, problemas, emparejado_por FROM carga_calificaciones_fila WHERE carga_id = $1 ORDER BY orden`,
    [r.cargaId],
  );

  assert.equal(filas[0].estudiante_id, est!.id);
  assert.equal(filas[0].emparejado_por, "matricula");
  assert.deepEqual(filas[0].problemas, []);
  assert.deepEqual(filas[2].problemas, ["letra_invalida"]);
  assert.deepEqual(filas[3].problemas, ["materia_fuera_del_pensum"]);
  assert.deepEqual(filas[4].problemas, ["sin_estudiante"]);

  // 2. Un estudiante con filas malas no se escribe (todo o nada).
  const c1 = await confirmarCarga(r.cargaId, usuario!.id);

  assert.equal(c1.estado, "ok");
  if (c1.estado === "ok") {
    assert.equal(c1.estudiantesEscritos, 0);
    assert.equal(c1.estudiantesOmitidos, 1);
    assert.equal(c1.filasSinEstudiante, 1);
  }
  assert.equal((await consultar(`SELECT 1 FROM resultado_materia WHERE estudiante_id = $1`, [est!.id])).length, 0);

  // 3. Carga limpia: se escribe, queda `fuente = 'carga'` y salta la alerta por el índice del período.
  const limpia = [`9999-0001 ; Zzprueba Carga Temporal ; ${materias[0].codigo} ; F ; 40`, `9999-0001 ; Zzprueba Carga Temporal ; ${materias[1].codigo} ; D`].join("\n");
  const r2 = await guardarBorrador({ universidad, anio: 2025, ronda: 2, medio: "lista", filas: filasDeLista(limpia), usuarioId: usuario!.id });

  cargas.push(r2.cargaId);

  const c2 = await confirmarCarga(r2.cargaId, usuario!.id);

  assert.equal(c2.estado, "ok");
  if (c2.estado === "ok") {
    assert.equal(c2.notasEscritas, 2);
    assert.ok(c2.alertas.some((a) => a.tipo === "periodo"), "índice del período bajo el mínimo");
    assert.ok(c2.alertas.some((a) => a.tipo === "acumulado"), "índice acumulado bajo el mínimo");
  }

  const guardadas = await consultar<{ fuente: string; letra: string }>(`SELECT fuente, letra FROM resultado_materia WHERE estudiante_id = $1`, [est!.id]);

  assert.equal(guardadas.length, 2);
  assert.ok(guardadas.every((g) => g.fuente === "carga"));

  // Una carga ya confirmada no se confirma dos veces.
  assert.equal((await confirmarCarga(r2.cargaId, usuario!.id)).estado, "no_encontrada");

  // 4. Asignar a mano una fila sin emparejar; un estudiante de otra universidad se rechaza.
  const r3 = await guardarBorrador({ universidad, anio: 2025, ronda: 3, medio: "lista", filas: filasDeLista(`0000-0000 ; Persona Que No Existe ; ${materias[2].codigo} ; B`), usuarioId: usuario!.id });

  cargas.push(r3.cargaId);

  const fila = await consultarUna<{ id: string }>(`SELECT id FROM carga_calificaciones_fila WHERE carga_id = $1`, [r3.cargaId]);

  assert.equal(await asignarEstudianteAFila(fila!.id, est!.id), "ok");

  const asignada = await consultarUna<{ estudiante_id: string; emparejado_por: string; problemas: string[] }>(`SELECT estudiante_id, emparejado_por, problemas FROM carga_calificaciones_fila WHERE id = $1`, [fila!.id]);

  assert.equal(asignada!.emparejado_por, "manual");
  assert.deepEqual(asignada!.problemas, []);

  const otra = await consultarUna<{ id: string }>(`SELECT e.id FROM estudiante e WHERE e.universidad_id IS DISTINCT FROM $1 LIMIT 1`, [universidad.id]);

  if (otra) assert.equal(await asignarEstudianteAFila(fila!.id, otra.id), "estudiante_de_otra_universidad");

  console.log("✓ carga de calificaciones: borrador, emparejamiento, todo o nada, alertas y asignación a mano");
} catch (error) {
  fallo = error;
} finally {
  await consultar(`DELETE FROM carga_calificaciones WHERE id = ANY($1::uuid[])`, [cargas]);
  await consultar(`DELETE FROM estudiante WHERE id = $1`, [est!.id]);
  await pool.end();
}

if (fallo) {
  console.error("✗", fallo);
  process.exit(1);
}
