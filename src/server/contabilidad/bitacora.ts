/**
 * Registro de lecturas sensibles en la bitácora de contabilidad.
 *
 * El disparador SQL captura los cambios (INSERT/UPDATE/DELETE).
 * Las lecturas, en cambio, no pasan por la base, así que las
 * registra la app con esta función. Casos obligatorios:
 *   - Abrir la nómina o el volante de un empleado
 *   - Exportar cualquier reporte o archivo
 *   - Descargar adjuntos del módulo contable
 */

import type { PoolClient } from "pg";

import { enTransaccionComo, type ContextoTransaccion } from "@/lib/db";

/** Acciones de lectura que deben quedar en la bitácora. */
type AccionLectura = "exportar" | "ver_nomina" | "leer";

/** Acciones con nombre propio que una escritura puede declarar. */
type AccionEscritura =
  | "aprobar"
  | "anular"
  | "pagar"
  | "conciliar"
  | "cerrar_periodo"
  | "reabrir_periodo";

/**
 * Registra una lectura sensible en `contabilidad.bitacora`.
 *
 * Se llama desde el servidor (server action o route handler) justo
 * antes de servir el dato al cliente.
 */
export async function registrarLectura(
  contexto: ContextoTransaccion,
  accion: AccionLectura,
  tabla: string,
  registroId?: string,
  motivo?: string,
): Promise<void> {
  // La cadena de hash (orden, hash_anterior, hash) la pone el disparador
  // tg_bitacora_encadenar (0035). Calcularla aquí abriría una segunda
  // implementación que tarde o temprano dejaría de coincidir con la de
  // verificar_bitacora().
  await enTransaccionComo(contexto, async (cliente: PoolClient) => {
    await cliente.query(
      `INSERT INTO contabilidad.bitacora (
         usuario_id, usuario_nombre, usuario_email, usuario_rol,
         ip, agente, sesion_id,
         accion, tabla, registro_id, motivo, hash
       )
       SELECT $1::uuid, u.nombre, u.email::text, r.nombre,
              $2, $3, $4,
              $5, $6, $7::uuid, $8, ''
         FROM public.usuario u
         JOIN public.rol r ON r.id = u.rol_id
        WHERE u.id = $1::uuid`,
      [
        contexto.usuarioId,
        contexto.ip ?? null,
        contexto.agente ?? null,
        contexto.sesionId ?? null,
        accion,
        tabla,
        registroId ?? null,
        motivo ?? null,
      ],
    );
  });
}

/**
 * Da nombre a lo que la transacción está a punto de escribir.
 *
 * El disparador solo ve INSERT o UPDATE; para el auditor, "editar" un
 * recibo y "anularlo" no son lo mismo. Se llama dentro de
 * `enTransaccionComo`, justo antes del UPDATE, y vale hasta el final de
 * la transacción (o hasta la siguiente llamada).
 */
export async function fijarAccion(
  cliente: PoolClient,
  accion: AccionEscritura,
  motivo?: string,
): Promise<void> {
  await cliente.query(
    `SELECT set_config('app.accion', $1, true), set_config('app.motivo', $2, true)`,
    [accion, motivo ?? ""],
  );
}

/**
 * Helper para construir el contexto desde los headers de Next.js.
 *
 * Úsalo en server actions y route handlers:
 *
 *   const ctx = contextoDesdeHeaders(usuario.id, request.headers);
 *   await registrarLectura(ctx, 'exportar', 'recibo', id);
 */
export function contextoDesdeHeaders(
  usuarioId: string,
  headers: Headers,
): ContextoTransaccion {
  return {
    usuarioId,
    ip:       headers.get("x-forwarded-for") ?? headers.get("x-real-ip") ?? undefined,
    agente:   headers.get("user-agent")       ?? undefined,
    sesionId: headers.get("x-sesion-id")      ?? undefined,
  };
}
