import { ROLES_ASIGNABLES, type Rol } from "@/lib/rbac";
import type { TokenEstado } from "@/lib/status-map";

/**
 * Presentación y reglas de los roles. Todo lo que una pantalla necesita para nombrar, describir y colorear un
 * rol sale de aquí, para no repetir etiquetas sueltas por cada módulo.
 *
 * Los textos viven en `messages/{es,en}.json`; este archivo solo guarda las CLAVES. Se usan con el traductor
 * raíz: `t(ROLE_LABEL[rol])`. Como el espacio `roles` ya lo leen muchas pantallas (`tRoles(rol)`), esa forma
 * antigua sigue sirviendo: apunta a las mismas cadenas.
 */

/** Clave de la etiqueta visible del rol («Propietario», «Desarrollador»…). */
export const ROLE_LABEL: Record<Rol, string> = {
  owner: "roles.owner",
  developer: "roles.developer",
  admin: "roles.admin",
  contabilidad: "roles.contabilidad",
  docente: "roles.docente",
  estudiante: "roles.estudiante",
  dir_habitudes: "roles.dir_habitudes",
  habitudes: "roles.habitudes",
  chofer: "roles.chofer",
};

/** Clave de la frase que explica qué hace el rol (para la lista de «Ver como», Personal y Permisos). */
export const ROLE_DESCRIPTION: Record<Rol, string> = {
  owner: "roleDescriptions.owner",
  developer: "roleDescriptions.developer",
  admin: "roleDescriptions.admin",
  contabilidad: "roleDescriptions.contabilidad",
  docente: "roleDescriptions.docente",
  estudiante: "roleDescriptions.estudiante",
  dir_habitudes: "roleDescriptions.dir_habitudes",
  habitudes: "roleDescriptions.habitudes",
  chofer: "roleDescriptions.chofer",
};

/**
 * Color de la etiqueta del rol: un token de estado (`status-*`, `<StatusBadge>`/`CLASES_TOKEN`), nunca un hex.
 * Hay siete tokens para nueve roles, así que algunos comparten; el nombre es lo que identifica, el color solo
 * agrupa (dirección y técnica arriba, operación en medio, usuarios finales en gris). No significa estado.
 */
export const ROLE_COLOR: Record<Rol, TokenEstado> = {
  owner: "done",
  developer: "progress",
  admin: "info",
  contabilidad: "success",
  docente: "neutral",
  estudiante: "neutral",
  dir_habitudes: "warning",
  habitudes: "warning",
  chofer: "neutral",
};

/** Orden del selector «Ver como». `developer` no está: nadie «ve como» desarrollador. */
export const ROLES_VER_COMO_ORDEN: readonly Rol[] = [
  "owner",
  "admin",
  "contabilidad",
  "docente",
  "estudiante",
  "dir_habitudes",
  "habitudes",
  "chofer",
];

/**
 * Roles que puede mirar alguien con ese rol REAL. Solo owner y developer usan «Ver como»; el owner no se ve como
 * owner (ya lo es), el developer sí, para ver el sistema como lo ve dirección.
 */
export function rolesVerComo(rolReal: Rol | string | undefined): readonly Rol[] {
  if (rolReal === "developer") return ROLES_VER_COMO_ORDEN;
  if (rolReal === "owner") return ROLES_VER_COMO_ORDEN.filter((r) => r !== "owner");
  return [];
}

export const puedeVerComo = (rolReal: Rol | string | undefined, destino: string): boolean =>
  (rolesVerComo(rolReal) as readonly string[]).includes(destino);

/**
 * El developer es del equipo técnico, no de la Fundación: las listas y los conteos de personal lo dejan fuera
 * salvo que se pida verlo (filtro «Equipo de la fundación»).
 */
export const ROL_FUERA_DEL_EQUIPO: Rol = "developer";

/** Roles que `actor` puede ofrecer al crear o cambiar una cuenta. */
export function rolesAsignablesPor(actorRolReal: Rol | string | undefined): readonly Rol[] {
  return ROLES_ASIGNABLES.filter((rol) => {
    if (rol === "developer") return actorRolReal === "developer";
    if (rol === "owner") return actorRolReal === "owner" || actorRolReal === "developer";
    return true;
  });
}

export type ErrorAsignacionRol = "solo_developer" | "solo_owner" | "ultimo_owner";

export type CambioDeCuenta =
  | { tipo: "rol"; nuevoRol: Rol }
  | { tipo: "desactivar" }
  | { tipo: "borrar" }
  | { tipo: "activar" }
  | { tipo: "reiniciar_acceso" };

/**
 * Reglas de asignación de roles (pura: la acción del servidor le pasa los datos y ella decide).
 *
 *   · Solo un developer toca a un developer: darle el rol, quitárselo, desactivarlo o reiniciarle el acceso (si no,
 *     un owner podría apoderarse de esa cuenta).
 *   · Solo owner o developer dan el rol owner.
 *   · Siempre queda al menos un owner ACTIVO: quitarle el rol, desactivar o borrar al último se rechaza.
 *
 * `propietariosActivos` cuenta los owner activos ANTES del cambio (incluido el objetivo si lo es).
 */
export function validarCambioDeCuenta(datos: {
  actorRol: Rol | string;
  objetivoRol: Rol | string;
  objetivoActivo: boolean;
  cambio: CambioDeCuenta;
  propietariosActivos: number;
}): ErrorAsignacionRol | null {
  const { actorRol, objetivoRol, objetivoActivo, cambio, propietariosActivos } = datos;
  const nuevoRol = cambio.tipo === "rol" ? cambio.nuevoRol : null;

  if (objetivoRol === "developer" && actorRol !== "developer") return "solo_developer";
  if (nuevoRol === "developer" && actorRol !== "developer") return "solo_developer";

  if (nuevoRol === "owner" && objetivoRol !== "owner" && actorRol !== "owner" && actorRol !== "developer") {
    return "solo_owner";
  }

  const dejaDeSerOwnerActivo =
    cambio.tipo === "desactivar" || cambio.tipo === "borrar" || (cambio.tipo === "rol" && cambio.nuevoRol !== "owner");

  if (objetivoRol === "owner" && objetivoActivo && dejaDeSerOwnerActivo && propietariosActivos <= 1) {
    return "ultimo_owner";
  }

  return null;
}
