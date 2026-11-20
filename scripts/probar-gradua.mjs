import assert from "node:assert/strict";
import test from "node:test";

import { etiquetaPeriodo, leerEtiquetaPeriodo, leerGradua, nombresParecidos, normalizarVersion, soloDigitos } from "../src/lib/gradua.ts";

// Texto sintético con la forma del reporte de UCATECI (sin datos de nadie).
const PAGINA = [
  "Período Código Asignaturas Crédit\nos Puntos Período/Calificación",
  "SEM1",
  "CIF009 FISICA INTRODUCTORIA 3 6 R2 2023 C",
  "HUM002 ESPAÑOL I 4 16 R1 2023 A",
  "7 22",
  "ELE013",
  "ISC123 LENGUAJE DE PROGRAMACION 0 0",
  "ISC125 DESARROLLO DE PAGINAS WEBS 0 0",
  "ELE015",
  "ISC127 INTELIGENCIA ARTIFICIAL 2 8 R1 2026 A",
  "ISC129 INTELIGENCIA DE NEGOCIOS 0 0",
  "SEM9",
  "HUM008 METODOLOGIA DE LA INVESTIGACION 3 0 R2 2026 R",
  "ISC031 SEMINARIO III 0 0 R3 2024 P",
  "ISC029 SISTEMAS DE INFORMACION GERENCIAL 0 0",
  "NOMBRE DE PRUEBA20230001 ISC-R-2-2019Versión:",
  "Total 12 30",
  "Índice General: 2.50",
].join("\n");

test("lee cabecera, filas, total e índice", () => {
  const g = leerGradua([PAGINA]);
  assert.ok(g);
  assert.equal(g.matricula, "20230001");
  assert.equal(g.nombre, "NOMBRE DE PRUEBA");
  assert.equal(g.version, "ISC-R-2-2019");
  assert.equal(g.indiceReportado, 2.5);
  assert.equal(g.creditosReportados, 12);
  assert.equal(g.puntosReportados, 30);
});

test("las no cursadas no se guardan pero se cuentan", () => {
  const g = leerGradua([PAGINA]);
  assert.equal(g.noCursadas, 4); // ISC123, ISC125, ISC129 e ISC029
  assert.ok(!g.filas.some((f) => f.codigo === "ISC123"));
});

test("una electiva se guarda bajo su cupo con el detalle de la materia real", () => {
  const e = leerGradua([PAGINA]).filas.find((f) => f.codigo === "ELE015");
  assert.equal(e.detalle, "ISC127 INTELIGENCIA ARTIFICIAL");
  assert.equal(e.letra, "A");
  assert.equal(e.creditos, 2);
});

test("retirada (R) y seminario (P) conservan su letra; el período queda como 2026-II", () => {
  const g = leerGradua([PAGINA]);
  const r = g.filas.find((f) => f.codigo === "HUM008");
  assert.equal(r.letra, "R");
  assert.equal(etiquetaPeriodo(r.anio, r.ronda), "2026-II");
  assert.equal(g.filas.find((f) => f.codigo === "ISC031").letra, "P");
});

test("algo que no es un gradua da null", () => {
  assert.equal(leerGradua(["Factura 123\nTotal 5 5"]), null);
});

test("la matrícula se compara por dígitos", () => {
  assert.equal(soloDigitos("2023-0253"), soloDigitos("20230253"));
});

test("los períodos se escriben y se leen como 2026-II", () => {
  assert.equal(etiquetaPeriodo(2024, 1), "2024-I");
  assert.equal(etiquetaPeriodo(2025, 3), "2025-III");
  assert.deepEqual(leerEtiquetaPeriodo("2026-II"), { anio: 2026, ronda: 2 });
  assert.deepEqual(leerEtiquetaPeriodo("2026-3"), { anio: 2026, ronda: 3 });
  assert.equal(leerEtiquetaPeriodo("2026-IV"), null);
});

test("ISC-R-2-2019 e ISC-R2-2019 son el mismo plan", () => {
  assert.equal(normalizarVersion("ISC-R-2-2019"), normalizarVersion("isc-r2-2019"));
  assert.notEqual(normalizarVersion("ISC-R2-2019"), normalizarVersion("ISC-R2-2022"));
});

test("el nombre del reporte se compara sin acentos y por contención", () => {
  assert.ok(nombresParecidos("DAURIS SANTANA", "Dauris Santana"));
  assert.ok(nombresParecidos("MARÍA DE LOS ANGELES PÉREZ", "Maria Perez") === false);
  assert.ok(nombresParecidos("Ashley Cabrera", "DAURIS SANTANA") === false);
});
