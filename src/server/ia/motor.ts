import Anthropic from "@anthropic-ai/sdk";

import type { UsoIA } from "@/lib/ia";
import type { EventoTurno } from "@/lib/ia-eventos";
import {
  usuarioTienePermiso,
} from "@/lib/rbac";
import { actualizarAccion, registrarAccion } from "@/server/ia/cadena";
import {
  definiciones,
  herramientasVisibles,
} from "@/server/ia/herramientas";
import type { Herramienta, UsuarioHerramienta } from "@/server/ia/herramientas/tipos";

/**
 * Bucle del agente: el modelo pide herramientas, el motor las atiende y vuelve
 * a llamar hasta que responde con texto.
 *
 * Reglas que este archivo hace cumplir (prompt de IA, §4):
 *
 *   1. El modelo solo ve las herramientas de su rol. Si pide otra, se rechaza y
 *      queda anotado como intento.
 *   2. `automatica` se ejecuta; `confirmacion` solo se PROPONE. La aprobación es
 *      otra petición (`aprobarAccionIA`) hecha por la persona: el modelo nunca
 *      puede aprobarse a sí mismo.
 *   3. Lo que devuelve una herramienta viaja envuelto como dato no confiable.
 *   4. El permiso se vuelve a comprobar aquí aunque la lista ya esté filtrada.
 *
 * El proveedor del modelo se inyecta para poder probar el bucle sin red ni
 * clave (`scripts/probar-nexus-ai.ts`).
 */

export type FlujoModelo = {
  alTexto: (aviso: (texto: string) => void) => void;
  final: () => Promise<Anthropic.Message>;
};

export type ProveedorModelo = (
  parametros: Anthropic.MessageCreateParamsNonStreaming,
) => FlujoModelo;

/** Tope de vueltas: un modelo que encadena herramientas sin parar no gasta sin límite. */
const MAXIMO_PASOS = 6;

/** Marca la última herramienta: la caché cubre desde el principio hasta ese punto. */
function conCache(herramientas: Anthropic.Tool[]): Anthropic.Tool[] {
  return herramientas.map((h, i) =>
    i === herramientas.length - 1 ? { ...h, cache_control: { type: "ephemeral" } } : h,
  );
}

export function proveedorAnthropic(): ProveedorModelo | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const cliente = new Anthropic();

  return (parametros) => {
    const flujo = cliente.messages.stream(parametros);

    return {
      alTexto: (aviso) => void flujo.on("text", aviso),
      final: () => flujo.finalMessage(),
    };
  };
}

export type ResultadoTurno = {
  texto: string;
  uso: UsoIA;
  propuestas: number;
};

export async function ejecutarTurno({
  proveedor,
  usuario,
  idioma,
  agente,
  conversacionId,
  sistema,
  turnos,
  modelo,
  maximoTokens,
  emitir,
}: {
  proveedor: ProveedorModelo;
  usuario: UsuarioHerramienta;
  idioma: "es" | "en";
  agente: string;
  conversacionId: string | null;
  sistema: string;
  turnos: readonly { rol: "user" | "assistant"; contenido: string }[];
  modelo: string;
  maximoTokens: number;
  emitir: (evento: EventoTurno) => void;
}): Promise<ResultadoTurno | { error: "rechazada" | "fallo" }> {
  const visibles = herramientasVisibles(usuario);
  const mensajes: Anthropic.MessageParam[] = turnos.map((t) => ({
    role: t.rol,
    content: t.contenido,
  }));

  const inicio = Date.now();
  let texto = "";
  let entrada = 0;
  let salida = 0;
  let cache = 0;
  let propuestas = 0;

  for (let paso = 0; paso < MAXIMO_PASOS; paso++) {
    const flujo = proveedor({
      model: modelo,
      max_tokens: maximoTokens,
      // Prompt caching del prefijo fijo (instrucciones y herramientas): se paga
      // entero una vez y las vueltas siguientes lo leen de la caché.
      system: [{ type: "text", text: sistema, cache_control: { type: "ephemeral" } }],
      messages: mensajes,
      ...(visibles.length > 0 ? { tools: conCache(definiciones(visibles)) } : {}),
      output_config: { effort: "low" },
    });

    flujo.alTexto((fragmento) => {
      texto += fragmento;
      emitir({ t: "delta", texto: fragmento });
    });

    const respuesta = await flujo.final();

    entrada += respuesta.usage.input_tokens;
    salida += respuesta.usage.output_tokens;
    cache += respuesta.usage.cache_read_input_tokens ?? 0;

    if (respuesta.stop_reason === "refusal") return { error: "rechazada" };
    if (respuesta.stop_reason !== "tool_use") break;

    mensajes.push({ role: "assistant", content: respuesta.content });

    const resultados: Anthropic.ToolResultBlockParam[] = [];

    for (const bloque of respuesta.content) {
      if (bloque.type !== "tool_use") continue;

      const resultado = await atender({
        bloque,
        visibles,
        usuario,
        idioma,
        agente,
        conversacionId,
        emitir,
      });

      if (resultado.propuesta) propuestas++;

      resultados.push({
        type: "tool_result",
        tool_use_id: bloque.id,
        is_error: resultado.error,
        // Dato no confiable: ver la regla de seguridad del prompt base.
        content: `<datos_no_confiables>\n${resultado.texto}\n</datos_no_confiables>`,
      });
    }

    mensajes.push({ role: "user", content: resultados });
  }

  return {
    texto: texto.trim(),
    propuestas,
    uso: { modelo, entrada, salida, cache, latenciaMs: Date.now() - inicio },
  };
}

async function atender({
  bloque,
  visibles,
  usuario,
  idioma,
  agente,
  conversacionId,
  emitir,
}: {
  bloque: Anthropic.ToolUseBlock;
  visibles: readonly Herramienta[];
  usuario: UsuarioHerramienta;
  idioma: "es" | "en";
  agente: string;
  conversacionId: string | null;
  emitir: (evento: EventoTurno) => void;
}): Promise<{ texto: string; error: boolean; propuesta: boolean }> {
  const argumentos = (
    bloque.input && typeof bloque.input === "object" ? bloque.input : {}
  ) as Record<string, unknown>;

  const herramienta = visibles.find((h) => h.nombre === bloque.name);

  // Una herramienta que el rol no tiene: se rechaza y se anota. Que un modelo la
  // pida es una señal (inyección de instrucciones, o un prompt mal armado).
  if (!herramienta || (herramienta.permiso && !usuarioTienePermiso(usuario, herramienta.permiso))) {
    await registrarAccion({
      usuarioId: usuario.id,
      agente,
      conversacionId,
      herramienta: bloque.name,
      argumentos,
      estado: "rechazada",
    }).catch((e) => console.error("[ia] no se pudo anotar el rechazo", e));

    return { texto: "Herramienta no disponible para este rol.", error: true, propuesta: false };
  }

  const resumen = herramienta.resumir(argumentos, idioma);

  if (herramienta.nivel === "confirmacion") {
    const accionId = await registrarAccion({
      usuarioId: usuario.id,
      agente,
      conversacionId,
      herramienta: herramienta.nombre,
      argumentos,
      estado: "propuesta",
    });

    emitir({ t: "aprobacion", accionId, herramienta: herramienta.nombre, resumen });

    return {
      texto:
        "PROPUESTA registrada. NO se ha ejecutado nada: la persona debe aprobarla en la tarjeta. " +
        "No digas que ya está hecho.",
      error: false,
      propuesta: true,
    };
  }

  emitir({ t: "paso", id: bloque.id, herramienta: herramienta.nombre, estado: "ejecutando", resumen });

  const accionId = await registrarAccion({
    usuarioId: usuario.id,
    agente,
    conversacionId,
    herramienta: herramienta.nombre,
    argumentos,
    estado: "aprobada",
  });

  try {
    const resultado = await herramienta.ejecutar(usuario, argumentos, { agente });

    await actualizarAccion(accionId, {
      estado: resultado.ok ? "ejecutada" : "fallida",
      resultado: { texto: resultado.texto.slice(0, 500) },
    });

    emitir({
      t: "paso",
      id: bloque.id,
      herramienta: herramienta.nombre,
      estado: resultado.ok ? "ok" : "error",
      resumen,
    });

    return { texto: resultado.texto, error: !resultado.ok, propuesta: false };
  } catch (error) {
    console.error("[ia] fallo en la herramienta", herramienta.nombre, error);
    await actualizarAccion(accionId, { estado: "fallida" }).catch(() => {});
    emitir({ t: "paso", id: bloque.id, herramienta: herramienta.nombre, estado: "error", resumen });

    return { texto: "La herramienta falló.", error: true, propuesta: false };
  }
}
