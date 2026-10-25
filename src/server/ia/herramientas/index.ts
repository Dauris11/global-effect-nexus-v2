import type Anthropic from "@anthropic-ai/sdk";

import { tienePermiso, type Rol } from "@/lib/rbac";

import { HERRAMIENTAS_CONTABILIDAD } from "./contabilidad";
import { HERRAMIENTAS_GENERALES } from "./generales";
import type { Herramienta } from "./tipos";

/**
 * Catálogo de herramientas y quién las ve.
 *
 * Cada agente recibe SOLO las de su rol, y solo las que su permiso RBAC deja
 * usar. El modelo no conoce las demás: no puede pedir una que no existe en su
 * lista, y si la inventa, el motor la rechaza y lo anota.
 */
export const HERRAMIENTAS: readonly Herramienta[] = [...HERRAMIENTAS_GENERALES, ...HERRAMIENTAS_CONTABILIDAD];

export function herramientasVisibles(rol: Rol): Herramienta[] {
  return HERRAMIENTAS.filter(
    (h) => h.roles.includes(rol) && (!h.permiso || tienePermiso(rol, h.permiso)),
  );
}

export function buscarHerramienta(nombre: string): Herramienta | undefined {
  return HERRAMIENTAS.find((h) => h.nombre === nombre);
}

export function definiciones(lista: readonly Herramienta[]): Anthropic.Tool[] {
  return lista.map((h) => ({
    name: h.nombre,
    description: h.descripcion,
    input_schema: h.esquema,
  }));
}
