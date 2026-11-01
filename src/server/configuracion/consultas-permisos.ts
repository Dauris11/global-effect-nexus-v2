import { requerirRol } from "@/lib/auth";
import { consultar } from "@/lib/db";
import {
  esPermiso,
  esRol,
  type Permiso,
  type Rol,
} from "@/lib/rbac";

export type PermisosDeRol = { rol: Rol; permisos: Permiso[] };

export type PersonaConPermisos = {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  activo: boolean;
  /** Cambios personales sobre lo que trae el rol. */
  excepciones: { permiso: Permiso; concedido: boolean; motivo: string | null }[];
};

/**
 * Lo que `rol_permiso` concede a cada rol. Es la fuente de verdad: la sesión
 * lee de ahí, así que lo que se ve aquí es lo que el sistema aplica.
 */
export async function listarPermisosPorRol(): Promise<PermisosDeRol[]> {
  await requerirRol(["super_admin"]);
  return leerPermisosPorRol();
}

/**
 * Lo mismo sin guardia propia, para las pantallas que ya exigen su rol
 * (visibilidad, mapa del sitio) y necesitan el menú REAL de cada rol, no el de
 * fábrica del código.
 */
export async function leerPermisosPorRol(): Promise<PermisosDeRol[]> {
  const filas = await consultar<{ rol: string; permisos: string[] }>(
    `SELECT r.nombre AS rol,
            coalesce(array_agg(p.codigo) FILTER (WHERE p.codigo IS NOT NULL), '{}') AS permisos
       FROM rol r
       LEFT JOIN rol_permiso rp ON rp.rol_id = r.id
       LEFT JOIN permiso p ON p.id = rp.permiso_id
      GROUP BY r.nombre`,
  );

  return filas.flatMap((fila) =>
    esRol(fila.rol)
      ? [{ rol: fila.rol, permisos: fila.permisos.filter(esPermiso) }]
      : [],
  );
}

/**
 * Todas las personas con los cambios personales que tienen sobre su rol.
 */
export async function listarPersonasConPermisos(): Promise<PersonaConPermisos[]> {
  await requerirRol(["super_admin"]);

  const [personas, excepciones] = await Promise.all([
    consultar<{
      id: string;
      nombre: string;
      email: string;
      rol: string;
      activo: boolean;
    }>(
      `SELECT u.id, u.nombre, u.email::text AS email, r.nombre AS rol, u.activo
         FROM usuario u
         JOIN rol r ON r.id = u.rol_id
        ORDER BY u.nombre`,
    ),
    consultar<{
      usuario_id: string;
      codigo: string;
      concedido: boolean;
      motivo: string | null;
    }>(
      `SELECT up.usuario_id, p.codigo, up.concedido, up.motivo
         FROM usuario_permiso up
         JOIN permiso p ON p.id = up.permiso_id`,
    ),
  ]);

  return personas.flatMap((persona) =>
    esRol(persona.rol)
      ? [
          {
            ...persona,
            rol: persona.rol,
            excepciones: excepciones.flatMap((e) =>
              e.usuario_id === persona.id && esPermiso(e.codigo)
                ? [{ permiso: e.codigo, concedido: e.concedido, motivo: e.motivo }]
                : [],
            ),
          },
        ]
      : [],
  );
}
