import { headers } from "next/headers";

import type { UsuarioSesion } from "@/lib/auth";
import { consultarUna, type ContextoTransaccion } from "@/lib/db";
import type { Permiso } from "@/lib/rbac";

/**
 * El contexto que la bitácora copia en cada fila: quién, desde dónde y
 * con qué navegador. Se arma en el servidor con las cabeceras de la
 * petición; nada de esto lo manda el cliente.
 *
 * `x-forwarded-for` puede traer una cadena de proxies: la primera IP es la
 * de quien hizo la petición, las demás son saltos intermedios.
 */
export async function contextoDe(usuario: UsuarioSesion): Promise<ContextoTransaccion> {
  const cabeceras = await headers();
  const ip =
    cabeceras.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    cabeceras.get("x-real-ip") ??
    undefined;

  return {
    usuarioId: usuario.id,
    ip,
    agente: cabeceras.get("user-agent")?.slice(0, 300) ?? undefined,
    sesionId: usuario.authUserId,
  };
}

/**
 * Cuántas OTRAS personas activas tienen un permiso, contando su rol y sus
 * excepciones de `usuario_permiso`.
 *
 * Sirve a la regla "quien registra no aprueba" (§2.2): si hay alguien más
 * que pueda aprobar, la acción se rechaza; si la cuenta es la única con el
 * permiso, se permite y queda dicho en la bitácora. Sin esa salida, una
 * Fundación con una sola contable no podría contabilizar nada.
 */
export async function otrosConPermiso(usuarioId: string, permiso: Permiso): Promise<number> {
  const fila = await consultarUna<{ n: number }>(
    `SELECT count(*)::int AS n
       FROM usuario u
       JOIN permiso p ON p.codigo = $2
      WHERE u.activo
        AND u.id <> $1
        AND coalesce(
              (SELECT up.concedido FROM usuario_permiso up
                WHERE up.usuario_id = u.id AND up.permiso_id = p.id),
              EXISTS (SELECT 1 FROM rol_permiso rp
                       WHERE rp.rol_id = u.rol_id AND rp.permiso_id = p.id))`,
    [usuarioId, permiso],
  );
  return fila?.n ?? 0;
}

/**
 * Traduce el error de una función de la base a un estado que la pantalla
 * sabe explicar. Las funciones de 0035/0036 lanzan con textos fijos; lo
 * que no se reconozca queda como "error" y se anota en el servidor.
 */
export function estadoDeError(error: unknown): EstadoErrorContable {
  const mensaje = error instanceof Error ? error.message : String(error);
  if (mensaje.includes("período contable está cerrado")) return "periodo_cerrado";
  if (mensaje.includes("conciliad")) return "conciliado";
  if (mensaje.includes("tasa de cambio")) return "sin_tasa";
  if (mensaje.includes("no tiene cuenta contable")) return "categoria_sin_cuenta";
  if (mensaje.includes("cobró")) return "cheque_cobrado";
  if (mensaje.includes("misma moneda")) return "montos_distintos";
  if (mensaje.includes("está cerrada")) return "cuenta_cerrada";
  console.error("[contabilidad]", error);
  return "error";
}

export type EstadoErrorContable =
  | "periodo_cerrado"
  | "conciliado"
  | "sin_tasa"
  | "categoria_sin_cuenta"
  | "cheque_cobrado"
  | "montos_distintos"
  | "cuenta_cerrada"
  | "error";
