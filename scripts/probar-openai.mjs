// Pruebas de la traducción a/desde Chat Completions de OpenAI (sin red ni clave).
// Uso: node --test scripts/probar-openai.mjs
import { test } from "node:test";
import assert from "node:assert/strict";

import { AnalizadorSse } from "../src/lib/gemini.ts";
import {
  acumularOpenAI,
  acumuladoOpenAIVacio,
  clasificarErrorOpenAI,
  construirPeticionOpenAI,
  respuestaDeAcumuladoOpenAI,
  respuestaDeJsonOpenAI,
} from "../src/lib/openai.ts";

test("la petición pone system primero, max_completion_tokens y herramientas", () => {
  const p = construirPeticionOpenAI(
    {
      model: "gpt-4o-mini", max_tokens: 321, system: "SISTEMA",
      messages: [{ role: "user", content: "hola" }, { role: "assistant", content: "buenas" }],
      tools: [{ name: "t", description: "d", input_schema: { type: "object", properties: {} } }],
    },
    false,
  );

  assert.deepEqual(p.messages[0], { role: "system", content: "SISTEMA" });
  assert.deepEqual(p.messages.map((m) => m.role), ["system", "user", "assistant"]);
  assert.equal(p.max_completion_tokens, 321);
  assert.equal(p.max_tokens, undefined);
  assert.equal(p.tools[0].function.name, "t");
  assert.equal(p.tool_choice, undefined);
  assert.equal(p.stream, undefined);
});

test("forzar una herramienta y pedir flujo con uso", () => {
  const p = construirPeticionOpenAI(
    { model: "m", max_tokens: 1, messages: [{ role: "user", content: "x" }],
      tools: [{ name: "clasificar", description: "d", input_schema: { type: "object" } }], forzar: "clasificar" },
    true,
  );

  assert.deepEqual(p.tool_choice, { type: "function", function: { name: "clasificar" } });
  assert.equal(p.stream, true);
  assert.deepEqual(p.stream_options, { include_usage: true });
});

test("la respuesta de una herramienta es un mensaje tool que sigue a sus tool_calls", () => {
  const p = construirPeticionOpenAI(
    { model: "m", max_tokens: 1, messages: [
      { role: "user", content: "pide" },
      { role: "assistant", content: [
        { type: "text", text: "Voy." },
        { type: "tool_use", id: "c1", name: "a", input: { x: 1 } },
        { type: "tool_use", id: "c2", name: "b", input: {} },
      ] },
      { role: "user", content: [
        { type: "tool_result", tool_use_id: "c1", content: "ra" },
        { type: "tool_result", tool_use_id: "c2", content: "rb", is_error: true },
      ] },
    ] },
    false,
  );

  const [, asistente, t1, t2] = p.messages;

  assert.equal(asistente.content, "Voy.");
  assert.deepEqual(asistente.tool_calls.map((l) => l.function.arguments), ['{"x":1}', "{}"]);
  assert.deepEqual([t1, t2].map((m) => m.role), ["tool", "tool"]);
  assert.deepEqual([t1.tool_call_id, t2.tool_call_id], ["c1", "c2"]);
  assert.equal(t2.content, "ERROR: rb");
});

test("imágenes y PDF van como partes de contenido", () => {
  const p = construirPeticionOpenAI(
    { model: "m", max_tokens: 1, messages: [{ role: "user", content: [
      { type: "archivo", mime: "image/png", base64: "QQ==" },
      { type: "archivo", mime: "application/pdf", base64: "UA==" },
      { type: "text", text: "lee" },
    ] }] },
    false,
  );
  const partes = p.messages[0].content;

  assert.deepEqual(partes[0], { type: "image_url", image_url: { url: "data:image/png;base64,QQ==" } });
  assert.equal(partes[1].type, "file");
  assert.equal(partes[1].file.file_data, "data:application/pdf;base64,UA==");
  assert.deepEqual(partes[2], { type: "text", text: "lee" });
});

test("respuesta completa con llamada a herramienta", () => {
  const r = respuestaDeJsonOpenAI({
    choices: [{ message: { content: null, tool_calls: [{ id: "call_9", function: { name: "crear", arguments: '{"a":2}' } }] }, finish_reason: "tool_calls" }],
    usage: { prompt_tokens: 11, completion_tokens: 7, prompt_tokens_details: { cached_tokens: 3 } },
  });

  assert.equal(r.stop_reason, "tool_use");
  assert.deepEqual(r.content[0], { type: "tool_use", id: "call_9", name: "crear", input: { a: 2 } });
  assert.deepEqual(r.usage, { input_tokens: 11, output_tokens: 7, cache_read_input_tokens: 3 });
});

test("flujo: los argumentos llegan por trozos y se juntan por índice", () => {
  const e = acumuladoOpenAIVacio();
  const a = new AnalizadorSse();
  const eventos = [
    { choices: [{ delta: { content: "Hola " } }] },
    { choices: [{ delta: { content: "mundo" } }] },
    { choices: [{ delta: { tool_calls: [{ index: 0, id: "c1", function: { name: "crear", arguments: '{"tit' } }] } }] },
    { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: 'ulo":"x"}' } }] } }] },
    { choices: [{ delta: { tool_calls: [{ index: 1, id: "c2", function: { name: "otra", arguments: "{}" } }] } }] },
    { choices: [{ delta: {}, finish_reason: "tool_calls" }] },
    { choices: [], usage: { prompt_tokens: 5, completion_tokens: 9 } },
  ];
  const crudo = eventos.map((x) => `data: ${JSON.stringify(x)}\n\n`).join("") + "data: [DONE]\n\n";
  let nuevo = "";

  // se corta el flujo a mitad de un evento para comprobar el búfer
  for (const trozo of [crudo.slice(0, 77), crudo.slice(77)]) {
    for (const ev of a.push(trozo)) nuevo += acumularOpenAI(e, ev);
  }

  assert.equal(nuevo, "Hola mundo");

  const r = respuestaDeAcumuladoOpenAI(e);

  assert.equal(r.stop_reason, "tool_use");
  assert.equal(r.content[0].text, "Hola mundo");
  assert.deepEqual(r.content[1].input, { titulo: "x" });
  assert.equal(r.content[2].id, "c2");
  assert.deepEqual(r.usage, { input_tokens: 5, output_tokens: 9, cache_read_input_tokens: 0 });
});

test("argumentos torcidos no rompen: quedan como objeto vacío", () => {
  const r = respuestaDeJsonOpenAI({ choices: [{ message: { tool_calls: [{ id: "c", function: { name: "x", arguments: "{no es json" } }] } }] });

  assert.deepEqual(r.content[0].input, {});
});

test("rechazos, filtro de contenido y corte por longitud", () => {
  assert.equal(respuestaDeJsonOpenAI({ choices: [{ message: { content: null, refusal: "No puedo." }, finish_reason: "stop" }] }).stop_reason, "refusal");
  assert.equal(respuestaDeJsonOpenAI({ choices: [{ message: { content: "" }, finish_reason: "content_filter" }] }).stop_reason, "refusal");
  assert.equal(respuestaDeJsonOpenAI({ choices: [{ message: { content: "cortada" }, finish_reason: "length" }] }).stop_reason, "max_tokens");
  assert.equal(respuestaDeJsonOpenAI({ choices: [{ message: { content: "ok" }, finish_reason: "stop" }] }).stop_reason, "end_turn");
});

test("errores: sin saldo y clave inválida son sin_clave; 429 normal es límite", () => {
  assert.equal(clasificarErrorOpenAI(429, '{"error":{"code":"credit_balance_exhausted","type":"insufficient_quota"}}'), "sin_clave");
  assert.equal(clasificarErrorOpenAI(429, '{"error":{"code":"rate_limit_exceeded"}}'), "limite");
  assert.equal(clasificarErrorOpenAI(401, '{"error":{"code":"invalid_api_key"}}'), "sin_clave");
  assert.equal(clasificarErrorOpenAI(500, "boom"), "fallo");
  assert.equal(clasificarErrorOpenAI(400, "bad"), "fallo");
});
