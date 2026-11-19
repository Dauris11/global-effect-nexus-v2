import assert from "node:assert/strict";
import test from "node:test";

import { leerListaDePensum } from "../src/lib/pensum.ts";

test("lee líneas con ; y tabulador, y los prerrequisitos", () => {
  const r = leerListaDePensum("isc-101;Intro a la programación;4;1\nISC-201\tEstructuras;3;2;isc-101, MAT-101");
  assert.equal(r.rechazadas.length, 0);
  assert.equal(r.materias[0].codigo, "ISC-101");
  assert.equal(r.materias[0].creditos, 4);
  assert.deepEqual(r.materias[1].prerrequisitos, ["ISC-101", "MAT-101"]);
});

test("créditos vacíos = 3; período vacío = sin período", () => {
  const r = leerListaDePensum("A1;Algo");
  assert.equal(r.materias[0].creditos, 3);
  assert.equal(r.materias[0].periodoSugerido, null);
});

test("rechaza sin adivinar: faltan campos, créditos raros, código repetido", () => {
  const r = leerListaDePensum("SOLO\nB1;Mate;abc\nC1;Hola;3;0\nD1;Uno;3\nd1;Repetida;3\n\nE1;Ok;2;5");
  assert.deepEqual(r.rechazadas, [1, 2, 3, 5]);
  assert.deepEqual(r.materias.map((m) => m.codigo), ["D1", "E1"]);
});

test("un código no es prerrequisito de sí mismo", () => {
  assert.deepEqual(leerListaDePensum("X1;Y;3;1;x1,Z9").materias[0].prerrequisitos, ["Z9"]);
});
