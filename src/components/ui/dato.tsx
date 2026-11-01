import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Un dato de una tarjeta: icono y valor, en línea. Sustituye al texto gris
 * pequeño que hacía de subtítulo ("12 mar · Biología · Aula 3"): ahí cada dato
 * se leía como un trozo de frase; con icono, cada uno es una pieza y se
 * reconoce de un vistazo sin leer.
 */
export function Dato({
  icono: Icono,
  children,
  className,
}: {
  icono: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-w-0 items-center gap-1.5 text-sm text-tinta-2",
        className,
      )}
    >
      <Icono aria-hidden className="size-4 shrink-0 text-tinta-3" />
      <span className="truncate">{children}</span>
    </span>
  );
}

/** Los datos de una tarjeta, repartidos en fila y que bajan de línea si no caben. */
export function FilaDatos({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1", className)}>
      {children}
    </div>
  );
}
