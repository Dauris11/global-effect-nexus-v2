import {
  DIAS_PARA_ESCALAR,
  DIRECCION_VE_DE_TODOS,
  SOLICITUDES_DE_CONTABILIDAD,
  UMBRAL_COMPRA_DIRECCION_USD,
} from "@/lib/prioridades/defaults";
import { diasEntre, type DiaDe } from "@/lib/prioridades/score";
import type { ContextoPrioridades, PrioridadItem } from "@/lib/prioridades/types";

/** Días que lleva vencido un ítem (0 si no está vencido o no tiene fecha). */
export function diasVencido(item: PrioridadItem, hoy: string, diaDe: DiaDe): number {
  if (!item.venceEn) return 0;

  return Math.max(0, diasEntre(diaDe(item.venceEn), hoy));
}

/** Ítem de otro responsable con más de 3 días vencido: lo ve dirección aunque no sea suyo. */
export function esEscalado(item: PrioridadItem, ctx: ContextoPrioridades, diaDe: DiaDe): boolean {
  return (
    item.severidad === "vencido" &&
    diasVencido(item, ctx.hoy, diaDe) > DIAS_PARA_ESCALAR &&
    item.responsableId !== undefined &&
    item.responsableId !== ctx.userId
  );
}

/**
 * Regla de visibilidad (una sola, para el motor y para las pruebas). Un ítem aparece si:
 *   (a) `responsableId === userId`; o
 *   (b) su tipo está en MIS responsabilidades y no tiene responsable asignado; o
 *   (c) es escalado y soy super_admin.
 * Más dos reglas de alcance: lo universal propio (tareas, mi solicitud respondida) y lo que
 * dirección ve de todas las personas.
 */
export function esVisible(item: PrioridadItem, ctx: ContextoPrioridades, diaDe: DiaDe): boolean {
  if (item.responsableId === ctx.userId) return true;

  if (ctx.rol === "super_admin") {
    if (DIRECCION_VE_DE_TODOS.includes(item.tipo)) return true;
    if (esEscalado(item, ctx, diaDe)) return true;
  }

  // Con responsable asignado (y no soy yo) el tipo ya no basta: lo atiende solo esa persona.
  if (item.responsableId) return false;
  if (!ctx.responsabilidades.has(item.tipo)) return false;

  // A dirección solo le llegan las compras por pagar de monto alto; el resto es de contabilidad.
  if (ctx.rol === "super_admin" && item.tipo === "compra_aprobada_por_pagar") {
    return (item.montoUsd ?? 0) > UMBRAL_COMPRA_DIRECCION_USD;
  }

  // Contabilidad atiende de las solicitudes solo Compra y Gasto.
  if (ctx.rol === "contabilidad" && item.tipo === "solicitud_por_decidir") {
    return item.subtipo !== undefined && SOLICITUDES_DE_CONTABILIDAD.includes(item.subtipo);
  }

  return true;
}

/** Marca como escalados los que dirección ve por (c) y deja el resto igual. */
export function filtrarVisibles(items: readonly PrioridadItem[], ctx: ContextoPrioridades, diaDe: DiaDe): PrioridadItem[] {
  return items
    .filter((i) => esVisible(i, ctx, diaDe))
    .map((i) => (ctx.rol === "super_admin" && i.responsableId !== ctx.userId && esEscalado(i, ctx, diaDe) ? { ...i, escalado: true } : i));
}
