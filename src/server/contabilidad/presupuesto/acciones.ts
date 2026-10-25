"use server";

import { revalidatePath } from "next/cache";
import { requerirPermiso, requerirUsuario } from "@/lib/auth";
import { enTransaccionComo } from "@/lib/db";
import { fijarAccion } from "@/server/contabilidad/bitacora";
import { contextoDe } from "@/server/contabilidad/sesion";

export type EstadoAccionPresupuesto = {
  ok: boolean;
  error?: string;
  id?: string;
};

export async function crearPresupuesto(datos: {
  ejercicio: number;
  nombre: string;
  notas?: string;
}): Promise<EstadoAccionPresupuesto> {
  const usuario = await requerirUsuario();

  if (datos.ejercicio < 2020 || datos.ejercicio > 2100) {
    return { ok: false, error: "Ejercicio fiscal fuera de rango válido" };
  }

  const nombre = datos.nombre.trim();
  if (!nombre || nombre.length < 3) {
    return { ok: false, error: "El nombre del presupuesto debe tener al menos 3 caracteres" };
  }

  try {
    const id = await enTransaccionComo<string>(await contextoDe(usuario), async (cliente) => {
      await fijarAccion(cliente, "crear_presupuesto");

      const { rows } = await cliente.query<{ id: string }>(
        `INSERT INTO contabilidad.presupuesto (
           ejercicio, nombre, notas, creado_por
         ) VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [datos.ejercicio, nombre, datos.notas?.trim() || null, usuario.id]
      );
      return rows[0].id;
    });

    revalidatePath("/contabilidad/presupuesto");
    return { ok: true, id };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("uq_presupuesto_ejercicio_nombre")) {
      return { ok: false, error: "Ya existe un presupuesto con ese nombre para este ejercicio" };
    }
    return { ok: false, error: "Error al crear presupuesto" };
  }
}

export async function guardarLineasPresupuesto(datos: {
  presupuestoId: string;
  lineas: {
    centroCostoId: string;
    cuentaId: string;
    fondoId?: string;
    periodoMes: number;
    montoPresupuestado: number;
    notas?: string;
  }[];
}): Promise<EstadoAccionPresupuesto> {
  const usuario = await requerirUsuario();

  try {
    await enTransaccionComo(await contextoDe(usuario), async (cliente) => {
      await fijarAccion(cliente, "guardar_lineas_presupuesto");

      // Verificar que el presupuesto esté en borrador
      const { rows: pRows } = await cliente.query<{ estado: string }>(
        `SELECT estado FROM contabilidad.presupuesto WHERE id = $1`,
        [datos.presupuestoId]
      );
      if (pRows.length === 0) throw new Error("Presupuesto no encontrado");
      if (pRows[0].estado !== "borrador") {
        throw new Error("Solo se pueden modificar líneas de un presupuesto en estado borrador");
      }

      for (const l of datos.lineas) {
        const monto = Math.max(0, Number(l.montoPresupuestado || 0));
        await cliente.query(
          `INSERT INTO contabilidad.presupuesto_linea (
             presupuesto_id, centro_costo_id, cuenta_id, fondo_id, periodo_mes,
             monto_presupuestado, notas
           ) VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (presupuesto_id, centro_costo_id, cuenta_id, periodo_mes)
           DO UPDATE SET monto_presupuestado = EXCLUDED.monto_presupuestado,
                         fondo_id = EXCLUDED.fondo_id,
                         notas = EXCLUDED.notas`,
          [
            datos.presupuestoId,
            l.centroCostoId,
            l.cuentaId,
            l.fondoId?.trim() || null,
            l.periodoMes,
            monto,
            l.notas?.trim() || null,
          ]
        );
      }
    });

    revalidatePath("/contabilidad/presupuesto");
    return { ok: true, id: datos.presupuestoId };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg || "Error al guardar líneas presupuestarias" };
  }
}

export async function aprobarPresupuesto(id: string): Promise<EstadoAccionPresupuesto> {
  const usuario = await requerirPermiso("contabilidad.aprobar");

  try {
    await enTransaccionComo(await contextoDe(usuario), async (cliente) => {
      await fijarAccion(cliente, "aprobar_presupuesto");

      const { rows } = await cliente.query<{ id: string; estado: string }>(
        `SELECT id, estado FROM contabilidad.presupuesto WHERE id = $1`,
        [id]
      );
      if (rows.length === 0) throw new Error("Presupuesto no encontrado");
      if (rows[0].estado !== "borrador") {
        throw new Error("El presupuesto no está en estado borrador");
      }

      await cliente.query(
        `UPDATE contabilidad.presupuesto
            SET estado = 'aprobado',
                aprobado_por = $1,
                aprobado_en = now()
          WHERE id = $2`,
        [usuario.id, id]
      );
    });

    revalidatePath("/contabilidad/presupuesto");
    return { ok: true, id };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg || "Error al aprobar presupuesto" };
  }
}
