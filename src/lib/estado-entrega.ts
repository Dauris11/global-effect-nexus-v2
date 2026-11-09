import {
  Award,
  Check,
  Clock,
  ClockAlert,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

/**
 * Cómo se pinta el estado de una entrega del aula virtual. Lo comparten la
 * tarjeta del portal del estudiante y la ficha del expediente: el estudiante y
 * quien lleva su expediente tienen que ver la misma tarea con el mismo color.
 *
 * Peso del azul y un icono por estado, para que se distinga también en escala
 * de grises. Lo calificado es lo más pesado del azul: ya está cerrado.
 *
 * "Vencida sin entregar" no está aquí: es el único estado que pide actuar, y
 * usa el rojo de `SEMAFORO` (ver `ENTREGA_VENCIDA`).
 */
export const ESTADO_ENTREGA: Record<string, { clases: string; icono: LucideIcon }> = {
  pendiente: { clases: "bg-muted text-tinta-2", icono: Clock },
  entregado: { clases: "bg-marca-50 text-marca-700", icono: Check },
  tarde: { clases: "bg-marca-50 text-marca-700", icono: ClockAlert },
  calificado: { clases: "bg-marca-700 text-white", icono: Award },
};

/**
 * La excepción `SEMAFORO` (docs/09-sistema-visual.md §2.3): una tarea vencida
 * sin entregar es el estado de una entidad que requiere una decisión. Va con
 * su icono, escrito como hex arbitrario y nunca `red-*`.
 */
export const ENTREGA_VENCIDA = { clases: "bg-[#B4342B] text-white", icono: TriangleAlert };

export function visualDeEntrega(estado: string | null, vencida: boolean) {
  if (vencida) return ENTREGA_VENCIDA;
  return ESTADO_ENTREGA[estado ?? ""] ?? ESTADO_ENTREGA.pendiente;
}
