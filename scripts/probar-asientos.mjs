// Pruebas de la validación de asientos. Node 24 quita los tipos del .ts al
// importarlo, así que se prueba el mismo archivo que usan el editor y las
// server actions.
// Uso: node --test scripts/probar-asientos.mjs
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  aCentavos,
  centavosATexto,
  esPeriodo,
  leerLineasJson,
  validarLineas,
} from "../src/lib/contabilidad/asientos.ts";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";
const linea = (cuenta_id, debe, haber, descripcion = "") => ({ cuenta_id, debe, haber, descripcion });

test("un asiento cuadrado pasa y sale normalizado", () => {
  const r = validarLineas([linea(A, "1,500.5", ""), linea(B, "", "1500.50")]);
  assert.equal(r.ok, true);
  assert.equal(r.totalDebe, "1500.50");
  assert.equal(r.totalHaber, "1500.50");
  assert.equal(r.diferencia, "0.00");
  assert.deepEqual(r.lineas, [
    { cuenta_id: A, descripcion: null, debe: "1500.50", haber: "0.00" },
    { cuenta_id: B, descripcion: null, debe: "0.00", haber: "1500.50" },
  ]);
});

test("un asiento descuadrado se rechaza con la diferencia", () => {
  const r = validarLineas([linea(A, "100", ""), linea(B, "", "99.99")]);
  assert.equal(r.ok, false);
  assert.equal(r.error, "descuadrado");
  assert.equal(r.diferencia, "0.01");
});

test("la diferencia negativa sale con signo", () => {
  const r = validarLineas([linea(A, "10", ""), linea(B, "", "12.5")]);
  assert.equal(r.error, "descuadrado");
  assert.equal(r.diferencia, "-2.50");
});

test("varias líneas por lado cuadran", () => {
  const r = validarLineas([linea(A, "70", ""), linea(B, "30", ""), linea(C, "", "100")]);
  assert.equal(r.ok, true);
});

test("redondeo a centavos, mitad hacia arriba", () => {
  assert.equal(aCentavos("10.005"), 1001n);
  assert.equal(aCentavos("10.0049"), 1000n);
  assert.equal(aCentavos("0.999"), 100n);
  assert.equal(aCentavos("1.5"), 150n);
  assert.equal(aCentavos(".25"), 25n);
  // Después de redondear, las dos líneas cuadran.
  const r = validarLineas([linea(A, "33.335", ""), linea(B, "", "33.34")]);
  assert.equal(r.ok, true);
  assert.equal(r.lineas[0].debe, "33.34");
});

test("un monto que se redondea a cero deja la línea vacía", () => {
  const r = validarLineas([linea(A, "0.004", ""), linea(B, "", "0")]);
  assert.equal(r.ok, false);
  assert.equal(r.error, "linea_vacia");
  assert.equal(r.linea, 0);
});

test("montos negativos o con texto se rechazan", () => {
  assert.equal(aCentavos("-5"), null);
  assert.equal(aCentavos("5e3"), null);
  assert.equal(aCentavos("1.2.3"), null);
  assert.equal(aCentavos("abc"), null);
  const r = validarLineas([linea(A, "-100", ""), linea(B, "", "-100")]);
  assert.equal(r.ok, false);
  assert.equal(r.error, "monto_invalido");
  assert.equal(r.linea, 0);
});

test("una línea con debe y haber a la vez se rechaza", () => {
  const r = validarLineas([linea(A, "50", "50"), linea(B, "", "0"), linea(C, "50", "")]);
  assert.equal(r.ok, false);
  assert.equal(r.error, "linea_ambos_lados");
  assert.equal(r.linea, 0);
});

test("una línea con cuenta pero sin monto se rechaza", () => {
  const r = validarLineas([linea(A, "50", ""), linea(B, "", "50"), linea(C, "", "")]);
  assert.equal(r.ok, false);
  assert.equal(r.error, "linea_vacia");
  assert.equal(r.linea, 2);
});

test("una línea con monto y sin cuenta se rechaza", () => {
  const r = validarLineas([linea(A, "50", ""), linea("", "", "50")]);
  assert.equal(r.error, "cuenta_requerida");
  assert.equal(r.linea, 1);
});

test("menos de dos líneas se rechaza, y las filas en blanco no cuentan", () => {
  assert.equal(validarLineas([]).error, "pocas_lineas");
  assert.equal(validarLineas([linea(A, "10", "")]).error, "pocas_lineas");
  const r = validarLineas([linea(A, "10", ""), linea("", "", "")]);
  assert.equal(r.error, "pocas_lineas");
});

test("0.1 + 0.2 = 0.3 sin error de float", () => {
  const r = validarLineas([linea(A, "0.1", ""), linea(B, "0.2", ""), linea(C, "", "0.3")]);
  assert.equal(r.ok, true);
  assert.equal(r.totalDebe, "0.30");
  // Diez veces 0.10 contra 1.00: en float la suma da 0.9999999999999999.
  const diez = Array.from({ length: 10 }, () => linea(A, "0.10", ""));
  assert.equal(validarLineas([...diez, linea(B, "", "1.00")]).ok, true);
});

test("montos grandes sin pérdida de precisión", () => {
  const r = validarLineas([
    linea(A, "99999999999.99", ""),
    linea(B, "0.01", ""),
    linea(C, "", "100000000000.00"),
  ]);
  assert.equal(r.ok, true);
  assert.equal(r.totalDebe, "100000000000.00");
  // El tope de NUMERIC(14,2): 12 enteros.
  assert.equal(aCentavos("999999999999.99"), 99999999999999n);
  assert.equal(aCentavos("1000000000000"), null);
  assert.equal(centavosATexto(99999999999999n), "999999999999.99");
});

test("las líneas JSON mal formadas se descartan enteras", () => {
  assert.equal(leerLineasJson("no es json"), null);
  assert.equal(leerLineasJson('{"a":1}'), null);
  assert.equal(leerLineasJson("[1, 2]"), null);
  assert.deepEqual(leerLineasJson(`[{"cuenta_id":"${A}","debe":"5","haber":""}]`), [
    { cuenta_id: A, descripcion: null, debe: "5", haber: "" },
  ]);
});

test("período YYYY-MM", () => {
  assert.equal(esPeriodo("2026-10"), true);
  assert.equal(esPeriodo("2026-13"), false);
  assert.equal(esPeriodo("2026-1"), false);
  assert.equal(esPeriodo("2026-00"), false);
});
