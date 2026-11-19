// Pruebas de la antigüedad de un estudiante en la Fundación.
// Uso: node --test scripts/probar-antiguedad.mjs
import { test } from "node:test";
import assert from "node:assert/strict";

import { antiguedad } from "../src/lib/antiguedad.ts";

test("años, meses y días cumplidos", () => {
  assert.deepEqual(antiguedad("2025-03-12", "2026-11-19"), { anios: 1, meses: 8, dias: 7 });
  assert.deepEqual(antiguedad("2026-11-19", "2026-11-19"), { anios: 0, meses: 0, dias: 0 });
  assert.deepEqual(antiguedad("2026-11-01", "2026-11-19"), { anios: 0, meses: 0, dias: 18 });
  assert.deepEqual(antiguedad("2016-01-15", "2026-11-19"), { anios: 10, meses: 10, dias: 4 });
});

test("el mes aún no se cumple si no llegó el día", () => {
  assert.deepEqual(antiguedad("2026-09-25", "2026-11-19"), { anios: 0, meses: 1, dias: 25 });
});

test("sin fecha, inválida o futura: null (no se inventa)", () => {
  assert.equal(antiguedad(null, "2026-11-19"), null);
  assert.equal(antiguedad("", "2026-11-19"), null);
  assert.equal(antiguedad("no-es-fecha", "2026-11-19"), null);
  assert.equal(antiguedad("2026-02-31", "2026-11-19"), null);
  assert.equal(antiguedad("2027-01-01", "2026-11-19"), null);
});

test("29 de febrero: el aniversario cae el 28 en un año sin bisiesto", () => {
  assert.deepEqual(antiguedad("2024-02-29", "2025-02-28"), { anios: 1, meses: 0, dias: 0 });
  assert.deepEqual(antiguedad("2024-02-29", "2025-02-27"), { anios: 0, meses: 11, dias: 29 });
  assert.deepEqual(antiguedad("2024-02-29", "2028-02-29"), { anios: 4, meses: 0, dias: 0 });
});

test("día 31 en meses cortos", () => {
  assert.deepEqual(antiguedad("2026-01-31", "2026-02-28"), { anios: 0, meses: 1, dias: 0 });
  assert.deepEqual(antiguedad("2026-01-31", "2026-03-30"), { anios: 0, meses: 1, dias: 30 });
});
