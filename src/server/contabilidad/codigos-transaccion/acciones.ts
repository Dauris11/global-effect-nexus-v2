"use server";

import { revalidatePath } from "next/cache";

import { requerirUsuario } from "@/lib/auth";
import { enTransaccionComo } from "@/lib/db";
import { definicionDe } from "@/lib/contabilidad/codigos-transaccion";
import { esUuid } from "@/lib/contabilidad/formato";
import { usuarioTienePermiso } from "@/lib/rbac";
import { contextoDe, estadoDeError, type EstadoErrorContable } from "@/server/contabilidad/sesion";

/**
 * Escrituras de los códigos de transacción. Todas exigen `contabilidad.configurar`
 * (se comprueba aquí, no solo en la pantalla) y van por `enTransaccionComo`,
 * porque la bitácora de la base aborta cualquier escritura sin usuario.
 * Nada se borra: desasignar un código es poner su `cuenta_id` en NULL.
 */

export type EstadoCodigos = {
  estado:
    | "ok"
    | "no_permitido"
    | "codigo_desconocido"
    | "naturaleza_invalida"
    | "cuenta_invalida"
    | "datos_invalidos"
    | EstadoErrorContable;
};

type Estado = EstadoCodigos["estado"];

class Rechazo extends Error {
  constructor(public readonly estado: Estado) {
    super(estado);
  }
}

async function ejecutar(trabajo: (cliente: import("pg").PoolClient, usuarioId: string) => Promise<void>): Promise<EstadoCodigos> {
  const usuario = await requerirUsuario();
  if (!usuarioTienePermiso(usuario, "contabilidad.configurar")) return { estado: "no_permitido" };
  try {
    await enTransaccionComo(await contextoDe(usuario), (cliente) => trabajo(cliente, usuario.id));
  } catch (error) {
    if (error instanceof Rechazo) return { estado: error.estado };
    return { estado: estadoDeError(error) };
  }
  revalidatePath("/[locale]/contabilidad/configuracion", "page");
  return { estado: "ok" };
}

/** Cambia el lado (débito o crédito) de un código. Crea la fila si aún no existía. */
export async function guardarNaturalezaCodigo(codigo: string, naturaleza: string): Promise<EstadoCodigos> {
  if (naturaleza !== "debito" && naturaleza !== "credito") return { estado: "naturaleza_invalida" };
  if (!definicionDe(codigo)) return { estado: "codigo_desconocido" };
  return ejecutar(async (cliente, usuarioId) => {
    await cliente.query(
      `INSERT INTO contabilidad.codigo_transaccion (codigo, naturaleza, actualizado_por)
       VALUES ($1, $2, $3)
       ON CONFLICT (codigo) DO UPDATE
         SET naturaleza = EXCLUDED.naturaleza, actualizado_por = EXCLUDED.actualizado_por, actualizado_en = now()`,
      [codigo, naturaleza, usuarioId],
    );
  });
}

/**
 * Deja asignados EXACTAMENTE estos códigos a la cuenta: mueve los que estaban
 * en otra y libera los que ya no vienen. Asignar propósito a una cuenta no
 * depende de que tenga asientos: por eso no pasa por las reglas de `editarCuenta`.
 */
export async function asignarCodigosACuenta(cuentaId: string, codigos: string[]): Promise<EstadoCodigos> {
  if (!esUuid(cuentaId) || !Array.isArray(codigos)) return { estado: "datos_invalidos" };
  const unicos = [...new Set(codigos)];
  if (unicos.some((c) => typeof c !== "string" || !definicionDe(c))) return { estado: "codigo_desconocido" };

  return ejecutar(async (cliente, usuarioId) => {
    const { rows } = await cliente.query<{ ok: boolean }>(
      `SELECT (activa AND admite_movimiento) AS ok FROM contabilidad.cuenta_contable WHERE id = $1 FOR SHARE`,
      [cuentaId],
    );
    if (!rows[0]?.ok) throw new Rechazo("cuenta_invalida");

    // Libera lo que tenía y ya no viene (queda su naturaleza, sin cuenta).
    await cliente.query(
      `UPDATE contabilidad.codigo_transaccion
          SET cuenta_id = NULL, actualizado_por = $3, actualizado_en = now()
        WHERE cuenta_id = $1 AND NOT (codigo = ANY($2::text[]))`,
      [cuentaId, unicos, usuarioId],
    );
    // Asigna y mueve; si el código no tenía fila nace con su naturaleza por defecto.
    for (const codigo of unicos) {
      await cliente.query(
        `INSERT INTO contabilidad.codigo_transaccion (codigo, naturaleza, cuenta_id, actualizado_por)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (codigo) DO UPDATE
           SET cuenta_id = EXCLUDED.cuenta_id, actualizado_por = EXCLUDED.actualizado_por, actualizado_en = now()`,
        [codigo, definicionDe(codigo)!.naturaleza, cuentaId, usuarioId],
      );
    }
  });
}
