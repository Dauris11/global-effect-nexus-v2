// Pruebas del tablero de actividad: las consultas ejecutan, agrupan bien y
// respetan los filtros. Inserta eventos de prueba en audit_log y los retira.
// Uso: npx tsx scripts/probar-actividad.ts
import { config } from "dotenv";

config({ path: ".env.local" });

const { consultar, consultarUna, pool } = await import("../src/lib/db");
const a = await import("../src/server/auditoria/actividad");
const { registrar } = await import("../src/lib/auditoria");

let fallos = 0;
const prueba = (nombre: string, ok: boolean, detalle = "") => {
  console.log(`${ok ? "✓" : "✗"} ${nombre}${detalle ? ` — ${detalle}` : ""}`);
  if (!ok) fallos++;
};

const usuario = await consultarUna<{ id: string }>("SELECT id FROM usuario WHERE activo LIMIT 1");
if (!usuario) throw new Error("No hay usuarios");

const marca = `prueba-actividad-${Date.now()}`;

prueba("rangoValido cae en 7 con un valor raro", a.rangoValido("x") === 7 && a.rangoValido("30") === 30 && a.rangoValido(1) === 1);

// Tres eventos propios y un intento fallido sin autor
await registrar({ usuarioId: usuario.id, accion: "tarea.creada", entidad: marca });
await registrar({ usuarioId: usuario.id, accion: "tarea.movida", entidad: marca });
await registrar({ usuarioId: usuario.id, accion: "sesion.iniciada", entidad: marca });
await registrar({ usuarioId: null, accion: "sesion.fallida", entidad: marca, datos: { email: "x@y.z" } });

try {
  const resumen = await a.resumenDeActividad(1);
  prueba("el resumen cuenta los eventos de hoy", resumen.eventos >= 4 && resumen.sesiones >= 1 && resumen.fallidas >= 1, JSON.stringify(resumen));

  const horas = await a.actividadPorHora(1);
  prueba("hay 24 horas, con las vacías incluidas", horas.length === 24);
  prueba("la suma por hora coincide con el total", horas.reduce((s, h) => s + h.eventos, 0) === resumen.eventos);

  const dias = await a.actividadPorDia(7);
  prueba("hay un cubo por día del rango (7)", dias.length === 7, String(dias.length));
  const hoy = dias.at(-1)!;
  prueba("hoy suma al menos los eventos de prueba", hoy.eventos >= 4);

  const personas = await a.actividadPorPersona(1);
  prueba("los intentos fallidos no se atribuyen a nadie", !personas.some((p) => p.id === null));
  prueba("la persona de prueba aparece con sus eventos", (personas.find((p) => p.id === usuario.id)?.eventos ?? 0) >= 3);

  const modulos = await a.actividadPorModulo(1);
  prueba("agrupa por módulo (antes del primer punto)", modulos.some((m) => m.modulo === "tarea") && modulos.some((m) => m.modulo === "sesion"));

  const filtrada = await a.lineaDeTiempo({ dias: 1, usuarioId: usuario.id, modulo: "tarea" });
  prueba("la línea de tiempo filtra por persona y módulo", filtrada.eventos.length >= 2 && filtrada.eventos.every((e) => e.accion.startsWith("tarea.")));
  prueba("ordena del más reciente al más antiguo", filtrada.eventos.every((e, i, l) => i === 0 || l[i - 1]!.cuando >= e.cuando));

  const sinAutor = await a.lineaDeTiempo({ dias: 1, modulo: "sesion" });
  prueba("el intento fallido sale con persona nula", sinAutor.eventos.some((e) => e.accion === "sesion.fallida" && e.persona === null));

  const porOrigen = await a.lineaDeTiempo({ dias: 90, origen: "contabilidad" });
  prueba("filtra por origen (bitácora contable)", porOrigen.eventos.every((e) => e.origen === "contabilidad"), `${porOrigen.total} eventos`);

  const paginas = await a.lineaDeTiempo({ dias: 90, pagina: 2 });
  prueba("pagina sin repetir", paginas.eventos.length <= a.POR_PAGINA_LINEA);

  // Presencia: solo escribe si pasaron más de 5 minutos
  await consultar("UPDATE usuario SET ultimo_acceso = now() - interval '1 hour' WHERE id = $1", [usuario.id]);
  await a.marcarPresencia(usuario.id);
  const p1 = await consultarUna<{ minutos: number }>("SELECT (extract(epoch FROM now() - ultimo_acceso) / 60)::int AS minutos FROM usuario WHERE id = $1", [usuario.id]);
  prueba("la presencia se actualiza si pasó más de 5 minutos", (p1?.minutos ?? 99) < 1);
  const antes = await consultarUna<{ t: string }>("SELECT ultimo_acceso::text AS t FROM usuario WHERE id = $1", [usuario.id]);
  await a.marcarPresencia(usuario.id);
  const despues = await consultarUna<{ t: string }>("SELECT ultimo_acceso::text AS t FROM usuario WHERE id = $1", [usuario.id]);
  prueba("y no escribe otra vez dentro de los 5 minutos", antes?.t === despues?.t);

  const exportadas = await a.actividadParaExportar({ dias: 1, usuarioId: usuario.id, modulo: "tarea" });
  prueba("la exportación trae el correo y respeta los filtros", exportadas.length >= 2 && exportadas.every((f) => f.accion.startsWith("tarea.") && Boolean(f.correo)));

  const conectados = await a.conectadosRecientes();
  prueba("los conectados incluyen a quien acaba de entrar", conectados.some((c) => c.id === usuario.id && c.minutos < 10));
} finally {
  await consultar("DELETE FROM audit_log WHERE entidad = $1", [marca]);
}

await pool.end();
console.log(fallos === 0 ? "\n✓ Actividad: todas las pruebas pasan" : `\n✗ ${fallos} prueba(s) fallan`);
process.exit(fallos === 0 ? 0 : 1);
