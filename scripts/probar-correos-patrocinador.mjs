// Pruebas de las reglas puras de las cartas a patrocinadores (sin red ni base).
// Uso: node --test scripts/probar-correos-patrocinador.mjs
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  autenticacionDe,
  cuerpoDeCarta,
  direccionDe,
  htmlATexto,
  mesYATiempo,
  revisarTraduccion,
  validarVeredicto,
} from "../src/lib/correos-patrocinador.ts";

test("mes y plazo se calculan en hora de La Vega, no en UTC", () => {
  // 20 de nov 23:59 en RD = 21 nov 03:59 UTC: sigue siendo el día límite.
  assert.deepEqual(mesYATiempo(new Date("2026-11-21T03:59:00Z"), 20), { mes: "2026-11", aTiempo: true });
  // Un minuto después ya es el 21 en RD.
  assert.deepEqual(mesYATiempo(new Date("2026-11-21T04:00:00Z"), 20), { mes: "2026-11", aTiempo: false });
  // El 1 de dic 02:00 UTC todavía es 30 de nov en RD.
  assert.deepEqual(mesYATiempo(new Date("2026-12-01T02:00:00Z"), 20), { mes: "2026-11", aTiempo: false });
  // El día 1 a las 04:00 UTC ya es el mes nuevo y a tiempo.
  assert.deepEqual(mesYATiempo(new Date("2026-12-01T04:00:00Z"), 20), { mes: "2026-12", aTiempo: true });
});

test("el día límite es parámetro", () => {
  assert.equal(mesYATiempo(new Date("2026-03-15T12:00:00Z"), 10).aTiempo, false);
  assert.equal(mesYATiempo(new Date("2026-03-15T12:00:00Z"), 15).aTiempo, true);
});

test("htmlATexto quita scripts, etiquetas y entidades", () => {
  const t = htmlATexto("<style>p{}</style><p>Hola &amp; <b>gracias</b></p><script>x()</script><br>Adiós");

  assert.equal(t, "Hola & gracias\n\nAdiós");
  assert.ok(!/[<>]/.test(t));
});

test("cuerpoDeCarta prefiere texto, cae a HTML y acota el largo", () => {
  assert.equal(cuerpoDeCarta("hola", "<p>otro</p>"), "hola");
  assert.equal(cuerpoDeCarta(null, "<p>otro</p>"), "otro");
  assert.equal(cuerpoDeCarta("a​b\u000C", null), "ab");
  assert.equal(cuerpoDeCarta("x".repeat(20000), null).length, 8000);
});

test("direccionDe extrae y normaliza", () => {
  assert.equal(direccionDe('"Ana Pérez" <Ana@Correo.COM>'), "ana@correo.com");
  assert.equal(direccionDe("ana@correo.com"), "ana@correo.com");
  assert.equal(direccionDe("sin direccion"), null);
});

test("autenticacionDe", () => {
  assert.equal(autenticacionDe("mx; spf=pass; dkim=pass; dmarc=pass"), "pass");
  assert.equal(autenticacionDe("spf=pass; dkim=none"), "desconocida");
  assert.equal(autenticacionDe("spf=pass; dkim=fail"), "fail");
  assert.equal(autenticacionDe("dmarc=softfail"), "fail");
  assert.equal(autenticacionDe(null), "desconocida");
});

test("validarVeredicto acepta lo bien formado", () => {
  assert.deepEqual(
    validarVeredicto({ veredicto: "limpio", motivos: [], traduccion: " Dear sponsor " }),
    { veredicto: "limpio", motivos: [], traduccion: "Dear sponsor" },
  );
});

test("validarVeredicto falla cerrado", () => {
  for (const malo of [
    null,
    "limpio",
    {},
    { veredicto: "ok", motivos: [], traduccion: "x" },
    { veredicto: "limpio", motivos: ["inventado"], traduccion: "x" },
    { veredicto: "limpio", motivos: "dinero", traduccion: "x" },
    { veredicto: "limpio", motivos: [], traduccion: "" },
    { veredicto: "limpio", motivos: [], traduccion: 5 },
  ]) {
    assert.equal(validarVeredicto(malo), null, JSON.stringify(malo));
  }
});

test("limpio con motivos se trata como revisar", () => {
  const r = validarVeredicto({ veredicto: "limpio", motivos: ["dinero", "dinero"], traduccion: "x" });

  assert.equal(r.veredicto, "revisar");
  assert.deepEqual(r.motivos, ["dinero"]);
});

test("revisarTraduccion deja pasar una carta normal", () => {
  for (const t of [
    "Dear Mr. Smith, I passed all my courses this semester. I am grateful for your support. I study 4 hours a day.",
    "Querida señora López, este mes hice mi servicio comunitario en la escuela. Gracias por creer en mí.",
  ]) {
    assert.deepEqual(revisarTraduccion(t), [], t);
  }
});

test("revisarTraduccion atrapa enlaces, correos, teléfonos, montos y pagos", () => {
  for (const t of [
    "Visit https://evil.example/pay",
    "write to me at ana@gmail.com",
    "call me at +1 809 555 1234",
    "please send $200 to help me",
    "I need 5000 pesos",
    "use Western Union or Zelle",
    "mi cuenta bancaria es 1234",
  ]) {
    assert.deepEqual(revisarTraduccion(t), ["traduccion_sospechosa"], t);
  }
});
