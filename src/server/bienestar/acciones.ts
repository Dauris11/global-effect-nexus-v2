"use server";

import { revalidatePath } from "next/cache";

import { registrar } from "@/lib/auditoria";
import { requerirUsuario } from "@/lib/auth";
import { consultarUna } from "@/lib/db";
import {
  usuarioTienePermiso,
} from "@/lib/rbac";

/**
 * Marcar el servicio comunitario y la reunión mensual.
 *
 * UNA CASILLA, UNA ESCRITURA. `registro_servicio` tiene
 * `UNIQUE (estudiante_id, mes)`, así que el `ON CONFLICT DO UPDATE` resuelve de
 * una vez los dos casos —crear la fila del mes o corregir la que ya estaba— sin
 * preguntar antes si existe. Preguntar y luego escribir serían dos viajes y una
 * rendija entre ambos: dos personas marcando a la vez podrían pisarse.
 *
 * SE MANDAN LOS DOS VALORES SIEMPRE, no solo el que cambió. La fila guarda las
 * dos marcas y el formulario conoce las dos; mandar una sola obligaría a leer
 * la otra de la base para no borrarla, que es otra vez la consulta que se
 * quería evitar.
 *
 * Esto NO deja rastro en `audit_log` por cada clic. Marcar una casilla de
 * asistencia es trabajo rutinario de todos los meses, y un registro por
 * pulsación ahogaría la auditoría —donde están los borrados de expediente y
 * las notas— en ruido. Lo que sí se anota es el mes en el que se trabajó, una
 * vez por persona y mes.
 */

export type EstadoServicio = {
  estado: "inicial" | "ok" | "no_permitido" | "no_encontrado" | "invalido" | "error";
};

/** `YYYY-MM`, que es el formato que guarda la columna `mes`. */
const MES = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function marcarServicio(
  _previo: EstadoServicio,
  datos: FormData,
): Promise<EstadoServicio> {
  const usuario = await requerirUsuario();

  if (!usuarioTienePermiso(usuario, "operaciones.escribir")) {
    return { estado: "no_permitido" };
  }

  const estudianteId = String(datos.get("estudiante") ?? "");
  const mes = String(datos.get("mes") ?? "");
  const servicio = datos.get("servicio") === "1";
  const reunion = datos.get("reunion") === "1";

  if (!esUuid(estudianteId)) return { estado: "no_encontrado" };
  if (!MES.test(mes)) return { estado: "invalido" };

  try {
    /*
     * El INSERT selecciona de `estudiante` con la condición puesta: un id que
     * no existe, o el de alguien que ya no está activo, no produce fila. Sin
     * eso, la tabla acumularía registros de gente que no está.
     */
    const escrito = await consultarUna<{ id: string }>(
      `INSERT INTO registro_servicio
              (estudiante_id, mes, hizo_servicio, asistio_reunion)
       SELECT e.id, $2, $3, $4
         FROM estudiante e
        WHERE e.id = $1 AND e.estado = 'activo'
       ON CONFLICT (estudiante_id, mes) DO UPDATE
          SET hizo_servicio   = EXCLUDED.hizo_servicio,
              asistio_reunion = EXCLUDED.asistio_reunion
       RETURNING id`,
      [estudianteId, mes, servicio, reunion],
    );

    if (!escrito) return { estado: "no_encontrado" };
  } catch (error) {
    console.error("[bienestar] no se pudo marcar el servicio", error);
    return { estado: "error" };
  }

  revalidatePath("/[locale]/servicios-mensuales", "page");

  return { estado: "ok" };
}

/**
 * Deja constancia de que alguien trabajó la planilla de un mes.
 *
 * Se llama una vez, al abrir el mes para editarlo, y no en cada casilla. Es el
 * término medio entre no auditar nada —y no poder decir quién pasó lista— y
 * auditar cada clic, que llenaría `audit_log` de ruido.
 */
export async function anotarRevisionDelMes(mes: string): Promise<void> {
  const usuario = await requerirUsuario();

  if (!usuarioTienePermiso(usuario, "operaciones.escribir")) return;
  if (!MES.test(mes)) return;

  await registrar({
    usuarioId: usuario.id,
    accion: "servicio.mes_revisado",
    entidad: "registro_servicio",
    datos: { mes },
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function esUuid(valor: string): boolean {
  return UUID.test(valor);
}
