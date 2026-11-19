// Pruebas del respaldo entre proveedores de IA (sin red).
// Uso: node --test scripts/probar-respaldo.mjs
import { test } from "node:test";
import assert from "node:assert/strict";

import { conRespaldo, flujoConRespaldo } from "../src/lib/respaldo.ts";

test("usa el primero si responde", async () => {
  const visto = [];

  assert.equal(await conRespaldo(["a", "b"], async (p) => (visto.push(p), p.toUpperCase())), "A");
  assert.deepEqual(visto, ["a"]);
});

test("si el primero falla, responde el segundo y se avisa del cambio", async () => {
  const avisos = [];
  const r = await conRespaldo(
    ["groq", "openai"],
    async (p) => {
      if (p === "groq") throw new Error("429");
      return "ok-" + p;
    },
    (de, _e, a) => avisos.push(`${de}->${a}`),
  );

  assert.equal(r, "ok-openai");
  assert.deepEqual(avisos, ["groq->openai"]);
});

test("si todos fallan, sale el ÚLTIMO error", async () => {
  await assert.rejects(
    conRespaldo(["a", "b"], async (p) => { throw new Error("falla " + p); }),
    /falla b/,
  );
});

test("sin proveedores configurados lanza un error claro", async () => {
  await assert.rejects(conRespaldo([], async () => 1), /No hay proveedor/);
});

const flujoFalso = (texto, falla) => ({
  alTexto(f) { this.f = f; },
  async final() {
    if (texto) this.f?.(texto);
    if (falla) throw new Error(falla);
    return "final";
  },
});

test("flujo: falla antes de emitir → pasa al siguiente y el texto sale una sola vez", async () => {
  const flujo = flujoConRespaldo(["a", "b"], (p) => (p === "a" ? flujoFalso("", "503") : flujoFalso("hola", null)));
  let visto = "";

  flujo.alTexto((t) => (visto += t));

  assert.equal(await flujo.final(), "final");
  assert.equal(visto, "hola");
});

test("flujo: si ya se emitió texto NO cambia de proveedor a mitad", async () => {
  const llamados = [];
  const flujo = flujoConRespaldo(["a", "b"], (p) => (llamados.push(p), p === "a" ? flujoFalso("parcial", "corte") : flujoFalso("otro", null)));
  let visto = "";

  flujo.alTexto((t) => (visto += t));

  await assert.rejects(flujo.final(), /corte/);
  assert.equal(visto, "parcial");
  assert.deepEqual(llamados, ["a"]);
});

test("flujo: todos fallan sin emitir → el último error", async () => {
  const flujo = flujoConRespaldo(["a", "b"], (p) => flujoFalso("", "falla " + p));

  await assert.rejects(flujo.final(), /falla b/);
});
