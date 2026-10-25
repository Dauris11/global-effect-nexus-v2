"use server";

import { revalidatePath } from "next/cache";
import { requerirUsuario } from "@/lib/auth";
import { enTransaccionComo } from "@/lib/db";
import { fijarAccion } from "@/server/contabilidad/bitacora";
import { contextoDe } from "@/server/contabilidad/sesion";

export type EstadoAccionCentroCosto = {
  ok: boolean;
  error?: string;
  id?: string;
};

export async function crearCentroCosto(datos: {
  codigo: string;
  nombre: string;
  programa: "becas" | "formacion_360" | "comedor" | "administrativo" | "institucional" | "proyectos";
  descripcion?: string;
  responsableId?: string;
}): Promise<EstadoAccionCentroCosto> {
  const usuario = await requerirUsuario();

  const cod = datos.codigo.trim().toUpperCase();
  const nom = datos.nombre.trim();

  if (!cod || cod.length < 2) {
    return { ok: false, error: "El código de centro de costo debe tener al menos 2 caracteres" };
  }
  if (!nom || nom.length < 3) {
    return { ok: false, error: "El nombre es obligatorio (mínimo 3 caracteres)" };
  }

  try {
    const id = await enTransaccionComo<string>(await contextoDe(usuario), async (cliente) => {
      await fijarAccion(cliente, "crear_centro_costo");

      const { rows } = await cliente.query<{ id: string }>(
        `INSERT INTO contabilidad.centro_costo (
           codigo, nombre, programa, descripcion, responsable_id
         ) VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [
          cod,
          nom,
          datos.programa,
          datos.descripcion?.trim() || null,
          datos.responsableId?.trim() || null,
        ]
      );
      return rows[0].id;
    });

    revalidatePath("/contabilidad/centros-costo");
    return { ok: true, id };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("centro_costo_codigo_key")) {
      return { ok: false, error: "Ya existe un centro de costo con ese código" };
    }
    return { ok: false, error: "Error al registrar centro de costo" };
  }
}

export async function actualizarCentroCosto(datos: {
  id: string;
  nombre: string;
  programa: "becas" | "formacion_360" | "comedor" | "administrativo" | "institucional" | "proyectos";
  descripcion?: string;
  responsableId?: string;
  activo: boolean;
}): Promise<EstadoAccionCentroCosto> {
  const usuario = await requerirUsuario();
  const nom = datos.nombre.trim();

  if (!nom || nom.length < 3) {
    return { ok: false, error: "El nombre es obligatorio (mínimo 3 caracteres)" };
  }

  try {
    await enTransaccionComo(await contextoDe(usuario), async (cliente) => {
      await fijarAccion(cliente, "actualizar_centro_costo");

      await cliente.query(
        `UPDATE contabilidad.centro_costo
            SET nombre = $1,
                programa = $2,
                descripcion = $3,
                responsable_id = $4,
                activo = $5
          WHERE id = $6`,
        [
          nom,
          datos.programa,
          datos.descripcion?.trim() || null,
          datos.responsableId?.trim() || null,
          datos.activo,
          datos.id,
        ]
      );
    });

    revalidatePath("/contabilidad/centros-costo");
    return { ok: true, id: datos.id };
  } catch {
    return { ok: false, error: "Error al actualizar centro de costo" };
  }
}
