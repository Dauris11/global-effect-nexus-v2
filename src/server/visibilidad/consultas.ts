import { cache } from "react";

import { consultar } from "@/lib/db";
import type { Rol } from "@/lib/rbac";

/**
 * Lo que el administrador maestro ocultó o bloqueó para un rol.
 *
 * `cache` de React: el layout, las pantallas de inicio y el contador de módulos
 * lo piden en la MISMA petición y la base se consulta una sola vez.
 */
export type Visibilidad = {
  /** Ocultas del menú; abren si se conoce la dirección. */
  ocultas: ReadonlySet<string>;
  /** Ocultas y además cerradas por la dirección. */
  bloqueadas: ReadonlySet<string>;
  /** Unión de las dos: lo que no se dibuja en ningún menú. */
  fueraDelMenu: readonly string[];
};

export const visibilidadDeRol = cache(async (rol: Rol): Promise<Visibilidad> => {
  const filas = await consultar<{ clave: string; estado: "oculto" | "bloqueado" }>(
    "SELECT clave, estado FROM public.visibilidad_menu WHERE rol = $1",
    [rol],
  ).catch(() => []);

  return {
    ocultas: new Set(filas.filter((f) => f.estado === "oculto").map((f) => f.clave)),
    bloqueadas: new Set(filas.filter((f) => f.estado === "bloqueado").map((f) => f.clave)),
    fueraDelMenu: filas.map((f) => f.clave),
  };
});

/** Todo lo configurado, para el resumen de la pantalla de visibilidad. */
export async function resumenDeVisibilidad(): Promise<
  { rol: string; ocultas: number; bloqueadas: number }[]
> {
  return consultar(
    `SELECT rol,
            count(*) FILTER (WHERE estado = 'oculto')::int AS ocultas,
            count(*) FILTER (WHERE estado = 'bloqueado')::int AS bloqueadas
       FROM public.visibilidad_menu GROUP BY rol`,
  );
}

/** ¿Está esta ruta bloqueada para el rol? Una ruta hija hereda el bloqueo de su padre. */
export function rutaBloqueada(ruta: string, bloqueadas: ReadonlySet<string>): boolean {
  for (const clave of bloqueadas) {
    if (clave.startsWith("/") && (ruta === clave || ruta.startsWith(`${clave}/`))) return true;
  }

  return false;
}
