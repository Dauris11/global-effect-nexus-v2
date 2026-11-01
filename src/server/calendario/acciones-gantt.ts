"use server";

import { revalidatePath } from "next/cache";

import { registrar } from "@/lib/auditoria";
import { requerirUsuario } from "@/lib/auth";
import { consultarUna, enTransaccion } from "@/lib/db";
import { aMs, type CambioDeFechas } from "@/lib/linea-tiempo";
import { usuarioTienePermiso, type Permiso } from "@/lib/rbac";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIA = /^\d{4}-\d{2}-\d{2}$/;
const DIA_MS = 86_400_000;

/** Qué permiso hace falta para mover cada clase de barra. El resto no se mueve. */
const PERMISO_POR_CLASE: Record<string, Permiso> = {
  proyecto: "operaciones.escribir",
  tarea: "operaciones.escribir",
  periodo: "academico.escribir",
};

/**
 * Mueve o estira una barra de la línea de tiempo.
 *
 * La interfaz solo ofrece arrastrar lo que `editable` permite, pero eso es
 * comodidad: aquí se vuelve a decidir con el permiso de la clase, porque quien
 * llama a una Server Action no tiene por qué haber pasado por la pantalla.
 * La fecha de una tarea y la de su evento del calendario se mueven juntas.
 */
export async function moverBarra(
  cambio: CambioDeFechas,
): Promise<{ ok: boolean }> {
  const usuario = await requerirUsuario();

  const permiso = PERMISO_POR_CLASE[cambio.clase];
  if (!permiso || !usuarioTienePermiso(usuario, permiso)) return { ok: false };

  const { id, inicio, fin } = cambio;
  if (!UUID.test(id) || !DIA.test(inicio) || !DIA.test(fin)) return { ok: false };
  if (fin < inicio) return { ok: false };
  // Diez años de duración es un dedo resbalado, no un plan.
  if ((aMs(fin) - aMs(inicio)) / DIA_MS > 3650) return { ok: false };

  try {
    const movida = await enTransaccion(async (cliente) => {
      if (cambio.clase === "proyecto") {
        const { rows } = await cliente.query<{ id: string }>(
          `UPDATE proyecto SET fecha_inicio = $2::date, fecha_fin = $3::date
            WHERE id = $1 RETURNING id`,
          [id, inicio, fin],
        );
        return rows.length > 0;
      }

      if (cambio.clase === "periodo") {
        const { rows } = await cliente.query<{ id: string }>(
          `UPDATE periodo SET fecha_inicio = $2::date, fecha_fin = $3::date
            WHERE id = $1 RETURNING id`,
          [id, inicio, fin],
        );
        return rows.length > 0;
      }

      const { rows } = await cliente.query<{ id: string }>(
        `UPDATE tarea SET fecha_inicio = $2::date, fecha_limite = $3::date
          WHERE id = $1 RETURNING id`,
        [id, inicio, fin],
      );
      if (rows.length === 0) return false;

      await cliente.query(`UPDATE evento SET fecha = $2::date WHERE tarea_id = $1`, [
        id,
        fin,
      ]);
      return true;
    });

    if (!movida) return { ok: false };

    await registrar({
      usuarioId: usuario.id,
      accion: `${cambio.clase}.fechas_movidas`,
      entidad: cambio.clase,
      entidadId: id,
      datos: { inicio, fin },
    });
  } catch (error) {
    console.error("[linea-tiempo] no se pudo mover la barra", error);
    return { ok: false };
  }

  revalidatePath("/[locale]/calendario", "page");
  revalidatePath("/[locale]/calendario/gantt", "page");
  revalidatePath("/[locale]/administrativo/proyectos", "page");
  revalidatePath("/[locale]/administrativo/tareas", "page");
  revalidatePath("/[locale]/dashboard", "page");
  return { ok: true };
}
