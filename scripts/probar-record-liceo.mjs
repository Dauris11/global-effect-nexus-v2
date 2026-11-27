import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { claveGrado, fusionarGrados, gradosDeRespuesta, leerNumero, pendientesDeRevisar, promediosDelRecord, validarRecord } from "../src/lib/record-liceo.ts";

const ejemplo = JSON.parse(readFileSync(new URL("./fixtures/record-liceo-ejemplo.json", import.meta.url), "utf8"));
const grados = ejemplo.grados.map((g) => ({
  grado: g.grado,
  anioInicio: g.anioInicio,
  centro: g.centro,
  notas: g.notas.map(([materia, nota]) => ({ materia, esModulo: /^MF_/.test(materia), nota })),
}));

test("el récord de ejemplo da 51 notas, 4554 puntos, global 89,29 y por año 88,93", () => {
  const p = promediosDelRecord(grados);

  assert.equal(p.totalNotas, ejemplo.esperado.totalNotas);
  assert.equal(p.sumaTotal, ejemplo.esperado.sumaTotal);
  assert.deepEqual(p.porGrado.map((g) => g.suma), ejemplo.esperado.sumasPorGrado);
  assert.equal(p.global, ejemplo.esperado.global);
  assert.equal(p.anual, ejemplo.esperado.anual);
  assert.deepEqual(p.porGrado.map((g) => g.promedio), [89.44, 85.44, 85.67, 91.75, 92.33]);
});

test("validarRecord acepta el ejemplo y rechaza lo dudoso sin arreglarlo", () => {
  assert.equal(validarRecord(grados, 2026).ok, true);
  assert.deepEqual(validarRecord([], 2026), { ok: false, error: "sin_grados" });
  const con = (cambio) => validarRecord([{ ...grados[0], ...cambio }], 2026);

  assert.equal(con({ grado: 7 }).error, "grado_invalido");
  assert.equal(con({ anioInicio: 1850 }).error, "anio_invalido");
  assert.equal(con({ centro: "  " }).error, "centro_vacio");
  assert.equal(con({ notas: [] }).error, "grado_sin_notas");
  assert.equal(con({ notas: [{ materia: "X", nota: 101 }] }).error, "nota_invalida");
  assert.equal(con({ notas: [{ materia: "X", nota: null }] }).error, "nota_invalida");
  assert.equal(con({ notas: [{ materia: " ", nota: 90 }] }).error, "materia_vacia");
  assert.equal(validarRecord([grados[0], { ...grados[0], centro: "LICEO  pomier" }], 2026).error, "grado_repetido");
});

test("un grado repetido en otro año o en otro centro no es duplicado", () => {
  const otro = { ...grados[0], anioInicio: 2017 };
  const otroCentro = { ...grados[0], centro: "Otro liceo" };

  assert.notEqual(claveGrado(grados[0]), claveGrado(otro));
  assert.equal(validarRecord([grados[0], otro, otroCentro], 2026).ok, true);
});

test("fusionar frente y reverso: el 5.º se suma sin duplicar lo ya leído", () => {
  const frente = grados.slice(0, 4);
  const reverso = grados.slice(3); // la foto de atrás repite la tabla de 4.º por transparencia
  const unido = fusionarGrados(frente, reverso);

  assert.equal(unido.length, 5);
  assert.equal(unido[3].notas.length, 12);
  assert.equal(promediosDelRecord(unido).totalNotas, 51);
});

test("la respuesta del modelo se lee con tolerancia y lo ilegible queda sin nota", () => {
  const leidos = gradosDeRespuesta({
    grados: [
      { grado: "1", anio: "2016-2017", centro: "Liceo Pomier", notas: [
        { materia: "Matemática", nota: "95.", confianza: 99 },
        { materia: "MF_002_3 Ofimática", nota: "9?", confianza: 40 },
        { materia: "Raro", nota: 140 },
      ] },
      { grado: 9, anio: "2016", notas: [{ materia: "x", nota: 1 }] },
      { grado: 2, anio: "2017-2018", centro: "Liceo Pomier", notas: [] },
    ],
  });

  assert.equal(leidos.length, 1);
  assert.deepEqual(leidos[0].notas.map((n) => n.nota), [95, null, null]);
  assert.equal(leidos[0].notas[1].esModulo, true);
  assert.deepEqual(pendientesDeRevisar(leidos), { sinNota: 2, dudosas: 0 });
  assert.equal(leerNumero("89,5"), 89.5);
  assert.equal(leerNumero("abc"), null);
});

test("el redondeo es mitad hacia arriba, no truncado", () => {
  const p = promediosDelRecord([{ grado: 3, anioInicio: 2018, centro: "X", notas: [84, 81, 88, 84, 87, 77, 86, 94, 90].map((nota, i) => ({ materia: String(i), esModulo: false, nota })) }]);

  assert.equal(p.global, 85.67); // 771/9 = 85,666…; el lápiz del papel trunca a 85.66
});
