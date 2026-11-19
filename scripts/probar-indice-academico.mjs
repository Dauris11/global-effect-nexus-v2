import assert from "node:assert/strict";
import test from "node:test";

import { calcularIndice, leerPuntosPorLetra } from "../src/lib/indice-academico.ts";

const ucateci = { puntosPorLetra: { A: 4, B: 3, C: 2, D: 1, F: 0 }, retiradaCuentaEnDivisor: true, redondeo: "truncar" };

test("caso real UCATECI: 746 puntos sobre 209 créditos (206 + 3 de una R) da 3,56", () => {
  // 206 créditos con 746 puntos: 182 cr en A (728) + 6 cr en C (12)… se arma con
  // letras para ejercitar la regla completa.
  const cursadas = [
    { creditos: 182, resultado: "A" }, // 728
    { creditos: 6, resultado: "B" }, // 18  → 746
    { creditos: 18, resultado: "F" }, // 0 puntos, pesa en el divisor
    { creditos: 3, resultado: "R" },
  ];
  const r = calcularIndice(cursadas, ucateci);
  assert.equal(r.puntos, 746);
  assert.equal(r.creditosDivisor, 209);
  assert.equal(r.indice, 3.56);
});

test("sin contar la retirada en el divisor el mismo historial da 3,62", () => {
  const r = calcularIndice(
    [{ creditos: 182, resultado: "A" }, { creditos: 6, resultado: "B" }, { creditos: 18, resultado: "F" }, { creditos: 3, resultado: "R" }],
    { ...ucateci, retiradaCuentaEnDivisor: false },
  );
  assert.equal(r.indice, 3.62);
});

test("redondear en vez de truncar", () => {
  const r = calcularIndice([{ creditos: 209, resultado: "A" }], ucateci);
  assert.equal(r.indice, 4);
  const r2 = calcularIndice([{ creditos: 3, resultado: "A" }, { creditos: 3, resultado: "B" }, { creditos: 3, resultado: "B" }], ucateci);
  assert.equal(r2.indice, 3.33);
  assert.equal(calcularIndice([{ creditos: 3, resultado: "A" }, { creditos: 3, resultado: "A" }, { creditos: 3, resultado: "B" }], { ...ucateci, redondeo: "redondear" }).indice, 3.67);
  assert.equal(calcularIndice([{ creditos: 3, resultado: "A" }, { creditos: 3, resultado: "A" }, { creditos: 3, resultado: "B" }], ucateci).indice, 3.66);
});

test("seminario P con 0 créditos no pesa y una letra desconocida con créditos se avisa", () => {
  const r = calcularIndice([{ creditos: 0, resultado: "P" }, { creditos: 3, resultado: "Z" }, { creditos: 3, resultado: "A" }], ucateci);
  assert.equal(r.indice, 4);
  assert.deepEqual(r.sinRegla, ["Z"]);
});

test("sin créditos no hay índice", () => {
  assert.equal(calcularIndice([], ucateci).indice, null);
});

test("lee la escala de un formulario y rechaza lo raro", () => {
  assert.deepEqual(leerPuntosPorLetra("a=4, B=3,C=2,D=1,F=0"), { A: 4, B: 3, C: 2, D: 1, F: 0 });
  assert.equal(leerPuntosPorLetra("A=cuatro"), null);
  assert.equal(leerPuntosPorLetra("R=1"), null);
  assert.equal(leerPuntosPorLetra(""), null);
});
