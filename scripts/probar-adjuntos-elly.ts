// Prueba REAL (gasta llamadas al modelo) de los adjuntos de Elly: guardar el adjunto, que el
// modelo lo vea en un turno, y las herramientas que lo leen por id. No deja datos: borra la
// carga y el adjunto. Uso: npx tsx scripts/probar-adjuntos-elly.ts <listado.pdf>
import { readFileSync } from "node:fs";

import { config } from "dotenv";

config({ path: ".env.local" });

const ruta = process.argv[2];
const { consultar, consultarUna, pool } = await import("../src/lib/db");
const { guardarAdjunto, obtenerAdjunto } = await import("../src/server/ia/adjuntos");
const { buscarHerramienta } = await import("../src/server/ia/herramientas");
const { ejecutarTurno, proveedorModelo } = await import("../src/server/ia/motor");
const { modeloIA } = await import("../src/lib/modelo-ia");

const admin = await consultarUna<{ id: string; nombre: string; rol: string }>(`SELECT u.id, u.nombre, r.nombre AS rol FROM usuario u JOIN rol r ON r.id = u.rol_id WHERE r.nombre IN ('owner','admin') ORDER BY u.created_at LIMIT 1`);
const usuario = { id: admin!.id, nombre: admin!.nombre, rol: admin!.rol as never, idioma: "es" as const, permisos: [] as never };
const bytes = readFileSync(ruta);
const g = await guardarAdjunto(usuario.id, new File([bytes], "notas.pdf", { type: "application/pdf" }));

if (g.estado !== "ok") throw new Error("no se guardó: " + g.estado);
console.log("adjunto guardado:", g.adjunto.id, g.adjunto.mime);
console.log("otro usuario no lo ve:", (await obtenerAdjunto("00000000-0000-0000-0000-000000000000", g.adjunto.id)) === null);

// 1. El modelo VE el documento y dice qué es.
const emitidos: string[] = [];
const turno = await ejecutarTurno({
  proveedor: proveedorModelo()!,
  usuario: usuario as never,
  idioma: "es",
  agente: "agente_admin",
  conversacionId: null,
  sistema: "Eres Elly AI. Si el mensaje trae un adjunto, di en una frase qué documento es y qué ves. Responde breve.",
  turnos: [{ rol: "user", contenido: `Revisa este documento.\n\n[Adjunto: «notas.pdf» · id ${g.adjunto.id} · application/pdf]` }],
  documento: { mime: g.adjunto.mime, base64: g.base64 },
  modelo: modeloIA(),
  maximoTokens: 400,
  emitir: (e) => {
    if (e.t === "delta") emitidos.push(e.texto);
  },
});

console.log("respuesta de Elly:", "error" in turno ? `ERROR ${turno.error}` : turno.texto.slice(0, 400));

// 2. La herramienta lee el adjunto por id y prepara la carga (borrador).
const preparar = buscarHerramienta("preparar_carga_calificaciones")!;
const r = await preparar.ejecutar(usuario as never, { universidad: "UCATECI", periodo: "2025-2", adjunto_id: g.adjunto.id }, { agente: "agente_admin" });

console.log("preparar_carga_calificaciones:", r.ok, r.texto);
console.log("adjunto borrado tras usarlo:", (await obtenerAdjunto(usuario.id, g.adjunto.id)) === null);

if (r.entidad) {
  const filas = await consultar<{ matricula: string; letra: string; problemas: string[]; estudiante_id: string | null }>(
    `SELECT matricula, letra, problemas, estudiante_id FROM carga_calificaciones_fila WHERE carga_id = $1 ORDER BY orden`,
    [r.entidad.id],
  );

  console.log(filas);
  await consultar(`DELETE FROM carga_calificaciones WHERE id = $1`, [r.entidad.id]);
}

await consultar(`DELETE FROM ia_adjunto WHERE usuario_id = $1`, [usuario.id]);
await pool.end();
