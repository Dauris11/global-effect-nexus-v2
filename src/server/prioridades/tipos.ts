import type { ContextoPrioridades, PrioridadItem } from "@/lib/prioridades/types";
import type { UsuarioSesion } from "@/lib/auth";

/** Lo que un proveedor entrega: el ítem sin `severidad` ni `score`, que calcula el motor. */
export type ItemCrudo = Omit<PrioridadItem, "severidad" | "score">;

/** El contexto del contrato más la persona completa (sus permisos reales, no solo el rol). */
export type ContextoServidor = ContextoPrioridades & { usuario: UsuarioSesion };

export type Proveedor = {
  nombre: string;
  /** Si la persona no puede ver ninguno de estos tipos, ni se lanza la consulta. */
  tipos: readonly PrioridadItem["tipo"][];
  getItems: (ctx: ContextoServidor) => Promise<ItemCrudo[]>;
};

/** `YYYY-MM-DD` → mediodía UTC: cae en ese mismo día en la hora de RD (UTC−4). */
export const diaComoFecha = (dia: string): Date => new Date(`${dia}T12:00:00Z`);
