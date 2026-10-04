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
import type { Permiso } from "@/lib/rbac";

/** Acciones de lectura que deben quedar en la bitácora. */
type AccionLectura = "exportar" | "ver_nomina" | "leer";

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
  await enTransaccionComo(contexto, async (cliente: PoolClient) => {
    // Calculamos el hash de esta fila encadenado con el anterior.
    // Para lecturas, antes y despues son null; el hash sigue la cadena
    // para no romperla si se intercalan lecturas entre escrituras.
    const { rows } = await cliente.query<{ hash: string }>(
      `SELECT hash
         FROM contabilidad.bitacora
        WHERE tabla = $1
        ORDER BY ocurrido_en DESC, id DESC
        LIMIT 1`,
      [tabla],
    );

    const hashAnterior = rows[0]?.hash ?? null;

    const cadena = [
      hashAnterior ?? "",
      contexto.usuarioId,
      accion,
      tabla,
      registroId ?? "",
      "", // antes (null en lectura)
      "", // despues (null en lectura)
    ].join("");

    // Delegamos el cálculo del hash y la inserción a SQL para usar pgcrypto.
    await cliente.query(
      `INSERT INTO contabilidad.bitacora (
         usuario_id, usuario_nombre, usuario_email, usuario_rol,
         ip, agente, sesion_id,
         accion, tabla, registro_id,
         antes, despues, motivo,
         hash_anterior, hash
       )
       SELECT
         $1::uuid,
         u.nombre,
         u.email::text,
         r.nombre,
         $2, $3, $4,
         $5, $6, $7::uuid,
         NULL, NULL, $8,
         $9,
         encode(digest($10, 'sha256'), 'hex')
         FROM public.usuario u
         JOIN public.rol r ON r.id = u.rol_id
        WHERE u.id = $1::uuid`,
      [
        contexto.usuarioId,
        contexto.ip       ?? "",
        contexto.agente   ?? "",
        contexto.sesionId ?? "",
        accion,
        tabla,
        registroId ?? null,
        motivo ?? null,
        hashAnterior,
        cadena,
      ],
    );
  });
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
