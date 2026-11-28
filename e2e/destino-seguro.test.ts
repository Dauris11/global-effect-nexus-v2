import assert from "node:assert/strict";
import { test } from "node:test";

import { destinoSeguro } from "../src/lib/destino-seguro";

// Uso: npx tsx --test e2e/destino-seguro.test.ts

test("respeta rutas internas", () => {
  assert.equal(destinoSeguro("/expedientes"), "/expedientes");
  assert.equal(destinoSeguro("/expedientes?x=1#y"), "/expedientes?x=1#y");
});

test("sin next o vacío usa el destino por defecto", () => {
  assert.equal(destinoSeguro(null), "/inicio");
  assert.equal(destinoSeguro(""), "/inicio");
  assert.equal(destinoSeguro(undefined, "/portal/chofer"), "/portal/chofer");
});

test("ignora destinos externos o ambiguos", () => {
  for (const malo of ["https://evil.com", "http://evil.com", "//evil.com", "/\\evil.com", "evil.com", "javascript:alert(1)", "/a\\b", "/a\nb"]) {
    assert.equal(destinoSeguro(malo), "/inicio", malo);
  }
});

test("no devuelve al login (bucle)", () => {
  assert.equal(destinoSeguro("/login"), "/inicio");
  assert.equal(destinoSeguro("/en/login?x=1"), "/inicio");
  assert.equal(destinoSeguro("/recuperar/nueva"), "/inicio");
});
