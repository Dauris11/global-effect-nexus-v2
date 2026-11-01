"use server";

import { requerirUsuario } from "@/lib/auth";
import { consultarUna } from "@/lib/db";
import {
  usuarioTienePermiso,
} from "@/lib/rbac";
import { miConsumo, type Consumo } from "@/server/ia/agente";
import { actualizarAccion } from "@/server/ia/cadena";
import { buscarHerramienta } from "@/server/ia/herramientas";

/**
 * Lo que la PERSONA hace con lo que el agente propone: aprobar, rechazar,
 * deshacer. Son peticiones suyas, con su sesión: el modelo no puede llamarlas.
 *
 * Toda acción se busca por id Y por `usuario_id`: nadie aprueba, rechaza ni
 * deshace lo que propuso el agente de otra persona.
 */

type FilaAccion = {
  id: string;
  herramienta: string;
  argumentos: Record<string, unknown> | null;
  estado: string;
  agente_clave: string;
  entidad_tipo: string | null;
  entidad_id: string | null;
  deshacer: Record<string, unknown> | null;
  reversible: boolean;
  deshecha_el: string | null;
};

export type ResultadoAccionIA =
  | { ok: true; texto: string; reversible: boolean }
  | { ok: false; error: "no_encontrada" | "estado" | "permiso" | "fallo"; texto?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function cargar(accionId: string, usuarioId: string): Promise<FilaAccion | null> {
  if (!UUID.test(accionId)) return null;

  return consultarUna<FilaAccion>(
    `SELECT id, herramienta, argumentos, estado, agente_clave, entidad_tipo,
            entidad_id::text, deshacer, reversible, deshecha_el::text
       FROM ai_accion WHERE id = $1 AND usuario_id = $2`,
    [accionId, usuarioId],
  );
}

export async function aprobarAccionIA(accionId: string): Promise<ResultadoAccionIA> {
  const usuario = await requerirUsuario();
  const accion = await cargar(accionId, usuario.id);

  if (!accion) return { ok: false, error: "no_encontrada" };
  // Solo una propuesta se aprueba, y una sola vez: sin esto, un doble clic crea dos tareas.
  if (accion.estado !== "propuesta") return { ok: false, error: "estado" };

  const herramienta = buscarHerramienta(accion.herramienta);

  if (
    !herramienta ||
    !herramienta.roles.includes(usuario.rol) ||
    (herramienta.permiso && !usuarioTienePermiso(usuario, herramienta.permiso))
  ) {
    return { ok: false, error: "permiso" };
  }

  // Se marca aprobada ANTES de ejecutar y con una condición: el UPDATE devuelve
  // fila solo a la primera petición, que es la que ejecuta.
  const tomada = await consultarUna<{ id: string }>(
    `UPDATE ai_accion SET estado = 'aprobada', aprobador_id = $2
      WHERE id = $1 AND estado = 'propuesta' RETURNING id`,
    [accion.id, usuario.id],
  );

  if (!tomada) return { ok: false, error: "estado" };

  try {
    const resultado = await herramienta.ejecutar(
      usuario,
      accion.argumentos ?? {},
      { agente: accion.agente_clave },
    );

    const reversible = resultado.ok && Boolean(herramienta.deshacer);

    await actualizarAccion(accion.id, {
      estado: resultado.ok ? "ejecutada" : "fallida",
      resultado: { texto: resultado.texto.slice(0, 500) },
      entidad: resultado.entidad ?? null,
      reversible,
      deshacer: resultado.deshacer ?? null,
    });

    return resultado.ok
      ? { ok: true, texto: resultado.texto, reversible }
      : { ok: false, error: "fallo", texto: resultado.texto };
  } catch (error) {
    console.error("[ia] fallo al ejecutar una acción aprobada", error);
    await actualizarAccion(accion.id, { estado: "fallida" });

    return { ok: false, error: "fallo" };
  }
}

export async function rechazarAccionIA(accionId: string): Promise<ResultadoAccionIA> {
  const usuario = await requerirUsuario();
  const accion = await cargar(accionId, usuario.id);

  if (!accion) return { ok: false, error: "no_encontrada" };

  const rechazada = await consultarUna<{ id: string }>(
    `UPDATE ai_accion SET estado = 'rechazada', aprobador_id = $2
      WHERE id = $1 AND estado = 'propuesta' RETURNING id`,
    [accion.id, usuario.id],
  );

  return rechazada ? { ok: true, texto: "", reversible: false } : { ok: false, error: "estado" };
}

export async function deshacerAccionIA(accionId: string): Promise<ResultadoAccionIA> {
  const usuario = await requerirUsuario();
  const accion = await cargar(accionId, usuario.id);

  if (!accion) return { ok: false, error: "no_encontrada" };
  if (accion.estado !== "ejecutada" || !accion.reversible || accion.deshecha_el) {
    return { ok: false, error: "estado" };
  }

  const herramienta = buscarHerramienta(accion.herramienta);

  if (
    !herramienta?.deshacer ||
    (herramienta.permiso && !usuarioTienePermiso(usuario, herramienta.permiso))
  ) {
    return { ok: false, error: "permiso" };
  }

  // Se reclama el deshacer antes, igual que la aprobación: una sola petición lo hace.
  const tomada = await consultarUna<{ id: string }>(
    `UPDATE ai_accion SET deshecha_el = now()
      WHERE id = $1 AND deshecha_el IS NULL RETURNING id`,
    [accion.id],
  );

  if (!tomada) return { ok: false, error: "estado" };

  const deshecho = await herramienta
    .deshacer(
      usuario,
      {
        entidad_tipo: accion.entidad_tipo,
        entidad_id: accion.entidad_id,
        deshacer: accion.deshacer,
      },
    )
    .catch(() => false);

  if (!deshecho) {
    // No se pudo (p. ej. a la tarea ya le colgaron cosas): se libera para reintentar.
    await consultarUna("UPDATE ai_accion SET deshecha_el = NULL WHERE id = $1 RETURNING id", [
      accion.id,
    ]);

    return { ok: false, error: "fallo" };
  }

  return { ok: true, texto: "", reversible: false };
}

/** Consumo del mes de quien pregunta, para el medidor del botón flotante. */
export async function miConsumoIA(): Promise<Consumo> {
  const usuario = await requerirUsuario();

  return miConsumo({ id: usuario.id, rol: usuario.rol });
}
