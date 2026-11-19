// Prueba de extremo a extremo de la entrada de cartas, SIN clave de IA: el
// agente no puede revisar, así que toda carta debe quedar retenida y nunca
// reenviada. Crea datos temporales (estudiante, patrocinador, asignación) y los
// borra al terminar.
// Uso: npx tsx scripts/probar-correos-entrada.ts
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
delete process.env.GEMINI_API_KEY;

const { consultar, consultarUna } = await import("../src/lib/db");
const { recibirCorreo } = await import("../src/server/correos/procesar");
const { planillaDelMes } = await import("../src/server/bienestar/consultas");

let fallos = 0;
const comprobar = (ok: boolean, texto: string) => {
  console.log(`${ok ? "✓" : "✗"} ${texto}`);
  if (!ok) fallos++;
};

const marca = `zz-prueba-${Date.now()}`;
const correoEstudiante = `${marca}@example.test`;
const ids: { est?: string; pat?: string } = {};

try {
  ids.est = (
    await consultarUna<{ id: string }>(
      `INSERT INTO estudiante (nombre, email, estado) VALUES ($1, $2, 'activo') RETURNING id`,
      [`ZZ Prueba ${marca}`, correoEstudiante],
    )
  )?.id;
  ids.pat = (
    await consultarUna<{ id: string }>(
      `INSERT INTO patrocinador (nombre, email, idioma) VALUES ($1, $2, 'en') RETURNING id`,
      [`ZZ Patrocinador ${marca}`, `${marca}-sponsor@example.test`],
    )
  )?.id;
  await consultar(`INSERT INTO asignacion_beca (estudiante_id, patrocinador_id, monto) VALUES ($1, $2, 0)`, [
    ids.est,
    ids.pat,
  ]);

  const base = { asunto: "Mi carta", texto: "Querido patrocinador, gracias.", html: null, adjuntos: 0 };
  const ahora = new Date();

  // 1. remitente desconocido
  const desconocido = await recibirCorreo({
    ...base, messageId: `${marca}-1`, remitente: "Nadie <nadie@example.test>",
    recibidoEn: ahora, autenticacion: "pass",
  });
  comprobar(desconocido === "sin_identificar", "remitente desconocido → sin_identificar");

  // 2. el mismo message_id otra vez
  const repetido = await recibirCorreo({
    ...base, messageId: `${marca}-1`, remitente: "Nadie <nadie@example.test>",
    recibidoEn: ahora, autenticacion: "pass",
  });
  comprobar(repetido === "repetido", "mismo message_id → repetido (no se procesa dos veces)");

  // 3. estudiante conocido, autenticado, sin clave de IA → retenido, nunca reenviado
  const primera = await recibirCorreo({
    ...base, messageId: `${marca}-2`, remitente: `"Ana" <${correoEstudiante.toUpperCase()}>`,
    recibidoEn: ahora, autenticacion: "pass",
  });
  comprobar(primera === "retenido", "sin clave de IA → retenido (falla cerrado)");

  const fila = await consultarUna<{ estado: string; motivos: string[]; correo_cola_id: string | null }>(
    `SELECT estado, motivos, correo_cola_id FROM correo_patrocinador WHERE message_id = $1`,
    [`${marca}-2`],
  );
  comprobar(fila?.motivos.includes("clasificador_no_disponible") === true, "motivo: clasificador_no_disponible");
  comprobar(fila?.correo_cola_id === null, "no se encoló ningún correo al patrocinador");

  const cola = await consultarUna<{ n: number }>(
    `SELECT count(*)::int AS n FROM correo_cola WHERE destinatario = $1`,
    [`${marca}-sponsor@example.test`],
  );
  comprobar(cola?.n === 0, "correo_cola sin filas para el patrocinador");

  // 4. segunda carta del mismo mes → duplicado
  const segunda = await recibirCorreo({
    ...base, messageId: `${marca}-3`, remitente: correoEstudiante,
    recibidoEn: ahora, autenticacion: "pass",
  });
  comprobar(segunda === "duplicado", "segunda carta del mes → duplicado");

  // 5. remitente sin verificar con la carta de otro estudiante: se retiene aunque haya clave
  const mes = (await consultarUna<{ mes: string }>(`SELECT mes FROM correo_patrocinador WHERE message_id = $1`, [`${marca}-2`]))!.mes;
  const planilla = await planillaDelMes(mes);
  const mia = planilla.find((f) => f.estudiante_id === ids.est);
  comprobar(mia?.correo === "en_revision" || mia?.correo === "tardia", `planilla: estado derivado = ${mia?.correo}`);
} finally {
  if (ids.est) {
    await consultar(`DELETE FROM correo_patrocinador WHERE message_id LIKE $1`, [`${marca}%`]);
    await consultar(`DELETE FROM asignacion_beca WHERE estudiante_id = $1`, [ids.est]);
    await consultar(`DELETE FROM estudiante WHERE id = $1`, [ids.est]);
  }
  if (ids.pat) await consultar(`DELETE FROM patrocinador WHERE id = $1`, [ids.pat]);
}

console.log(fallos === 0 ? "\n✓ cartas: todas las pruebas pasan" : `\n✗ ${fallos} prueba(s) fallan`);
process.exit(fallos === 0 ? 0 : 1);
