// Pruebas unitarias de `validarPeriodo` y `calcularNotaFinal` (Global Effect 360).
// Uso: node --test scripts/probar-academico-360.mjs
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  aDia,
  esDiaValido,
  MAX_PERIODOS_POR_ANIO,
  validarPeriodo,
} from "../src/lib/periodos.ts";
import { calcularNotaFinal } from "../src/lib/nota-final.ts";
import {
  esEstudianteUniversitario,
  evaluarMinimoCuatrimestral,
} from "../src/lib/reglas-academicas.ts";

test("esDiaValido acepta fechas reales y rechaza fechas inexistentes", () => {
  assert.equal(esDiaValido("2026-01-15"), true);
  assert.equal(esDiaValido("2024-02-29"), true); // bisiesto
  assert.equal(esDiaValido("2026-02-29"), false);
  assert.equal(esDiaValido("2026-02-31"), false);
  assert.equal(esDiaValido("15/01/2026"), false);
});

test("aDia recorta cadenas ISO e instancias Date a YYYY-MM-DD", () => {
  assert.equal(aDia("2026-05-10T14:30:00.000Z"), "2026-05-10");
  assert.equal(aDia(new Date("2026-05-10T00:00:00.000Z")), "2026-05-10");
});

test("validarPeriodo acepta un cuatrimestre válido sin traslape", () => {
  const existentes = [
    { id: "p1", fecha_inicio: "2026-01-10", fecha_fin: "2026-04-20" },
  ];
  const err = validarPeriodo(
    { tipo: "cuatrimestre", fecha_inicio: "2026-05-01", fecha_fin: "2026-08-15" },
    existentes,
  );
  assert.equal(err, null);
});

test("validarPeriodo rechaza tipo distinto de cuatrimestre, fechas invertidas y cambio de año", () => {
  assert.equal(
    validarPeriodo(
      { tipo: "semestre", fecha_inicio: "2026-01-10", fecha_fin: "2026-04-20" },
      [],
    ),
    "tipo_invalido",
  );
  assert.equal(
    validarPeriodo(
      { tipo: "cuatrimestre", fecha_inicio: "2026-04-20", fecha_fin: "2026-01-10" },
      [],
    ),
    "fin_antes_de_inicio",
  );
  assert.equal(
    validarPeriodo(
      { tipo: "cuatrimestre", fecha_inicio: "2026-11-01", fecha_fin: "2027-02-15" },
      [],
    ),
    "anio_distinto",
  );
});

test("validarPeriodo detecta traslapes e ignora el propio período al editar", () => {
  const existentes = [
    { id: "p1", fecha_inicio: "2026-01-10", fecha_fin: "2026-04-20" },
  ];
  assert.equal(
    validarPeriodo(
      { tipo: "cuatrimestre", fecha_inicio: "2026-04-20", fecha_fin: "2026-07-30" },
      existentes,
    ),
    "traslape",
  );
  assert.equal(
    validarPeriodo(
      { id: "p1", tipo: "cuatrimestre", fecha_inicio: "2026-01-12", fecha_fin: "2026-04-22" },
      existentes,
    ),
    null,
  );
});

test(`validarPeriodo impide superar ${MAX_PERIODOS_POR_ANIO} períodos en el mismo año`, () => {
  const existentes = [
    { id: "p1", fecha_inicio: "2026-01-01", fecha_fin: "2026-02-28" },
    { id: "p2", fecha_inicio: "2026-03-01", fecha_fin: "2026-05-31" },
    { id: "p3", fecha_inicio: "2026-06-01", fecha_fin: "2026-08-31" },
    { id: "p4", fecha_inicio: "2026-09-01", fecha_fin: "2026-10-31" },
  ];
  assert.equal(
    validarPeriodo(
      { tipo: "cuatrimestre", fecha_inicio: "2026-11-01", fecha_fin: "2026-12-20" },
      existentes,
    ),
    "demasiados_en_anio",
  );
});

test("calcularNotaFinal normaliza escalas distintas a base 100 y pondera por peso", () => {
  const ahora = new Date("2026-06-15T12:00:00Z");
  const r = calcularNotaFinal(
    [
      // 18 / 20 = 90% con peso 40
      {
        tipo: "tarea",
        peso: 40,
        puntajeMaximo: 20,
        calificacion: 18,
        vence: "2026-06-01T23:59:59Z",
        entregada: true,
      },
      // 160 / 200 = 80% con peso 60
      {
        tipo: "examen",
        peso: 60,
        puntajeMaximo: 200,
        calificacion: 160,
        vence: "2026-06-10T23:59:59Z",
        entregada: true,
      },
      // Material no evaluable: se ignora
      {
        tipo: "material",
        peso: 50,
        puntajeMaximo: 100,
        calificacion: null,
        vence: null,
        entregada: false,
      },
    ],
    ahora,
  );
  // (90 * 40 + 80 * 60) / 100 = 84
  assert.equal(r.propuesta, 84);
  assert.equal(r.contadas, 2);
});

test("calcularNotaFinal cuenta 0 en vencidas no entregadas e ignora entregadas pendientes de revisión", () => {
  const ahora = new Date("2026-06-15T12:00:00Z");
  const r = calcularNotaFinal(
    [
      // Calificada: 100% con peso 50
      {
        tipo: "tarea",
        peso: 50,
        puntajeMaximo: 100,
        calificacion: 100,
        vence: "2026-06-01T00:00:00Z",
        entregada: true,
      },
      // Vencida y NO entregada: cuenta como 0 con peso 50
      {
        tipo: "tarea",
        peso: 50,
        puntajeMaximo: 100,
        calificacion: null,
        vence: "2026-06-10T00:00:00Z",
        entregada: false,
      },
      // Vencida PERO entregada (esperando al docente): NO castiga al estudiante
      {
        tipo: "examen",
        peso: 50,
        puntajeMaximo: 100,
        calificacion: null,
        vence: "2026-06-10T00:00:00Z",
        entregada: true,
      },
      // Aún no vence: tampoco cuenta todavía
      {
        tipo: "tarea",
        peso: 50,
        puntajeMaximo: 100,
        calificacion: null,
        vence: "2026-06-25T00:00:00Z",
        entregada: false,
      },
    ],
    ahora,
  );
  assert.equal(r.propuesta, 50);
  assert.equal(r.contadas, 2);
});

test("esEstudianteUniversitario distingue estudiantes con universidad registrada", () => {
  assert.equal(esEstudianteUniversitario("UCATECI"), true);
  assert.equal(esEstudianteUniversitario("   "), false);
  assert.equal(esEstudianteUniversitario(null), false);
  assert.equal(esEstudianteUniversitario(undefined), false);
});

test("evaluarMinimoCuatrimestral exige al menos 2 clases solo a universitarios", () => {
  const noUni = evaluarMinimoCuatrimestral({
    esUniversitario: false,
    clases360: 0,
    clasesCarrera: 0,
  });
  assert.equal(noUni.aplica, false);
  assert.equal(noUni.cumplido, true);
  assert.equal(noUni.faltantes, 0);

  const uniFaltante = evaluarMinimoCuatrimestral({
    esUniversitario: true,
    clases360: 1,
    clasesCarrera: 0,
  });
  assert.equal(uniFaltante.aplica, true);
  assert.equal(uniFaltante.tomadas, 1);
  assert.equal(uniFaltante.faltantes, 1);
  assert.equal(uniFaltante.cumplido, false);

  const uniCumplido = evaluarMinimoCuatrimestral({
    esUniversitario: true,
    clases360: 1,
    clasesCarrera: 1,
  });
  assert.equal(uniCumplido.aplica, true);
  assert.equal(uniCumplido.tomadas, 2);
  assert.equal(uniCumplido.faltantes, 0);
  assert.equal(uniCumplido.cumplido, true);
});

