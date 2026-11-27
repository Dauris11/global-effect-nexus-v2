import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type Base = { icon: LucideIcon; title: string; description?: string; className?: string };

/**
 * Estado vacío (docs/ux-rules.md §8): icono, una frase de qué pasa y UN botón con la
 * acción siguiente. Si el rol no puede actuar, `readOnly` permite omitirla, y entonces
 * `description` debería decir a quién pedirla. El tipo lo exige: sin `action` no compila
 * salvo con `readOnly`.
 */
export function EmptyState(props: Base & ({ action: React.ReactNode; readOnly?: false } | { readOnly: true; action?: React.ReactNode })) {
  const { icon: Icono, title, description, action, className } = props;

  return (
    <div className={cn("flex flex-col items-center rounded-card border border-linea bg-card px-6 py-12 text-center", className)}>
      <span className="flex size-14 items-center justify-center rounded-full bg-muted text-tinta-2">
        <Icono aria-hidden className="size-7" />
      </span>
      <p className="text-section mt-4">{title}</p>
      {description && <p className="text-meta mt-1 max-w-md">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
