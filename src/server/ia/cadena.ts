import { createHash, randomUUID } from "node:crypto";

import { consultar, enTransaccion } from "@/lib/db";

/**
 * Registro de acciones del agente (`ai_accion`) con cadena SHA-256.
 *
 * Cada fila guarda el hash de la anterior (`hash_previo`) y el suyo (`hash`),
 * calculado sobre lo que NO cambia después: quién, qué herramienta, con qué
 * argumentos y cuándo se propuso. Borrar o editar una fila vieja rompe la
 * cadena y `verificarCadena` lo encuentra.
 *
 * El estado (propuesta → ejecutada) y el resultado SÍ cambian y quedan fuera
 * del hash; el rastro de la ejecución real está en `audit_log`, porque la acción
 * llama a las mismas funciones que las pantallas y estas ya registran ahí.
 */

export const GENESIS = "0".repeat(64);

/** Claves que nunca se guardan, ni siquiera truncadas. */
const SECRETOS = /clave|token|password|contrase|secret/i;

/** Argumentos sin secretos y con textos acotados: es lo que se archiva. */
export function sanitizar(valor: unknown, profundidad = 0): unknown {
  if (valor === null || typeof valor === "number" || typeof valor === "boolean") return valor;
  if (typeof valor === "string") return valor.slice(0, 1000);
  if (profundidad > 3) return "[recortado]";
  if (Array.isArray(valor)) return valor.slice(0, 20).map((v) => sanitizar(v, profundidad + 1));

  if (typeof valor === "object") {
    return Object.fromEntries(
      Object.entries(valor as Record<string, unknown>).map(([k, v]) => [
        k,
        SECRETOS.test(k) ? "[omitido]" : sanitizar(v, profundidad + 1),
      ]),
    );
  }

  return undefined;
}

/** JSON con las claves ordenadas: el mismo objeto da siempre el mismo hash. */
function canonico(valor: unknown): string {
  return JSON.stringify(valor, (_clave, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );
}

export function calcularHash(
  previo: string,
  datos: {
    id: string;
    usuarioId: string;
    agente: string;
    herramienta: string;
    argumentos: unknown;
    creadaEn: string;
  },
): string {
  return createHash("sha256")
    .update(previo)
    .update(canonico(datos))
    .digest("hex");
}

export type Estado = "propuesta" | "aprobada" | "rechazada" | "ejecutada" | "fallida";

export async function registrarAccion(datos: {
  usuarioId: string;
  agente: string;
  conversacionId?: string | null;
  herramienta: string;
  argumentos: Record<string, unknown>;
  estado: Estado;
}): Promise<string> {
  const id = randomUUID();
  const argumentos = sanitizar(datos.argumentos);
  const creadaEn = new Date().toISOString();

  await enTransaccion(async (cliente) => {
    // Serializa el alta: dos acciones simultáneas no pueden colgar de la misma
    // anterior (el índice único de `hash_previo` es la segunda barrera).
    await cliente.query("SELECT pg_advisory_xact_lock(hashtext('ai_accion_cadena'))");

    const ultima = await cliente.query<{ hash: string }>(
      `SELECT hash FROM ai_accion WHERE hash IS NOT NULL
        ORDER BY created_at DESC, id DESC LIMIT 1`,
    );
    const previo = ultima.rows[0]?.hash ?? GENESIS;

    const hash = calcularHash(previo, {
      id,
      usuarioId: datos.usuarioId,
      agente: datos.agente,
      herramienta: datos.herramienta,
      argumentos,
      creadaEn,
    });

    await cliente.query(
      `INSERT INTO ai_accion
         (id, conversacion_id, usuario_id, agente_clave, herramienta, argumentos,
          estado, created_at, hash_previo, hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        id,
        datos.conversacionId ?? null,
        datos.usuarioId,
        datos.agente,
        datos.herramienta,
        JSON.stringify(argumentos),
        datos.estado,
        creadaEn,
        previo,
        hash,
      ],
    );
  });

  return id;
}

export async function actualizarAccion(
  id: string,
  cambios: {
    estado: Estado;
    resultado?: unknown;
    aprobadorId?: string | null;
    entidad?: { tipo: string; id: string } | null;
    reversible?: boolean;
    deshacer?: Record<string, unknown> | null;
  },
) {
  await consultar(
    `UPDATE ai_accion
        SET estado = $2,
            resultado = COALESCE($3::jsonb, resultado),
            aprobador_id = COALESCE($4, aprobador_id),
            entidad_tipo = COALESCE($5, entidad_tipo),
            entidad_id = COALESCE($6, entidad_id),
            reversible = COALESCE($7, reversible),
            deshacer = COALESCE($8::jsonb, deshacer)
      WHERE id = $1`,
    [
      id,
      cambios.estado,
      cambios.resultado === undefined ? null : JSON.stringify(sanitizar(cambios.resultado)),
      cambios.aprobadorId ?? null,
      cambios.entidad?.tipo ?? null,
      cambios.entidad?.id ?? null,
      cambios.reversible ?? null,
      cambios.deshacer ? JSON.stringify(cambios.deshacer) : null,
    ],
  );
}

/** Recorre la cadena y dice dónde se rompe, si se rompe. */
export async function verificarCadena(): Promise<{ ok: boolean; filas: number; rotoEn?: string }> {
  const filas = await consultar<{
    id: string;
    usuario_id: string;
    agente_clave: string;
    herramienta: string;
    argumentos: unknown;
    created_at: Date;
    hash_previo: string;
    hash: string;
  }>(
    `SELECT id, usuario_id, agente_clave, herramienta, argumentos, created_at, hash_previo, hash
       FROM ai_accion WHERE hash IS NOT NULL ORDER BY created_at, id`,
  );

  let esperado = GENESIS;

  for (const fila of filas) {
    const recalculado = calcularHash(fila.hash_previo, {
      id: fila.id,
      usuarioId: fila.usuario_id,
      agente: fila.agente_clave,
      herramienta: fila.herramienta,
      argumentos: fila.argumentos,
      creadaEn: fila.created_at.toISOString(),
    });

    if (fila.hash_previo !== esperado || fila.hash !== recalculado) {
      return { ok: false, filas: filas.length, rotoEn: fila.id };
    }

    esperado = fila.hash;
  }

  return { ok: true, filas: filas.length };
}
