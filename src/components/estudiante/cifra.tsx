import { StatCard } from "@/components/ui/stat-card";

/**
 * @deprecated Usa `StatCard` con `variant="centrada"`
 * (`@/components/ui/stat-card`). Este envoltorio existe solo para no romper las
 * pantallas que todavía la importan; se borra al terminar la Fase 5.
 */
export function Cifra(props: {
  valor: string;
  etiqueta: string;
  color?: string;
}) {
  return <StatCard variant="centrada" {...props} />;
}
