import {
  Ban,
  BookOpen,
  CheckCircle2,
  Clock,
  type LucideIcon,
  XCircle,
} from "lucide-react";

import type { Estado360 } from "@/server/estudiantes/historial-360";

/**
 * Aspecto de cada estado de una inscripción de Global Effect 360.
 *
 * Aprobada y reprobada son el estado de una entidad, así que son las únicas
 * que usan el semáforo; todas llevan su icono para que la diferencia sobreviva
 * en grises. Clases literales para que Tailwind las compile.
 */
export const ESTADO_360_VISUAL: Record<
  Estado360,
  { insignia: string; icono: LucideIcon }
> = {
  cursando: { insignia: "bg-marca-50 text-marca-700", icono: BookOpen },
  prematriculada: { insignia: "bg-muted text-tinta-2", icono: Clock },
  aprobada: { insignia: "bg-[#1E9E6A] text-white", icono: CheckCircle2 },
  reprobada: { insignia: "bg-[#B4342B] text-white", icono: XCircle },
  retirada: { insignia: "bg-muted text-tinta-3", icono: Ban },
};
