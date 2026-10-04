import {
  BookOpen,
  CircleCheck,
  CircleSlash,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";

/**
 * Cómo se pinta el estado de una inscripción (`inscripcion.estado`), en un solo
 * sitio porque lo usan dos piezas: la lista de períodos y el catálogo de la
 * prematrícula, que marca las materias ya cerradas.
 *
 * Peso del azul y un icono por estado, para que se lea también en escala de
 * grises: aprobada es lo más pesado del azul; reprobada va en tinta, que es lo
 * que pide atención sin salirse de la marca; retirada, en gris.
 *
 * Un estado que no esté aquí cae en `retirada`, que es lo que menos afirma.
 */
export const ESTADO_INSCRIPCION: Record<
  string,
  { clases: string; icono: LucideIcon }
> = {
  activa: { clases: "bg-marca-50 text-marca-700", icono: BookOpen },
  aprobada: { clases: "bg-marca-700 text-white", icono: CircleCheck },
  reprobada: { clases: "bg-tinta text-background", icono: RotateCcw },
  retirada: { clases: "bg-muted text-tinta-2", icono: CircleSlash },
};

export function visualDeInscripcion(estado: string | null) {
  return ESTADO_INSCRIPCION[estado ?? ""] ?? ESTADO_INSCRIPCION.retirada;
}
