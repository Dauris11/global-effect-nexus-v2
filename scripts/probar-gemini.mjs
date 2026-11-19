// Pruebas de la traducción a/desde la API de Gemini (sin red ni clave).
// Uso: node --test scripts/probar-gemini.mjs
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  acumular,
  acumuladoVacio,
  AnalizadorSse,
  clasificarErrorHttp,
  construirPeticion,
  esquemaGemini,
  respuestaDeAcumulado,
  respuestaDeJson,
} from "../src/lib/gemini.ts";

const firma = "FIRMA-OPACA-123";

test("esquemaGemini quita lo que Gemini rechaza y conserva lo demás", () => {
  const limpio = esquemaGemini({
    $schema: "http://json-schema.org/draft-07/schema#",
    type: "object",
    additionalProperties: false,
    properties: {
      titulo: { type: "string", description: "x", default: "a", examples: ["b"] },
      estado: { type: "string", enum: ["a", "b"] },
      lista: { type: "array", items: { type: "string", additionalProperties: false } },
      // un nombre de propiedad que coincide con una palabra clave NO se filtra
      default: { type: "string" },
      opcional: { type: ["string", "null"] },
    },
    required: ["titulo"],
  });

  assert.deepEqual(limpio, {
    type: "object",
    properties: {
      titulo: { type: "string", description: "x" },
      estado: { type: "string", enum: ["a", "b"] },
      lista: { type: "array", items: { type: "string" } },
      default: { type: "string" },
      opcional: { type: "string", nullable: true },
    },
    required: ["titulo"],
  });
});

test("la petición usa systemInstruction, role model y esquema limpio", () => {
  const p = construirPeticion({
    model: "gemini-x",
    max_tokens: 123,
    system: "SISTEMA",
    messages: [
      { role: "user", content: "hola" },
      { role: "assistant", content: "buenas" },
    ],
    tools: [{ name: "t", description: "d", input_schema: { type: "object", additionalProperties: false, properties: {} } }],
  });

  assert.deepEqual(p.systemInstruction, { parts: [{ text: "SISTEMA" }] });
  assert.deepEqual(p.contents.map((c) => c.role), ["user", "model"]);
  assert.deepEqual(p.generationConfig, { maxOutputTokens: 123 });
  assert.equal(p.tools[0].functionDeclarations[0].parameters.additionalProperties, undefined);
  assert.equal(p.toolConfig, undefined);
  assert.ok(!JSON.stringify(p).includes("cache_control"));
});

test("forzar una herramienta pone mode ANY con esa sola función", () => {
  const p = construirPeticion({
    model: "m", max_tokens: 10, messages: [{ role: "user", content: "x" }],
    tools: [{ name: "clasificar", description: "d", input_schema: { type: "object" } }],
    forzar: "clasificar",
  });

  assert.deepEqual(p.toolConfig, { functionCallingConfig: { mode: "ANY", allowedFunctionNames: ["clasificar"] } });
});

test("la firma de pensamiento vuelve intacta al reenviar el historial", () => {
  const estado = acumuladoVacio();

  acumular(estado, {
    candidates: [{ content: { parts: [{ functionCall: { name: "crear_tarea", args: { a: 1 }, id: "abc" }, thoughtSignature: firma }] } }],
    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, thoughtsTokenCount: 7 },
  });

  const r = respuestaDeAcumulado(estado);

  assert.equal(r.stop_reason, "tool_use");
  assert.equal(r.content[0].id, "abc");
  assert.equal(r.usage.output_tokens, 12); // candidatos + pensamiento

  const p = construirPeticion({
    model: "m", max_tokens: 10,
    messages: [
      { role: "user", content: "pide" },
      { role: "assistant", content: r.content },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "abc", content: "hecho" }] },
    ],
  });

  // la parte del modelo viaja tal cual, con su firma
  assert.equal(p.contents[1].parts[0].thoughtSignature, firma);
  assert.deepEqual(p.contents[1].parts[0].functionCall, { name: "crear_tarea", args: { a: 1 }, id: "abc" });
  // y la respuesta de la herramienta lleva nombre e id
  assert.deepEqual(p.contents[2].parts[0].functionResponse, { name: "crear_tarea", id: "abc", response: { result: "hecho" } });
});

test("llamadas paralelas: todas las respuestas en un solo turno, con su nombre", () => {
  const r = respuestaDeJson({
    candidates: [{ content: { parts: [
      { functionCall: { name: "a", args: {} }, thoughtSignature: firma },
      { functionCall: { name: "b", args: {} } },
    ] } }],
  });

  assert.deepEqual(r.content.map((b) => b.id), ["llamada_0", "llamada_1"]);

  const p = construirPeticion({
    model: "m", max_tokens: 1,
    messages: [
      { role: "user", content: "x" },
      { role: "assistant", content: r.content },
      { role: "user", content: [
        { type: "tool_result", tool_use_id: "llamada_0", content: "ra" },
        { type: "tool_result", tool_use_id: "llamada_1", content: "rb", is_error: true },
      ] },
    ],
  });

  assert.equal(p.contents[1].parts.length, 2);
  assert.deepEqual(p.contents[2].parts.map((x) => x.functionResponse.name), ["a", "b"]);
  // sin id del modelo, no se inventa uno en la respuesta
  assert.equal(p.contents[2].parts[0].functionResponse.id, undefined);
  assert.deepEqual(p.contents[2].parts[1].functionResponse.response, { error: "rb" });
});

test("los trozos de texto se funden y se avisa solo del texto nuevo", () => {
  const e = acumuladoVacio();
  const a = acumular(e, { candidates: [{ content: { parts: [{ text: "Hola " }] } }] });
  const b = acumular(e, { candidates: [{ content: { parts: [{ text: "mundo", thoughtSignature: firma }] }, finishReason: "STOP" }] });

  assert.equal(a, "Hola ");
  assert.equal(b, "mundo");

  const r = respuestaDeAcumulado(e);

  assert.equal(r.content.length, 1);
  assert.equal(r.content[0].text, "Hola mundo");
  assert.equal(r.stop_reason, "end_turn");
});

test("los pensamientos resumidos no cuentan como respuesta", () => {
  const e = acumuladoVacio();

  acumular(e, { candidates: [{ content: { parts: [{ text: "pensando…", thought: true }, { text: "respuesta" }] } }] });

  assert.equal(respuestaDeAcumulado(e).content[0].text, "respuesta");
});

test("SSE partido a mitad de evento", () => {
  const a = new AnalizadorSse();
  const evento = 'data: {"candidates":[{"content":{"parts":[{"text":"ñandú"}]}}]}\n\n';

  assert.deepEqual(a.push(evento.slice(0, 30)), []);

  const out = a.push(evento.slice(30) + 'data: {"x":1}\r\n\r\ndata: {"y":');

  assert.equal(out.length, 2);
  assert.equal(out[0].candidates[0].content.parts[0].text, "ñandú");
  assert.deepEqual(out[1], { x: 1 });
  assert.deepEqual(a.push("2}"), []);
  assert.deepEqual(a.fin(), [{ y: 2 }]);
});

test("bloqueos se vuelven refusal", () => {
  for (const crudo of [
    { promptFeedback: { blockReason: "SAFETY" } },
    { candidates: [{ finishReason: "SAFETY" }] },
    { candidates: [{ finishReason: "PROHIBITED_CONTENT" }] },
    { candidates: [{ finishReason: "RECITATION" }] },
    { candidates: [{ finishReason: "SPII" }] },
    { candidates: [{ finishReason: "BLOCKLIST" }] },
  ]) {
    assert.equal(respuestaDeJson(crudo).stop_reason, "refusal", JSON.stringify(crudo));
  }

  // con contenido útil, un finishReason de bloqueo no tapa lo que ya salió
  assert.equal(
    respuestaDeJson({ candidates: [{ content: { parts: [{ text: "algo" }] }, finishReason: "SAFETY" }] }).stop_reason,
    "end_turn",
  );
  assert.equal(respuestaDeJson({ candidates: [{ content: { parts: [{ text: "x" }] }, finishReason: "MAX_TOKENS" }] }).stop_reason, "max_tokens");
});

test("códigos HTTP: 429 límite, clave inválida sin_clave, el resto fallo", () => {
  assert.equal(clasificarErrorHttp(429, ""), "limite");
  assert.equal(clasificarErrorHttp(400, '{"error":{"message":"API key not valid. Please pass a valid API key."}}'), "sin_clave");
  assert.equal(clasificarErrorHttp(403, "PERMISSION_DENIED"), "sin_clave");
  assert.equal(clasificarErrorHttp(401, ""), "sin_clave");
  assert.equal(clasificarErrorHttp(500, "boom"), "fallo");
  assert.equal(clasificarErrorHttp(400, "invalid argument"), "fallo");
});

test("las imágenes y PDF van como inlineData", () => {
  const p = construirPeticion({
    model: "m", max_tokens: 1,
    messages: [{ role: "user", content: [{ type: "archivo", mime: "application/pdf", base64: "QQ==" }, { type: "text", text: "lee" }] }],
  });

  assert.deepEqual(p.contents[0].parts[0], { inlineData: { mimeType: "application/pdf", data: "QQ==" } });
});
