"use server";

import { revalidatePath } from "next/cache";

import { registrar } from "@/lib/auditoria";
import { requerirRol } from "@/lib/auth";
import { consultar } from "@/lib/db";
import { esUuid } from "@/lib/contabilidad/formato";

export type ResultadoCatalogo =
  | { ok: true }
  | { ok: false; error: "datos_invalidos" | "duplicado" | "no_encontrado" | "error" };

function refrescarCatalogos() {
  revalidatePath("/[locale]/configuracion/parametros", "page");
  revalidatePath("/[locale]/administrativo/solicitudes", "page");
  revalidatePath("/[locale]/portal/estudiante/solicitudes", "page");
}

function esDuplicado(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

/** Crea o edita un tipo de material (Configuración > Parámetros). */
export async function guardarTipoMaterialAction(datos: {
  id?: string;
  nombre: string;
}): Promise<ResultadoCatalogo> {
  const usuario = await requerirRol(["admin", "owner"]);
  const id = datos.id?.trim() || "";
  const nombre = String(datos.nombre ?? "").trim().slice(0, 120);

  if (!nombre || (id && !esUuid(id))) {
    return { ok: false, error: "datos_invalidos" };
  }

  try {
    if (id) {
      const filas = await consultar<{ id: string }>(
        `UPDATE public.tipo_material
            SET nombre = $2
          WHERE id = $1
          RETURNING id`,
        [id, nombre],
      );
      if (filas.length === 0) return { ok: false, error: "no_encontrado" };
      await registrar({
        usuarioId: usuario.id,
        accion: "tipo_material.editado",
        entidad: "tipo_material",
        entidadId: id,
        datos: { nombre },
      });
    } else {
      const filas = await consultar<{ id: string }>(
        `INSERT INTO public.tipo_material (nombre)
         VALUES ($1)
         RETURNING id`,
        [nombre],
      );
      await registrar({
        usuarioId: usuario.id,
        accion: "tipo_material.creado",
        entidad: "tipo_material",
        entidadId: filas[0]?.id,
        datos: { nombre },
      });
    }
  } catch (error) {
    if (esDuplicado(error)) return { ok: false, error: "duplicado" };
    console.error("[parametros] error guardando tipo_material", error);
    return { ok: false, error: "error" };
  }

  refrescarCatalogos();
  return { ok: true };
}

/** Activa o desactiva un tipo de material. */
export async function cambiarEstadoTipoMaterialAction(datos: {
  id: string;
  activo: boolean;
}): Promise<ResultadoCatalogo> {
  const usuario = await requerirRol(["admin", "owner"]);
  if (!esUuid(datos.id)) return { ok: false, error: "datos_invalidos" };

  try {
    const filas = await consultar<{ id: string }>(
      `UPDATE public.tipo_material
          SET activo = $2
        WHERE id = $1
        RETURNING id`,
      [datos.id, Boolean(datos.activo)],
    );
    if (filas.length === 0) return { ok: false, error: "no_encontrado" };
    await registrar({
      usuarioId: usuario.id,
      accion: datos.activo ? "tipo_material.activado" : "tipo_material.desactivado",
      entidad: "tipo_material",
      entidadId: datos.id,
      datos: { activo: Boolean(datos.activo) },
    });
  } catch (error) {
    console.error("[parametros] error cambiando estado de tipo_material", error);
    return { ok: false, error: "error" };
  }

  refrescarCatalogos();
  return { ok: true };
}

/** Crea o edita un lugar de pasaje con monto asociado en DOP (Configuración > Parámetros). */
export async function guardarLugarPasajeAction(datos: {
  id?: string;
  nombre: string;
  monto: number;
}): Promise<ResultadoCatalogo> {
  const usuario = await requerirRol(["admin", "owner"]);
  const id = datos.id?.trim() || "";
  const nombre = String(datos.nombre ?? "").trim().slice(0, 120);
  const monto = Number(datos.monto);

  if (
    !nombre ||
    (id && !esUuid(id)) ||
    !Number.isFinite(monto) ||
    monto <= 0 ||
    monto >= 1e10
  ) {
    return { ok: false, error: "datos_invalidos" };
  }

  const montoRedondeado = Math.round(monto * 100) / 100;

  try {
    if (id) {
      const filas = await consultar<{ id: string }>(
        `UPDATE public.lugar_pasaje
            SET nombre = $2,
                monto = $3
          WHERE id = $1
          RETURNING id`,
        [id, nombre, montoRedondeado],
      );
      if (filas.length === 0) return { ok: false, error: "no_encontrado" };
      await registrar({
        usuarioId: usuario.id,
        accion: "lugar_pasaje.editado",
        entidad: "lugar_pasaje",
        entidadId: id,
        datos: { nombre, monto: montoRedondeado },
      });
    } else {
      const filas = await consultar<{ id: string }>(
        `INSERT INTO public.lugar_pasaje (nombre, monto)
         VALUES ($1, $2)
         RETURNING id`,
        [nombre, montoRedondeado],
      );
      await registrar({
        usuarioId: usuario.id,
        accion: "lugar_pasaje.creado",
        entidad: "lugar_pasaje",
        entidadId: filas[0]?.id,
        datos: { nombre, monto: montoRedondeado },
      });
    }
  } catch (error) {
    if (esDuplicado(error)) return { ok: false, error: "duplicado" };
    console.error("[parametros] error guardando lugar_pasaje", error);
    return { ok: false, error: "error" };
  }

  refrescarCatalogos();
  return { ok: true };
}

/** Activa o desactiva un lugar de pasaje. */
export async function cambiarEstadoLugarPasajeAction(datos: {
  id: string;
  activo: boolean;
}): Promise<ResultadoCatalogo> {
  const usuario = await requerirRol(["admin", "owner"]);
  if (!esUuid(datos.id)) return { ok: false, error: "datos_invalidos" };

  try {
    const filas = await consultar<{ id: string }>(
      `UPDATE public.lugar_pasaje
          SET activo = $2
        WHERE id = $1
        RETURNING id`,
      [datos.id, Boolean(datos.activo)],
    );
    if (filas.length === 0) return { ok: false, error: "no_encontrado" };
    await registrar({
      usuarioId: usuario.id,
      accion: datos.activo ? "lugar_pasaje.activado" : "lugar_pasaje.desactivado",
      entidad: "lugar_pasaje",
      entidadId: datos.id,
      datos: { activo: Boolean(datos.activo) },
    });
  } catch (error) {
    console.error("[parametros] error cambiando estado de lugar_pasaje", error);
    return { ok: false, error: "error" };
  }

  refrescarCatalogos();
  return { ok: true };
}
