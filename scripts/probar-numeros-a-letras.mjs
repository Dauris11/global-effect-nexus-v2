// Pruebas del monto en letras. Node 24 quita los tipos del .ts al importarlo,
// así que se prueba el mismo archivo que usa la app, sin compilar.
// Uso: node --test scripts/probar-numeros-a-letras.mjs
import { test } from "node:test";
import assert from "node:assert/strict";

import { montoEnLetras } from "../src/lib/contabilidad/numeros-a-letras.ts";

const casosEs = [
  ["0", "DOP", "CERO PESOS DOMINICANOS CON 00/100"],
  ["1", "DOP", "UN PESO DOMINICANO CON 00/100"],
  ["1", "USD", "UN DÓLAR ESTADOUNIDENSE CON 00/100"],
  ["21", "DOP", "VEINTIÚN PESOS DOMINICANOS CON 00/100"],
  ["16", "DOP", "DIECISÉIS PESOS DOMINICANOS CON 00/100"],
  ["22.00", "USD", "VEINTIDÓS DÓLARES ESTADOUNIDENSES CON 00/100"],
  ["31", "DOP", "TREINTA Y UN PESOS DOMINICANOS CON 00/100"],
  ["100", "DOP", "CIEN PESOS DOMINICANOS CON 00/100"],
  ["101", "DOP", "CIENTO UN PESOS DOMINICANOS CON 00/100"],
  ["579", "DOP", "QUINIENTOS SETENTA Y NUEVE PESOS DOMINICANOS CON 00/100"],
  ["700", "DOP", "SETECIENTOS PESOS DOMINICANOS CON 00/100"],
  ["900", "DOP", "NOVECIENTOS PESOS DOMINICANOS CON 00/100"],
  ["1000", "DOP", "MIL PESOS DOMINICANOS CON 00/100"],
  ["1234.5", "DOP", "MIL DOSCIENTOS TREINTA Y CUATRO PESOS DOMINICANOS CON 50/100"],
  ["1234.50", "USD", "MIL DOSCIENTOS TREINTA Y CUATRO DÓLARES ESTADOUNIDENSES CON 50/100"],
  ["21000", "DOP", "VEINTIÚN MIL PESOS DOMINICANOS CON 00/100"],
  ["101000", "DOP", "CIENTO UN MIL PESOS DOMINICANOS CON 00/100"],
  ["1000000.00", "DOP", "UN MILLÓN DE PESOS DOMINICANOS CON 00/100"],
  ["2000000", "USD", "DOS MILLONES DE DÓLARES ESTADOUNIDENSES CON 00/100"],
  ["1001000", "DOP", "UN MILLÓN MIL PESOS DOMINICANOS CON 00/100"],
  ["21000000", "DOP", "VEINTIÚN MILLONES DE PESOS DOMINICANOS CON 00/100"],
  ["0.5", "DOP", "CERO PESOS DOMINICANOS CON 50/100"],
  ["10.05", "DOP", "DIEZ PESOS DOMINICANOS CON 05/100"],
  ["0.29", "DOP", "CERO PESOS DOMINICANOS CON 29/100"],
  [
    "999999999999.99",
    "DOP",
    "NOVECIENTOS NOVENTA Y NUEVE MIL NOVECIENTOS NOVENTA Y NUEVE MILLONES NOVECIENTOS NOVENTA Y NUEVE MIL NOVECIENTOS NOVENTA Y NUEVE PESOS DOMINICANOS CON 99/100",
  ],
  ["1000000000", "DOP", "MIL MILLONES DE PESOS DOMINICANOS CON 00/100"],
];

const casosEn = [
  ["0", "USD", "ZERO US DOLLARS AND 00/100"],
  ["1", "USD", "ONE US DOLLAR AND 00/100"],
  ["1", "DOP", "ONE DOMINICAN PESO AND 00/100"],
  ["21", "DOP", "TWENTY-ONE DOMINICAN PESOS AND 00/100"],
  ["100", "USD", "ONE HUNDRED US DOLLARS AND 00/100"],
  ["101", "USD", "ONE HUNDRED ONE US DOLLARS AND 00/100"],
  ["1000", "DOP", "ONE THOUSAND DOMINICAN PESOS AND 00/100"],
  ["1234.5", "DOP", "ONE THOUSAND TWO HUNDRED THIRTY-FOUR DOMINICAN PESOS AND 50/100"],
  ["21000", "USD", "TWENTY-ONE THOUSAND US DOLLARS AND 00/100"],
  ["1000000", "USD", "ONE MILLION US DOLLARS AND 00/100"],
  ["2000000", "DOP", "TWO MILLION DOMINICAN PESOS AND 00/100"],
  ["1001000", "USD", "ONE MILLION ONE THOUSAND US DOLLARS AND 00/100"],
  ["0.5", "USD", "ZERO US DOLLARS AND 50/100"],
  ["10.05", "USD", "TEN US DOLLARS AND 05/100"],
  [
    "999999999999.99",
    "USD",
    "NINE HUNDRED NINETY-NINE BILLION NINE HUNDRED NINETY-NINE MILLION NINE HUNDRED NINETY-NINE THOUSAND NINE HUNDRED NINETY-NINE US DOLLARS AND 99/100",
  ],
];

for (const [monto, moneda, esperado] of casosEs) {
  test(`es ${moneda} ${monto}`, () => assert.equal(montoEnLetras(monto, moneda, "es"), esperado));
}

for (const [monto, moneda, esperado] of casosEn) {
  test(`en ${moneda} ${monto}`, () => assert.equal(montoEnLetras(monto, moneda, "en"), esperado));
}

test("rechaza negativos, texto, más de dos decimales y montos fuera de rango", () => {
  for (const malo of ["-1", "abc", "", "1,5", "1e3", "1.234", "1000000000000"]) {
    assert.throws(() => montoEnLetras(malo, "DOP", "es"), Error, `debió fallar con "${malo}"`);
  }
});

test("acepta ceros de relleno más allá del segundo decimal", () => {
  assert.equal(montoEnLetras("5.500", "DOP", "es"), "CINCO PESOS DOMINICANOS CON 50/100");
});
