import type { UsuarioConPermisos } from "@/lib/rbac";
import { usuarioTienePermiso } from "@/lib/rbac";

/**
 * Qué agentes puede alimentar cada persona en la base de conocimiento.
 *
 *   · `tecnico.conocimiento` → todos (solo developer) (`null`).
 *   · `contabilidad.configurar` → solo `agente_contabilidad`: es su normativa.
 *   · `ia.conocimiento` → solo `agente_estudiante`: es lo que `admin` mantiene.
 *
 * Es una lista y no un sí/no porque editar un documento puede CAMBIAR sus
 * agentes: hay que poder gestionar tanto los de antes como los de después, o
 * Contabilidad podría pasar un documento al agente de estudiantes.
 */
export function agentesGestionables(usuario: UsuarioConPermisos): readonly string[] | null {
  if (usuarioTienePermiso(usuario, "tecnico.conocimiento")) return null;

  const agentes: string[] = [];

  if (usuarioTienePermiso(usuario, "contabilidad.configurar")) agentes.push("agente_contabilidad");
  if (usuarioTienePermiso(usuario, "ia.conocimiento")) agentes.push("agente_estudiante");

  return agentes;
}

export function puedeGestionarAgentes(
  usuario: UsuarioConPermisos,
  agentes: readonly string[],
): boolean {
  const permitidos = agentesGestionables(usuario);

  if (permitidos === null) return true;

  return agentes.length > 0 && agentes.every((a) => permitidos.includes(a));
}
