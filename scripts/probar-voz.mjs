// Pruebas de las reglas puras de voz (sin navegador).
// Uso: node --test scripts/probar-voz.mjs
import { test } from "node:test";
import assert from "node:assert/strict";

import { elegirVoz, idiomaDeVoz, limpiarParaVoz, trocearParaVoz } from "../src/lib/voz.ts";

test("limpiarParaVoz quita el formato que no se debe pronunciar", () => {
  const t = limpiarParaVoz("## Resumen\n- **Nota:** 85 sobre 100 ✅\n1. Revisa `tu perfil` en https://x.org/a y [aquí](https://y.org)\nVe a /configuracion/conocimiento ahora.");

  assert.ok(!/[*#`_]/.test(t), t);
  assert.ok(!/https?:|\/configuracion/.test(t), t);
  assert.ok(!/✅/u.test(t), t);
  assert.match(t, /Nota: 85 sobre 100/);
  assert.match(t, /Revisa tu perfil/);
  assert.match(t, /aquí/);
});

test("limpiarParaVoz deja intacto un texto normal con tildes", () => {
  assert.equal(limpiarParaVoz("Hola, ¿cómo estás? Tu índice es 3.4."), "Hola, ¿cómo estás? Tu índice es 3.4.");
});

test("trocearParaVoz corta por frases y respeta el máximo", () => {
  const texto = "Primera frase corta. Segunda frase un poco más larga que la anterior! ¿Tercera? " + "palabra ".repeat(60).trim() + ".";
  const trozos = trocearParaVoz(texto, 80);

  assert.ok(trozos.length >= 3);
  assert.ok(trozos.every((t) => t.length <= 80), JSON.stringify(trozos.map((t) => t.length)));
  // no se pierde nada de lo dicho
  assert.equal(trozos.join(" ").replace(/\s+/g, " ").replace(/[.!?]\s/g, ""), texto.replace(/\s+/g, " ").replace(/[.!?]\s/g, ""));
});

test("trocearParaVoz junta frases cortas y devuelve vacío si no hay texto", () => {
  assert.deepEqual(trocearParaVoz("Hola. Qué tal."), ["Hola. Qué tal."]);
  assert.deepEqual(trocearParaVoz("   "), []);
});

test("trocearParaVoz parte una frase enorme sin comas ni puntos", () => {
  const t = trocearParaVoz("a".repeat(500), 100);

  assert.ok(t.length >= 5 && t.every((x) => x.length <= 100));
});

test("idiomaDeVoz", () => {
  assert.equal(idiomaDeVoz("es"), "es-DO");
  assert.equal(idiomaDeVoz("en"), "en-US");
});

test("elegirVoz prefiere la latinoamericana y las naturales; null si no hay del idioma", () => {
  const voces = [
    { name: "Monica", lang: "es-ES", localService: true },
    { name: "Paulina", lang: "es-MX", localService: true },
    { name: "Google español de Estados Unidos", lang: "es-US" },
    { name: "Samantha", lang: "en-US", localService: true },
  ];

  assert.equal(elegirVoz(voces, "es")?.lang, "es-US");
  assert.equal(elegirVoz(voces, "en")?.name, "Samantha");
  assert.equal(elegirVoz([{ name: "X", lang: "fr-FR" }], "es"), null);
  assert.equal(elegirVoz([{ name: "Dom", lang: "es_DO" }, { name: "Mx", lang: "es-MX" }], "es")?.name, "Dom");
});
