// Pruebas de src/lib/contabilidad/identificacion.ts (npm run test:contabilidad).
//
// Los números válidos se arman con el propio algoritmo a partir de una base
// y luego se comprueba que CUALQUIER otro dígito final se rechace. Así la
// prueba no depende de copiar RNC o cédulas de personas reales.
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  cedulaValida,
  formatearIdentificacion,
  identificacionValida,
  limpiarIdentificacion,
  ncfValido,
  rncValido,
} from "../src/lib/contabilidad/identificacion.ts";

const conDigito = (base, valida) =>
  [...Array(10).keys()].map((d) => base + d).filter(valida);

test("RNC: exactamente un dígito verificador válido por base", () => {
  for (const base of ["13112345", "40150625", "10101063", "00000000", "99999999"]) {
    assert.equal(conDigito(base, rncValido).length, 1, base);
  }
});

test("RNC: casos del algoritmo de la DGII (resto 0 → 2, resto 1 → 1)", () => {
  // 7*1+9*0+8*0+... = 7 → resto 7 → dígito 4
  assert.ok(rncValido("100000004"));
  assert.ok(!rncValido("100000005"));
  // suma 11 → resto 0 → dígito 2: 7*0+9*0+8*0+6*0+5*0+4*0+3*1+2*4 = 11
  assert.ok(rncValido("000000142"));
  // suma 12 → resto 1 → dígito 1: 3*2+2*3 = 12
  assert.ok(rncValido("000000231"));
});

test("RNC: formato", () => {
  assert.ok(!rncValido("12345678"));
  assert.ok(!rncValido("1234567890"));
  assert.ok(!rncValido("13112345A"));
  assert.ok(rncValido("1-00-00000-4"), "con guiones");
});

test("Cédula: exactamente un dígito verificador válido por base (Luhn)", () => {
  for (const base of ["0011391820", "4020000000", "0010000000", "2230000123"]) {
    assert.equal(conDigito(base, cedulaValida).length, 1, base);
  }
  // 0010000000: pesos 1,2,1,2… → solo el tercer dígito (1*1) suma → 1 → dígito 9
  assert.ok(cedulaValida("00100000009"));
  assert.ok(cedulaValida("001-0000000-9"));
  assert.ok(!cedulaValida("00100000008"));
  assert.ok(!cedulaValida("0010000000"));
});

test("Por tipo de proveedor", () => {
  assert.ok(identificacionValida("100000004", "juridica"));
  assert.ok(!identificacionValida("100000004", "fisica"));
  assert.ok(identificacionValida("00100000009", "fisica"));
});

test("Formato de presentación", () => {
  assert.equal(limpiarIdentificacion(" 1-31-12345-6 "), "131123456");
  assert.equal(formatearIdentificacion("131123456"), "1-31-12345-6");
  assert.equal(formatearIdentificacion("00113918205"), "001-1391820-5");
});

test("NCF y e-CF", () => {
  assert.ok(ncfValido("B0100000001"));
  assert.ok(ncfValido("E310000000001"));
  assert.ok(!ncfValido("B010000001"), "10 caracteres");
  assert.ok(!ncfValido("E31000000001"), "12 caracteres");
  assert.ok(!ncfValido("A0100000001"));
  assert.ok(!ncfValido("b0100000001"));
});
