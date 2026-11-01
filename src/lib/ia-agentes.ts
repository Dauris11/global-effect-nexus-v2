import type { Rol } from "@/lib/rbac";

/**
 * Qué agente atiende a cada rol. Lo decide el servidor con el rol de la
 * sesión: el cliente nunca elige agente, así que nadie puede pedir el de
 * Contabilidad siendo estudiante.
 *
 * Es un mapa en código y no una consulta porque el rol ya es un valor cerrado
 * (`ROLES`); la tabla `ai_agente` guarda lo que SÍ cambia —instrucciones,
 * modelo y límites— y se enlaza por esta clave. Si falta una clave en la tabla,
 * el agente usa los valores por defecto y no falla.
 */
export const AGENTE_POR_ROL = {
  estudiante: "agente_estudiante",
  docente: "agente_docente",
  contabilidad: "agente_contabilidad",
  admin: "agente_admin",
  habitudes: "agente_habitudes",
  dir_habitudes: "agente_habitudes",
  super_admin: "agente_direccion",
  colaborador: "agente_colaborador",
  chofer: "agente_colaborador",
} as const satisfies Record<Rol, string>;

export type ClaveAgente = (typeof AGENTE_POR_ROL)[Rol];

export function agenteDeRol(rol: Rol): ClaveAgente {
  return AGENTE_POR_ROL[rol];
}
