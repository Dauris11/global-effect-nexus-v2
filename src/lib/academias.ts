/**
 * Vocabulario compartido de las academias.
 *
 * En `src/lib` por lo de siempre: los formularios de programas y materiales son
 * componentes CLIENTE y necesitan estas listas. Un valor importado de
 * `@/server/**\/consultas` arrastra `pg` al navegador (ver la cabecera de
 * `src/lib/operaciones.ts`).
 *
 * Las tres listas replican los comentarios de la migración 0007, donde las
 * columnas son TEXT **sin CHECK**. Que la base no los imponga es la razón de
 * escribirlos aquí una sola vez.
 */

/** `academia.tipo`. */
export const TIPOS_ACADEMIA = ["liderazgo", "habilidades", "otro"] as const;

/** `academia.estado`. */
export const ESTADOS_ACADEMIA = ["activa", "planificada", "inactiva"] as const;

/** `material.tipo`. */
export const TIPOS_MATERIAL_ACADEMIA = [
  "documento",
  "presentacion",
  "video",
  "enlace",
  "otro",
] as const;

export type TipoAcademia = (typeof TIPOS_ACADEMIA)[number];
export type EstadoAcademia = (typeof ESTADOS_ACADEMIA)[number];
export type TipoMaterialAcademia = (typeof TIPOS_MATERIAL_ACADEMIA)[number];

export function esTipoAcademia(valor: string): valor is TipoAcademia {
  return (TIPOS_ACADEMIA as readonly string[]).includes(valor);
}

export function esEstadoAcademia(valor: string): valor is EstadoAcademia {
  return (ESTADOS_ACADEMIA as readonly string[]).includes(valor);
}

export function esTipoMaterialAcademia(
  valor: string,
): valor is TipoMaterialAcademia {
  return (TIPOS_MATERIAL_ACADEMIA as readonly string[]).includes(valor);
}

/**
 * Un enlace que va a acabar en un `href`.
 *
 * La misma comprobación que la landing hace con `cta_enlace`, y por el mismo
 * motivo: sin ella, `javascript:` en el enlace de un material es un XSS
 * almacenado que se sirve a todo el equipo. Se admite ruta interna o `https://`
 * y nada más —ni `http://`, que en 2026 no hace falta—.
 */
export function enlaceValido(valor: string): boolean {
  return valor.startsWith("/") || valor.startsWith("https://");
}
