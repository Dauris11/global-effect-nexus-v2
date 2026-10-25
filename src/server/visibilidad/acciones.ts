"use server";

import { revalidatePath } from "next/cache";

import { registrar } from "@/lib/auditoria";
import { requerirRol } from "@/lib/auth";
import { enTransaccion } from "@/lib/db";
import { FUNCION_ASISTENTE, itemsDeArea, menuDe, rutasProtegidas } from "@/lib/nav";
import { ROLES, type Rol } from "@/lib/rbac";

/**
 * Guarda qué ve cada rol. Solo `super_admin`, y todo cambio queda en la
 * auditoría con cuántas entradas se ocultaron o bloquearon.
 *
 * Qué se acepta se decide AQUÍ, no en lo que mande el formulario: solo claves que
 * existan en el menú de ese rol (o el asistente), nunca las protegidas, y nunca
 * para `super_admin`, que siempre lo ve todo. Un POST armado a mano no puede
 * esconder el perfil de nadie ni inventar una ruta.
 */

export type EstadoVisibilidad = {
  estado: "inicial" | "ok" | "invalido" | "error";
  ocultas?: number;
  bloqueadas?: number;
};

export async function guardarVisibilidad(
  _previo: EstadoVisibilidad,
  datos: FormData,
): Promise<EstadoVisibilidad> {
  const admin = await requerirRol(["super_admin"]);

  const rol = String(datos.get("rol") ?? "") as Rol;

  if (!(ROLES as readonly string[]).includes(rol) || rol === "super_admin") {
    return { estado: "invalido" };
  }

  const permitidas = new Set([
    ...menuDe(rol).flatMap(itemsDeArea).map((item) => item.href),
    FUNCION_ASISTENTE,
  ]);
  const protegidas = new Set(rutasProtegidas(rol));

  const cambios: { clave: string; estado: "oculto" | "bloqueado" }[] = [];

  for (const [campo, valor] of datos.entries()) {
    if (!campo.startsWith("v:")) continue;

    const clave = campo.slice(2);

    if (valor === "visible") continue;
    if (valor !== "oculto" && valor !== "bloqueado") return { estado: "invalido" };
    if (!permitidas.has(clave) || protegidas.has(clave)) return { estado: "invalido" };

    cambios.push({ clave, estado: valor });
  }

  try {
    await enTransaccion(async (cliente) => {
      // Se reescribe el rol entero: lo que no llega marcado es «visible».
      await cliente.query("DELETE FROM public.visibilidad_menu WHERE rol = $1", [rol]);

      for (const c of cambios) {
        await cliente.query(
          `INSERT INTO public.visibilidad_menu (rol, clave, estado, actualizado_por)
           VALUES ($1, $2, $3, $4)`,
          [rol, c.clave, c.estado, admin.id],
        );
      }
    });

    const ocultas = cambios.filter((c) => c.estado === "oculto").length;
    const bloqueadas = cambios.length - ocultas;

    await registrar({
      usuarioId: admin.id,
      accion: "visibilidad.guardada",
      entidad: "visibilidad_menu",
      datos: { rol, ocultas, bloqueadas, claves: cambios.map((c) => `${c.estado}:${c.clave}`) },
    });

    // El menú está en el layout de todo el portal.
    revalidatePath("/", "layout");

    return { estado: "ok", ocultas, bloqueadas };
  } catch (error) {
    console.error("[visibilidad] no se pudo guardar", error);

    return { estado: "error" };
  }
}
