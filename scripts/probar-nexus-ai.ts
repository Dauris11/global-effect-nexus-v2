// Pruebas de Nexus AI (fases 1-4): motor con proveedor falso, permisos por rol,
// cadena SHA-256, cuotas y base de conocimiento. No llama a la API de Anthropic.
// Uso: npx tsx scripts/probar-nexus-ai.ts
import { config } from "dotenv";

config({ path: ".env.local" });

import type Anthropic from "@anthropic-ai/sdk";

const { consultar, consultarUna, pool } = await import("../src/lib/db");
const { ejecutarTurno } = await import("../src/server/ia/motor");
const { verificarCadena, registrarAccion } = await import("../src/server/ia/cadena");
const { miConsumo } = await import("../src/server/ia/agente");
const { buscarConocimiento } = await import("../src/server/ia/conocimiento");
const { HERRAMIENTAS, herramientasVisibles } = await import("../src/server/ia/herramientas");
const { PROHIBIDAS } = await import("../src/server/ia/herramientas/tipos");
const { agenteDeRol } = await import("../src/lib/ia-agentes");
const { ROLES } = await import("../src/lib/rbac");
const { trocear } = await import("../src/lib/ia-conocimiento");

let fallos = 0;
const prueba = (nombre: string, ok: boolean, detalle = "") => {
  console.log(`${ok ? "✓" : "✗"} ${nombre}${detalle ? ` — ${detalle}` : ""}`);
  if (!ok) fallos++;
};

const usuario = await consultarUna<{ id: string }>(
  `SELECT u.id FROM usuario u JOIN rol r ON r.id = u.rol_id WHERE r.nombre = 'admin' AND u.activo LIMIT 1`,
);
if (!usuario) throw new Error("No hay un usuario admin activo para probar");

const marca = `prueba-nexus-${Date.now()}`;
const creadas: string[] = [];

// ── 1. Agente por rol: los 8 roles tienen agente y existe en la tabla ─────────
const agentes = await consultar<{ clave: string }>("SELECT clave FROM ai_agente");
const claves = new Set(agentes.map((a) => a.clave));
prueba("cada rol tiene su agente en ai_agente", ROLES.every((r) => claves.has(agenteDeRol(r))));

// ── 2. Visibilidad de herramientas por rol ────────────────────────────────────
const nombres = (rol: (typeof ROLES)[number]) => herramientasVisibles(rol).map((h) => h.nombre);
prueba("el estudiante solo ve herramientas de lectura/conocimiento", nombres("estudiante").join() === "buscar_conocimiento");
prueba("el admin ve crear_tarea", nombres("admin").includes("crear_tarea"));
prueba("contabilidad ve sus herramientas y el docente no", nombres("contabilidad").includes("comprobantes_pendientes") && !nombres("docente").includes("comprobantes_pendientes"));
prueba(
  "las herramientas contables son todas de lectura",
  HERRAMIENTAS.filter((h) => ["comprobantes_pendientes", "senales_contables", "resumen_gasto"].includes(h.nombre)).every((h) => h.nivel === "automatica"),
);
const resumen = HERRAMIENTAS.find((h) => h.nombre === "resumen_gasto")!;
const salida = await resumen.ejecutar({ id: "x", rol: "contabilidad", nombre: "t" }, { centro: "comedor'; DROP TABLE x;--", periodo: "trimestre" }, { agente: "agente_contabilidad" });
prueba("resumen_gasto trata el texto del modelo como dato (sin inyección)", salida.ok);
const invalido = await resumen.ejecutar({ id: "x", rol: "contabilidad", nombre: "t" }, { centro: "x", periodo: "1=1; --" }, { agente: "agente_contabilidad" });
prueba("resumen_gasto rechaza un periodo fuera de la lista", !invalido.ok);
prueba(
  "ninguna herramienta tiene nombre prohibido",
  !HERRAMIENTAS.some((h) => (PROHIBIDAS as readonly string[]).includes(h.nombre)),
);

// ── 3. Motor con proveedor falso ──────────────────────────────────────────────
type Guion = Anthropic.Message[];
const mensaje = (content: Anthropic.ContentBlock[], stop: Anthropic.Message["stop_reason"]): Anthropic.Message =>
  ({
    id: "msg_falso",
    type: "message",
    role: "assistant",
    model: "falso",
    content,
    stop_reason: stop,
    stop_sequence: null,
    usage: { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 5 },
  }) as unknown as Anthropic.Message;

function proveedorDe(guion: Guion) {
  let i = 0;
  const vistos: Anthropic.MessageCreateParamsNonStreaming[] = [];
  const proveedor = (p: Anthropic.MessageCreateParamsNonStreaming) => {
    vistos.push(p);
    const m = guion[i++]!;
    return {
      alTexto: (aviso: (t: string) => void) => {
        for (const b of m.content) if (b.type === "text") aviso(b.text);
      },
      final: async () => m,
    };
  };
  return { proveedor, vistos };
}

// Fragmento de conocimiento solo para contabilidad
const frag = await consultarUna<{ id: string }>(
  `INSERT INTO fragmento_conocimiento (fuente_tipo, titulo, fuente, version, contenido, agentes, verificado_el)
   VALUES ('prueba', $1, 'Norma de prueba', 'v1', 'La retención de ISR por servicios es del diez por ciento según la norma de prueba.', ARRAY['agente_contabilidad'], current_date - 200)
   RETURNING id`,
  [marca],
);
const borrarFrag = () => consultar("DELETE FROM fragmento_conocimiento WHERE id = $1", [frag!.id]);

const eventos: unknown[] = [];
const guion: Guion = [
  mensaje(
    [
      { type: "text", text: "Reviso la norma. ", citations: null } as Anthropic.ContentBlock,
      { type: "tool_use", id: "t1", name: "crear_tarea", input: { titulo: marca, limite: "2026-12-01" } } as Anthropic.ContentBlock,
      { type: "tool_use", id: "t2", name: "borrar_evidencia", input: {} } as Anthropic.ContentBlock,
    ],
    "tool_use",
  ),
  mensaje([{ type: "text", text: "Te propuse la tarea; apruébala abajo.", citations: null } as Anthropic.ContentBlock], "end_turn"),
];
const { proveedor, vistos } = proveedorDe(guion);

const resultado = await ejecutarTurno({
  proveedor,
  usuario: { id: usuario.id, rol: "admin", nombre: "Prueba" },
  idioma: "es",
  agente: "agente_admin",
  conversacionId: null,
  sistema: "sistema de prueba",
  turnos: [{ rol: "user", contenido: "crea una tarea" }],
  modelo: "falso",
  maximoTokens: 100,
  emitir: (e) => eventos.push(e),
});

if ("error" in resultado) {
  prueba("el turno termina sin error", false, resultado.error);
} else {
  prueba("el texto se acumula de todos los pasos", resultado.texto.includes("Reviso la norma") && resultado.texto.includes("apruébala"));
  prueba("el uso suma los dos pasos", resultado.uso.entrada === 200 && resultado.uso.salida === 40 && resultado.uso.cache === 10);
  prueba("una herramienta de escritura solo se propone", resultado.propuestas === 1 && eventos.some((e) => (e as { t: string }).t === "aprobacion"));
}

const propuesta = await consultarUna<{ id: string; estado: string; entidad_id: string | null }>(
  `SELECT id, estado, entidad_id FROM ai_accion WHERE usuario_id = $1 AND herramienta = 'crear_tarea' AND argumentos->>'titulo' = $2`,
  [usuario.id, marca],
);
if (propuesta) creadas.push(propuesta.id);
prueba("la propuesta queda en ai_accion con estado 'propuesta'", propuesta?.estado === "propuesta");

const tareaCreada = await consultarUna("SELECT id FROM tarea WHERE titulo = $1", [marca]);
prueba("NO se creó la tarea antes de aprobar", tareaCreada === null);

const rechazada = await consultarUna<{ id: string; estado: string }>(
  `SELECT id, estado FROM ai_accion WHERE usuario_id = $1 AND herramienta = 'borrar_evidencia' ORDER BY created_at DESC LIMIT 1`,
  [usuario.id],
);
if (rechazada) creadas.push(rechazada.id);
prueba("una herramienta inexistente se rechaza y se anota", rechazada?.estado === "rechazada");
prueba(
  "el modelo recibió solo las herramientas de su rol",
  (vistos[0]?.tools ?? []).every((t) => "name" in t && nombres("admin").includes(t.name)),
);
prueba(
  "el resultado de una herramienta viaja como dato no confiable",
  JSON.stringify(vistos[1]?.messages.at(-1)).includes("datos_no_confiables"),
);

// Un estudiante que "pide" crear_tarea no la tiene
const { proveedor: provEst } = proveedorDe([
  mensaje([{ type: "tool_use", id: "x", name: "crear_tarea", input: { titulo: marca } } as Anthropic.ContentBlock], "tool_use"),
  mensaje([{ type: "text", text: "no puedo", citations: null } as Anthropic.ContentBlock], "end_turn"),
]);
const estEventos: unknown[] = [];
await ejecutarTurno({
  proveedor: provEst,
  usuario: { id: usuario.id, rol: "estudiante", nombre: "Est" },
  idioma: "es",
  agente: "agente_estudiante",
  conversacionId: null,
  sistema: "s",
  turnos: [{ rol: "user", contenido: "x" }],
  modelo: "falso",
  maximoTokens: 100,
  emitir: (e) => estEventos.push(e),
});
prueba("un estudiante no puede proponer crear_tarea", !estEventos.some((e) => (e as { t: string }).t === "aprobacion"));
const ult = await consultarUna<{ id: string }>(
  `SELECT id FROM ai_accion WHERE usuario_id = $1 AND agente_clave = 'agente_estudiante' ORDER BY created_at DESC LIMIT 1`,
  [usuario.id],
);
if (ult) creadas.push(ult.id);

// ── 4. Cadena SHA-256 ─────────────────────────────────────────────────────────
const cadena = await verificarCadena();
prueba("la cadena de ai_accion es válida", cadena.ok, `${cadena.filas} filas`);

const extra = await registrarAccion({
  usuarioId: usuario.id,
  agente: "agente_admin",
  herramienta: "buscar_conocimiento",
  argumentos: { consulta: marca, clave_api: "secreto" },
  estado: "ejecutada",
});
creadas.push(extra);
const guardada = await consultarUna<{ argumentos: Record<string, string> }>("SELECT argumentos FROM ai_accion WHERE id = $1", [extra]);
prueba("los secretos no se archivan", guardada?.argumentos.clave_api === "[omitido]");

await consultar("UPDATE ai_accion SET argumentos = '{\"consulta\":\"manipulado\"}' WHERE id = $1", [extra]);
const rota = await verificarCadena();
prueba("editar una fila rompe la cadena y se detecta", !rota.ok && rota.rotoEn === extra);

// ── 5. Cuotas ─────────────────────────────────────────────────────────────────
const sinTope = await miConsumo({ id: usuario.id, rol: "admin" });
prueba("sin cuota no hay tope", sinTope.tope === null && !sinTope.agotada);

await consultar(`INSERT INTO ai_cuota (usuario_id, tokens_mes) VALUES ($1, 1000)`, [usuario.id]);
const uso = await consultarUna<{ id: string }>(
  `INSERT INTO ai_uso (usuario_id, rol, agente_clave, modelo, tokens_entrada, tokens_salida)
   VALUES ($1, 'admin', 'agente_admin', 'falso', 850, 50) RETURNING id`,
  [usuario.id],
);
const alAviso = await miConsumo({ id: usuario.id, rol: "admin" });
prueba("al 90 % hay aviso pero no bloqueo", alAviso.aviso && !alAviso.agotada, `${alAviso.porcentaje} %`);
await consultar(`UPDATE ai_uso SET tokens_salida = 200 WHERE id = $1`, [uso!.id]);
const alTope = await miConsumo({ id: usuario.id, rol: "admin" });
prueba("al 100 % se bloquea", alTope.agotada);
await consultar(`UPDATE ai_cuota SET anulada_hasta = now() + interval '1 day' WHERE usuario_id = $1`, [usuario.id]);
const anulada = await miConsumo({ id: usuario.id, rol: "admin" });
prueba("el administrador puede anular la cuota", anulada.tope === null && !anulada.agotada);
await consultar(`DELETE FROM ai_cuota WHERE usuario_id = $1`, [usuario.id]);
await consultar(`DELETE FROM ai_uso WHERE id = $1`, [uso!.id]);

// ── 6. Base de conocimiento por agente ────────────────────────────────────────
const deConta = await buscarConocimiento("agente_contabilidad", "retención de ISR por servicios");
prueba("el agente de contabilidad recupera su norma", deConta.some((f) => f.titulo === marca));
prueba("avisa que la norma lleva más de 90 días sin verificar", deConta.find((f) => f.titulo === marca)?.sinVerificar === true);
const deEstudiante = await buscarConocimiento("agente_estudiante", "retención de ISR por servicios");
prueba("el agente del estudiante NO la recupera", !deEstudiante.some((f) => f.titulo === marca));
await borrarFrag();

const trozos = trocear("Párrafo uno.\n\n" + "Frase larga. ".repeat(300) + "\n\nÚltimo párrafo.");
prueba("trocear parte textos largos sin pasar del máximo", trozos.length > 1 && trozos.every((t) => t.length <= 1700));

// ── Limpieza: se borran las filas de la prueba en orden inverso ───────────────
for (const id of creadas.reverse()) await consultar("DELETE FROM ai_accion WHERE id = $1", [id]);
const final = await verificarCadena();
prueba("tras limpiar, la cadena vuelve a ser válida", final.ok, `${final.filas} filas`);

await pool.end();
console.log(fallos === 0 ? "\n✓ Nexus AI: todas las pruebas pasan" : `\n✗ ${fallos} prueba(s) fallan`);
process.exit(fallos === 0 ? 0 : 1);
