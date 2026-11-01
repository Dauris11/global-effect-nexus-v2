import {
  ROLES,
  usuarioTienePermiso,
  type Permiso,
  type Rol,
  type UsuarioConPermisos,
} from "@/lib/rbac";

/**
 * Las pantallas de configuración, en el orden de la barra de iconos.
 *
 * Vive en `lib` y no en la página porque la usan dos sitios —la barra, que es
 * cliente, y el layout que la filtra en el servidor— y una lista repetida
 * acaba con una entrada de más en uno de los dos.
 *
 * `soloMaestro`: además del permiso, solo `super_admin`. Son las pantallas que
 * enseñan lo que hacen las demás cuentas, incluida la de quien coordina.
 */
export const AJUSTES = [
  { clave: "general", href: "/configuracion", permiso: "usuarios.administrar", roles: ["admin", "super_admin"] },
  { clave: "staff", href: "/administrativo/personal", permiso: "usuarios.administrar" },
  { clave: "permissions", href: "/configuracion/permisos", permiso: "usuarios.administrar", soloMaestro: true },
  { clave: "visibility", href: "/configuracion/visibilidad", permiso: "usuarios.administrar", soloMaestro: true },
  { clave: "parameters", href: "/configuracion/parametros", permiso: "usuarios.administrar", roles: ["admin", "super_admin"] },
  { clave: "landing", href: "/configuracion/landing", permiso: "landing.administrar" },
  { clave: "ia", href: "/configuracion/ia", permiso: "ia.administrar" },
  { clave: "knowledge", href: "/configuracion/conocimiento", permiso: "ia.administrar" },
  { clave: "activity", href: "/configuracion/actividad", permiso: "usuarios.administrar", soloMaestro: true },
  { clave: "audit", href: "/configuracion/auditoria", permiso: "usuarios.administrar", soloMaestro: true },
  { clave: "appearance", href: "/perfil", permiso: "usuarios.administrar", roles: ROLES },
] as const satisfies readonly {
  clave: string;
  href: string;
  permiso: Permiso;
  soloMaestro?: boolean;
  /** Lo ven estos roles aunque no tengan el permiso. */
  roles?: readonly Rol[];
}[];

export type ClaveAjuste = (typeof AJUSTES)[number]["clave"];

export function ajustesDeUsuario(usuario: UsuarioConPermisos) {
  const rol = usuario.rol;
  return AJUSTES.filter((ajuste) => {
    const roles: readonly Rol[] | undefined = "roles" in ajuste ? ajuste.roles : undefined;
    const maestro = "soloMaestro" in ajuste && ajuste.soloMaestro;

    if (maestro && rol !== "super_admin") return false;
    return roles?.includes(rol) || usuarioTienePermiso(usuario, ajuste.permiso);
  });
}
