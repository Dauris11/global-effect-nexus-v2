"use server";

import { revalidatePath } from "next/cache";

import { requerirUsuario } from "@/lib/auth";
import { enTransaccionComo, type ContextoTransaccion } from "@/lib/db";
import { usuarioTienePermiso } from "@/lib/rbac";
import { contextoDe } from "@/server/contabilidad/sesion";

import { comprobantesPorRevisar, esAprobable, reglaClasificacion } from "./consultas";

/**
 * Escrituras de «Mi día»: aprobar en lote lo que el sistema clasificó,
 * contabilizar solo lo que la contadora autorizó, y deshacerlo.
 *
 * Tres reglas que no se negocian:
 *
 *   1. Solo se aprueba lo que `esAprobable` deja pasar: sin problemas de RNC o
 *      NCF, sin duplicado, con sugerencia. Lo dudoso se queda en la cola para que
 *      ella lo mire, aunque lo haya marcado en el lote.
 *   2. Al aprobar se vuelve a calcular en el servidor. Lo que llegó de la
 *      pantalla es solo la lista de ids: nada de clasificaciones.
 *   3. Todo va por `enTransaccionComo`, así queda en la bitácora con quién,
 *      desde dónde y cuándo. «Contabilizó solo» también tiene nombre: el de la
 *      persona que activó la regla.
 */

export type EstadoMiDia = {
  estado: "inicial" | "ok" | "no_permitido" | "nada" | "error";
  procesados?: number;
  omitidos?: number;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function aprobar(
  contexto: ContextoTransaccion,
  ids: readonly string[],
  automatico: boolean,
  filtro: (monto: number, confianza: number) => boolean,
): Promise<{ procesados: number; omitidos: number }> {
  const cola = await comprobantesPorRevisar(200);
  const elegibles = cola.filter(
    (c) => ids.includes(c.id) && esAprobable(c) && c.sugerencia && filtro(c.monto, c.sugerencia.confianza),
  );

  await enTransaccionComo(contexto, async (cliente) => {
    for (const c of elegibles) {
      const s = c.sugerencia!;

      // `AND estado = 'recibido'` otra vez: si otra persona lo tocó entre la
      // lectura y esta escritura, no se pisa su decisión.
      await cliente.query(
        `UPDATE contabilidad.comprobante_recibido
            SET estado = 'validado',
                categoria = coalesce($2, categoria),
                centro_costo_id = coalesce($3, centro_costo_id),
                fondo_id = coalesce($4, fondo_id),
                clasificacion_sugerida = $5::jsonb,
                sugerencia_aceptada = $6,
                validacion_automatica = $7,
                revisado_por = $8, revisado_en = now(), updated_at = now()
          WHERE id = $1 AND estado = 'recibido'`,
        [
          c.id,
          s.categoria,
          s.centroCostoId,
          s.fondoId,
          JSON.stringify(s),
          true,
          automatico,
          contexto.usuarioId,
        ],
      );
    }
  });

  return { procesados: elegibles.length, omitidos: ids.length - elegibles.length };
}

/**
 * Guarda la sugerencia de cada comprobante pendiente que aún no la tiene.
 *
 * Se lanza al abrir «Mi día», no al pintar la página: leer no debe escribir. Lo
 * importante es que la sugerencia quede guardada ANTES de que alguien revise,
 * porque es lo que permite medir, después, cuántas veces la contadora la dejó
 * tal cual (y no solo cuando aprueba por «Mi día»).
 */
export async function persistirSugerencias(): Promise<void> {
  const usuario = await requerirUsuario();

  if (!usuarioTienePermiso(usuario, "contabilidad.registrar")) return;

  const cola = await comprobantesPorRevisar(200);
  const nuevas = cola.filter((c) => c.sugerencia);

  if (nuevas.length === 0) return;

  await enTransaccionComo(await contextoDe(usuario), async (cliente) => {
    for (const c of nuevas) {
      await cliente.query(
        `UPDATE contabilidad.comprobante_recibido
            SET clasificacion_sugerida = $2::jsonb
          WHERE id = $1 AND clasificacion_sugerida IS NULL`,
        [c.id, JSON.stringify(c.sugerencia)],
      );
    }
  });
}

/** «Aprobar seleccionados»: nivel 1 o superior, lo elige la contadora a mano. */
export async function aprobarEnLote(
  _previo: EstadoMiDia,
  datos: FormData,
): Promise<EstadoMiDia> {
  const usuario = await requerirUsuario();

  if (!usuarioTienePermiso(usuario, "contabilidad.registrar")) return { estado: "no_permitido" };

  const regla = await reglaClasificacion();

  // Nivel 0: el sistema solo sugiere, la aprobación en lote está apagada.
  if (regla.nivel === 0) return { estado: "no_permitido" };

  const ids = datos.getAll("id").map(String).filter((id) => UUID.test(id));

  if (ids.length === 0) return { estado: "nada" };

  try {
    const r = await aprobar(await contextoDe(usuario), ids, false, () => true);

    revalidatePath("/[locale]/contabilidad", "layout");

    return { estado: r.procesados > 0 ? "ok" : "nada", ...r };
  } catch (error) {
    console.error("[mi-dia] no se pudo aprobar en lote", error);

    return { estado: "error" };
  }
}

/**
 * Nivel 2: contabiliza solo lo que cumple el umbral de confianza y de monto que
 * fijó la contadora. Se lanza a mano desde «Mi día»: no hay un proceso que corra
 * por su cuenta, así que nada se contabiliza sin que ella haya pulsado.
 */
export async function procesarAutomaticos(
  _previo: EstadoMiDia,
  _datos: FormData,
): Promise<EstadoMiDia> {
  const usuario = await requerirUsuario();

  if (!usuarioTienePermiso(usuario, "contabilidad.registrar")) return { estado: "no_permitido" };

  const regla = await reglaClasificacion();

  if (regla.nivel < 2) return { estado: "no_permitido" };

  try {
    const cola = await comprobantesPorRevisar(200);
    const r = await aprobar(
      await contextoDe(usuario),
      cola.map((c) => c.id),
      true,
      (monto, confianza) => monto <= regla.umbralMonto && confianza >= regla.umbralConfianza,
    );

    revalidatePath("/[locale]/contabilidad", "layout");

    return { estado: r.procesados > 0 ? "ok" : "nada", ...r };
  } catch (error) {
    console.error("[mi-dia] no se pudo procesar lo automático", error);

    return { estado: "error" };
  }
}

/** Devuelve a la cola un comprobante que se aprobó (a mano o solo) hace poco. */
export async function devolverALaCola(datos: FormData): Promise<void> {
  const usuario = await requerirUsuario();

  if (!usuarioTienePermiso(usuario, "contabilidad.registrar")) return;

  const id = String(datos.get("id") ?? "");

  if (!UUID.test(id)) return;

  await enTransaccionComo(await contextoDe(usuario), async (cliente) => {
    // Solo los validados que aún no tienen asiento: lo contabilizado no se
    // devuelve desde aquí, se revierte con un asiento de reverso.
    await cliente.query(
      `UPDATE contabilidad.comprobante_recibido
          SET estado = 'recibido', revisado_por = NULL, revisado_en = NULL,
              sugerencia_aceptada = NULL, validacion_automatica = false, updated_at = now()
        WHERE id = $1 AND estado = 'validado' AND asiento_id IS NULL
          AND revisado_en > now() - interval '7 days'`,
      [id],
    );
  });

  revalidatePath("/[locale]/contabilidad", "layout");
}

/** Nivel de autonomía y umbrales de la regla de clasificación. Lo fija la contadora. */
export async function guardarRegla(
  _previo: EstadoMiDia,
  datos: FormData,
): Promise<EstadoMiDia> {
  const usuario = await requerirUsuario();

  if (!usuarioTienePermiso(usuario, "contabilidad.configurar")) return { estado: "no_permitido" };

  const nivel = Number(datos.get("nivel"));
  const confianza = Math.trunc(Number(datos.get("umbral_confianza")));
  const monto = Number(String(datos.get("umbral_monto") ?? "").replace(",", "."));

  if (![0, 1, 2].includes(nivel) || !(confianza >= 1 && confianza <= 100) || !(monto >= 0)) {
    return { estado: "error" };
  }

  try {
    await enTransaccionComo(await contextoDe(usuario), async (cliente) => {
      await cliente.query(
        `UPDATE contabilidad.regla_automatica
            SET nivel = $1, umbral_confianza = $2, umbral_monto = $3,
                actualizada_por = $4, actualizada_en = now()
          WHERE clave = 'clasificar_comprobante'`,
        [nivel, confianza, monto, usuario.id],
      );
    });

    revalidatePath("/[locale]/contabilidad", "layout");

    return { estado: "ok" };
  } catch (error) {
    console.error("[mi-dia] no se pudo guardar la regla", error);

    return { estado: "error" };
  }
}
