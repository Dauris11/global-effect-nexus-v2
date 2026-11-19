// Prueba EN VIVO del cliente de Gemini con la clave de .env.local. Usa solo texto
// inventado (nada de datos reales). Uso: npx tsx scripts/probar-gemini-vivo.ts
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

const { conversar } = await import("../src/lib/ia");
const { flujoGemini, llamarGemini, modeloGemini } = await import("../src/lib/gemini-cliente");

console.log("modelo:", modeloGemini());

const a = await conversar("Responde en una frase corta.", [{ rol: "user", contenido: "Explica cómo funciona la IA en pocas palabras" }]);
console.log("conversar →", a.estado, a.estado === "ok" ? a.texto.slice(0, 100) : "", a.estado === "ok" ? JSON.stringify(a.uso) : "");

const b = await llamarGemini({
  model: modeloGemini(),
  max_tokens: 800,
  system: "Clasifica la carta.",
  tools: [{ name: "clasificar_carta", description: "d", input_schema: { type: "object", properties: { veredicto: { type: "string", enum: ["limpio", "revisar"] }, motivos: { type: "array", items: { type: "string", enum: ["dinero", "otro"] } }, traduccion: { type: "string" } }, required: ["veredicto", "motivos", "traduccion"] } }],
  forzar: "clasificar_carta",
  messages: [{ role: "user", content: "Carta (de prueba): Querido patrocinador, gracias por su apoyo. Estudio mucho." }],
}).catch((e) => ({ error: String(e) }));
console.log("función forzada →", JSON.stringify(b).slice(0, 400));

// Flujo (SSE): el texto llega en trozos y la respuesta final se arma completa.
const trozos: string[] = [];
const flujo = flujoGemini({ model: modeloGemini(), max_tokens: 200, messages: [{ role: "user", content: "Cuenta del 1 al 5 separado por comas." }] });

flujo.alTexto((t) => trozos.push(t));

const final = await flujo.final().catch((e) => ({ error: String(e) }));

console.log("flujo →", "error" in final ? final.error : `${trozos.length} trozos, texto=${JSON.stringify(trozos.join("")).slice(0, 80)}, stop=${final.stop_reason}`);
