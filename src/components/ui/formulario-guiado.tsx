"use client";

import { cn } from "@/lib/utils";

/**
 * Estructura de un formulario largo en secciones con título.
 *
 * Antes cada persona elegía entre «normal» y «guiado» (un paso a la vez). Se quitó el
 * modo guiado en todo el portal (docs/ux-rules.md §7: un solo formulario, sin toggles):
 * los dos modos duplicaban la validación y la prueba. Los componentes se conservan con la
 * misma firma para que las ~40 pantallas que los usan no cambien: ahora `FormularioGuiado`
 * solo agrupa, `PasoFormulario` es una sección con título y `AccionesFormulario` deja los
 * botones tal cual. Un formulario nuevo debería usar `SidePanelForm` (lo obligatorio a la
 * vista y lo demás en «Más detalles»).
 */
export function FormularioGuiado({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("space-y-5", className)}>{children}</div>;
}

export function PasoFormulario({ titulo, children, className }: { titulo: string; children: React.ReactNode; className?: string }) {
  return (
    <section aria-label={titulo} className={cn("space-y-4", className)}>
      <h3 className="text-label text-tinta">{titulo}</h3>
      {children}
    </section>
  );
}

export function AccionesFormulario({ children }: { children: React.ReactNode; className?: string }) {
  return <>{children}</>;
}
