import { cn } from "@/lib/utils";

/**
 * Contenedor de `ChipFiltro`: una fila que se desplaza en horizontal sin barra
 * visible y que se desvanece en los bordes, para que se note que hay más a los
 * lados sin poner flechas. En escritorio suele caber entera.
 */
export function FilaChips({
  className,
  children,
  etiqueta,
}: {
  className?: string;
  children: React.ReactNode;
  /** Para lectores de pantalla: qué se filtra. */
  etiqueta?: string;
}) {
  return (
    <nav
      aria-label={etiqueta}
      className={cn(
        "sin-barra -mx-4 flex gap-7 overflow-x-auto border-b border-linea px-4 md:mx-0 md:px-0",
        "[mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-16px),transparent)] md:[mask-image:none]",
        className,
      )}
    >
      {children}
    </nav>
  );
}
