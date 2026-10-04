import type { LucideIcon } from "lucide-react";

import { StatCard } from "@/components/ui/stat-card";

/**
 * @deprecated Usa `StatCard` (`@/components/ui/stat-card`). Este envoltorio
 * existe solo para no romper las pantallas que todavía la importan; se borra
 * al terminar la Fase 5 del rediseño.
 */
export function CifraAcademica(props: {
  valor: string | number;
  etiqueta: string;
  icono: LucideIcon;
  acento?: boolean;
}) {
  return <StatCard {...props} />;
}
