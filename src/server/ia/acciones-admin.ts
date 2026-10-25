"use server";

import { revalidatePath } from "next/cache";

import { registrar } from "@/lib/auditoria";
import { requerirPermiso } from "@/lib/auth";
import { consultarUna } from "@/lib/db";
import { ROLES } from "@/lib/rbac";

/**
 * Escrituras del tablero de Nexus AI: cuotas, precios y configuración de agentes.
 * Solo `ia.administrar`, y todo queda en `audit_log`.
 */

export type EstadoIAAdmin = {
  estado: "inicial" | "ok" | "invalido" | "no_encontrado" | "error";
};

const REFRESCAR = "/[locale]/configuracion/ia";

const numero = (valor: FormDataEntryValue | null) => {
  const n = Number(String(valor ?? "").replace(",", "."));

  return Number.isFinite(n) ? n : NaN;
};

/** Crea o actualiza una cuota mensual de tokens, por rol o por correo. */
export async function guardarCuota(
  _previo: EstadoIAAdmin,
  datos: FormData,
): Promise<EstadoIAAdmin> {
  const admin = await requerirPermiso("ia.administrar");

  const alcance = String(datos.get("alcance") ?? "");
  const quien = String(datos.get("quien") ?? "").trim().toLowerCase();
  const tokens = Math.trunc(numero(datos.get("tokens_mes")));
  const aviso = Math.trunc(numero(datos.get("aviso_pct")) || 80);

  if (!(tokens > 0) || aviso < 1 || aviso > 100) return { estado: "invalido" };

  try {
    if (alcance === "rol") {
      if (!(ROLES as readonly string[]).includes(quien)) return { estado: "invalido" };

      await consultarUna(
        `INSERT INTO ai_cuota (rol, tokens_mes, aviso_pct) VALUES ($1, $2, $3)
         ON CONFLICT (rol) WHERE rol IS NOT NULL
         DO UPDATE SET tokens_mes = EXCLUDED.tokens_mes, aviso_pct = EXCLUDED.aviso_pct
         RETURNING id`,
        [quien, tokens, aviso],
      );
    } else if (alcance === "usuario") {
      const persona = await consultarUna<{ id: string }>(
        "SELECT id FROM usuario WHERE lower(email) = $1",
        [quien],
      );

      if (!persona) return { estado: "no_encontrado" };

      await consultarUna(
        `INSERT INTO ai_cuota (usuario_id, tokens_mes, aviso_pct) VALUES ($1, $2, $3)
         ON CONFLICT (usuario_id) WHERE usuario_id IS NOT NULL
         DO UPDATE SET tokens_mes = EXCLUDED.tokens_mes, aviso_pct = EXCLUDED.aviso_pct
         RETURNING id`,
        [persona.id, tokens, aviso],
      );
    } else {
      return { estado: "invalido" };
    }

    await registrar({
      usuarioId: admin.id,
      accion: "ia.cuota_guardada",
      entidad: "ai_cuota",
      datos: { alcance, quien, tokens, aviso },
    });
  } catch (error) {
    console.error("[ia] no se pudo guardar la cuota", error);

    return { estado: "error" };
  }

  revalidatePath(REFRESCAR, "page");

  return { estado: "ok" };
}

/** Levanta el tope de una cuota durante N días (la anulación del administrador). */
export async function anularCuota(datos: FormData): Promise<void> {
  const admin = await requerirPermiso("ia.administrar");
  const id = String(datos.get("id") ?? "");
  const dias = Math.min(Math.max(Math.trunc(numero(datos.get("dias")) || 7), 1), 90);

  const fila = await consultarUna<{ id: string }>(
    `UPDATE ai_cuota SET anulada_hasta = now() + make_interval(days => $2), anulada_por = $3
      WHERE id = $1 RETURNING id`,
    [id, dias, admin.id],
  ).catch(() => null);

  if (fila) {
    await registrar({
      usuarioId: admin.id,
      accion: "ia.cuota_anulada",
      entidad: "ai_cuota",
      entidadId: fila.id,
      datos: { dias },
    });
  }

  revalidatePath(REFRESCAR, "page");
}

export async function eliminarCuota(datos: FormData): Promise<void> {
  const admin = await requerirPermiso("ia.administrar");
  const id = String(datos.get("id") ?? "");

  const fila = await consultarUna<{ id: string }>(
    "DELETE FROM ai_cuota WHERE id = $1 RETURNING id",
    [id],
  ).catch(() => null);

  if (fila) {
    await registrar({
      usuarioId: admin.id,
      accion: "ia.cuota_eliminada",
      entidad: "ai_cuota",
      entidadId: fila.id,
    });
  }

  revalidatePath(REFRESCAR, "page");
}

/** Precio por millón de tokens de un modelo. Con él se calcula el costo estimado. */
export async function guardarPrecio(
  _previo: EstadoIAAdmin,
  datos: FormData,
): Promise<EstadoIAAdmin> {
  const admin = await requerirPermiso("ia.administrar");

  const modelo = String(datos.get("modelo") ?? "").trim().slice(0, 80);
  const entrada = numero(datos.get("entrada"));
  const salida = numero(datos.get("salida"));
  const cache = numero(datos.get("cache") || "0");

  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(modelo) || !(entrada >= 0) || !(salida >= 0) || !(cache >= 0)) {
    return { estado: "invalido" };
  }

  try {
    await consultarUna(
      `INSERT INTO ai_precio_modelo (modelo, usd_entrada_mtok, usd_salida_mtok, usd_cache_lectura_mtok)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (modelo) DO UPDATE
         SET usd_entrada_mtok = EXCLUDED.usd_entrada_mtok,
             usd_salida_mtok = EXCLUDED.usd_salida_mtok,
             usd_cache_lectura_mtok = EXCLUDED.usd_cache_lectura_mtok,
             vigente_desde = CURRENT_DATE, updated_at = now()
       RETURNING modelo`,
      [modelo, entrada, salida, cache],
    );

    await registrar({
      usuarioId: admin.id,
      accion: "ia.precio_guardado",
      entidad: "ai_precio_modelo",
      datos: { modelo, entrada, salida, cache },
    });
  } catch (error) {
    console.error("[ia] no se pudo guardar el precio", error);

    return { estado: "error" };
  }

  revalidatePath(REFRESCAR, "page");

  return { estado: "ok" };
}

/** Instrucciones, modelo y límites de un agente. */
export async function guardarAgente(
  _previo: EstadoIAAdmin,
  datos: FormData,
): Promise<EstadoIAAdmin> {
  const admin = await requerirPermiso("ia.administrar");

  const clave = String(datos.get("clave") ?? "");
  const instrucciones = String(datos.get("instrucciones") ?? "").trim().slice(0, 4000);
  const modelo = String(datos.get("modelo") ?? "").trim().slice(0, 80);
  const maximo = Math.trunc(numero(datos.get("max_tokens")));
  const limite = Math.trunc(numero(datos.get("limite_hora")));
  const activo = datos.get("activo") === "on";

  if (modelo && !/^[a-z0-9][a-z0-9._-]*$/i.test(modelo)) return { estado: "invalido" };
  if (!(limite > 0 && limite <= 1000)) return { estado: "invalido" };
  if (Number.isFinite(maximo) && maximo !== 0 && (maximo < 256 || maximo > 16000)) {
    return { estado: "invalido" };
  }

  try {
    const fila = await consultarUna<{ clave: string }>(
      `UPDATE ai_agente
          SET instrucciones = NULLIF($2, ''), modelo = NULLIF($3, ''),
              max_tokens = NULLIF($4, 0), limite_hora = $5, activo = $6, updated_by = $7
        WHERE clave = $1 RETURNING clave`,
      [clave, instrucciones, modelo, Number.isFinite(maximo) ? maximo : 0, limite, activo, admin.id],
    );

    if (!fila) return { estado: "no_encontrado" };

    await registrar({
      usuarioId: admin.id,
      accion: "ia.agente_editado",
      entidad: "ai_agente",
      datos: { clave, modelo: modelo || null, limite, activo },
    });
  } catch (error) {
    console.error("[ia] no se pudo guardar el agente", error);

    return { estado: "error" };
  }

  revalidatePath(REFRESCAR, "page");

  return { estado: "ok" };
}
