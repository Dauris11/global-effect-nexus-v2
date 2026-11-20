import assert from "node:assert/strict";
import test from "node:test";

import { leerCalificaciones } from "../src/lib/calificaciones.ts";

test("lee código, letra y nota opcional", () => {
  const r = leerCalificaciones("isc 101 ; a ; 95\nCIM001;B\nHUM008 | R");
  assert.equal(r.rechazadas.length, 0);
  assert.deepEqual(r.items[0], { codigo: "ISC101", letra: "A", nota: 95 });
  assert.equal(r.items[1].nota, null);
  assert.equal(r.items[2].letra, "R");
});

test("rechaza sin adivinar: código raro, letra faltante, nota fuera de rango, repetido", () => {
  const r = leerCalificaciones("XX1;A\nISC101\nISC102;A;120\nISC103;A\nisc103;B\n\n# comentario\nISC104;C;88,5");
  assert.deepEqual(r.rechazadas, [1, 2, 3, 5]);
  assert.deepEqual(r.items.map((i) => i.codigo), ["ISC103", "ISC104"]);
  assert.equal(r.items[1].nota, 88.5);
});
