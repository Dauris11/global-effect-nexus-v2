import assert from "node:assert/strict";
import test from "node:test";

import {
  claveCodigo,
  emparejarEstudiante,
  filasDeLista,
  filasDeRespuesta,
  mismoNombre,
  resolverLetra,
  resolverMateria,
} from "../src/lib/carga-calificaciones.ts";

const candidatos = [
  { id: "a", nombre: "Juan Carlos Pérez Gómez", matricula: "2023-0253" },
  { id: "b", nombre: "María Pérez", matricula: "2022-0100" },
  { id: "c", nombre: "María Pérez", matricula: "2021-0777" },
  { id: "d", nombre: "Ana Lucía Rosario", matricula: null },
];

test("la matrícula se compara sin guiones", () => {
  const r = emparejarEstudiante({ matricula: "20230253", nombre: "PEREZ GOMEZ, JUAN CARLOS" }, candidatos);
  assert.deepEqual(r, { estado: "emparejado", estudianteId: "a", por: "matricula" });
});

test("matrícula de una persona con otro nombre no se empareja sola", () => {
  const r = emparejarEstudiante({ matricula: "2023-0253", nombre: "Rosa Altagracia Díaz" }, candidatos);
  assert.deepEqual(r, { estado: "sin_emparejar", motivo: "matricula_otra_persona" });
});

test("nombre único empareja; nombre repetido queda sin emparejar", () => {
  assert.equal(emparejarEstudiante({ matricula: null, nombre: "Rosario, Ana Lucía" }, candidatos).estudianteId, "d");
  assert.deepEqual(emparejarEstudiante({ matricula: null, nombre: "Maria Perez" }, candidatos), { estado: "sin_emparejar", motivo: "ambiguo" });
});

test("un solo nombre o una sola palabra no basta", () => {
  assert.equal(mismoNombre("Juan", "Juan Carlos Pérez"), false);
  assert.equal(mismoNombre("Juan Pérez", "Juan Carlos Pérez Gómez"), true);
  assert.deepEqual(emparejarEstudiante({ matricula: "12", nombre: "Pedro" }, candidatos), { estado: "sin_emparejar", motivo: "sin_candidato" });
});

test("el código se resuelve con cualquier formato; la materia por nombre exacto único", () => {
  const pensum = [
    { codigo: "CIM001", nombre: "MATEMATICAS I", creditos: 5 },
    { codigo: "MAT-160", nombre: "Álgebra Superior", creditos: 5 },
  ];
  assert.equal(claveCodigo("cim 001"), "CIM001");
  assert.equal(resolverMateria({ codigo: "CIM 001", materia: null }, pensum)?.codigo, "CIM001");
  assert.equal(resolverMateria({ codigo: "mat160", materia: null }, pensum)?.codigo, "MAT-160");
  assert.equal(resolverMateria({ codigo: null, materia: "algebra superior" }, pensum)?.codigo, "MAT-160");
  assert.equal(resolverMateria({ codigo: "XXX999", materia: "Otra" }, pensum), null);
});

test("las letras son las de la universidad más R y P", () => {
  assert.equal(resolverLetra(" b ", ["A", "B", "C"]), "B");
  assert.equal(resolverLetra("R", ["A"]), "R");
  assert.equal(resolverLetra("E", ["A", "B"]), null);
});

test("la respuesta del modelo se valida fila por fila", () => {
  const filas = filasDeRespuesta({
    filas: [
      { matricula: "2023-0253", nombre: "Juan", codigo: "CIM001", letra: "A", nota: "95,5", confianza: 91 },
      { matricula: null, nombre: null, codigo: "CIM001", letra: "A" },
      { matricula: "1", nombre: "X", codigo: null, materia: null, letra: "A" },
      "basura",
      { nombre: "Ana", materia: "Algebra", letra: "B", nota: 500, confianza: 400 },
    ],
  });
  assert.equal(filas.length, 2);
  assert.equal(filas[0].nota, 95.5);
  assert.equal(filas[1].nota, null);
  assert.equal(filas[1].confianza, 100);
  assert.deepEqual(filasDeRespuesta("no es objeto"), []);
});

test("la lista pegada admite matrícula;nombre;código;letra;nota", () => {
  const filas = filasDeLista("2023-0253;Juan Pérez;CIM001;A;90\n# nota\n\n2022-0100;María Pérez;HUM002;B");
  assert.equal(filas.length, 2);
  assert.equal(filas[1].nota, null);
});
