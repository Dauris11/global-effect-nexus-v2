import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Píldora: estado, contador, etiqueta (docs/09-sistema-visual.md §3).
 *
 * Tres variantes del lenguaje "app web" —`neutra`, `marca`, `solida`— y las
 * cuatro de shadcn que ya usaban las pantallas, reapuntadas a los tokens para
 * no romper ninguna. Un estado de entidad no usa variante: lleva las clases de
 * su `*_VISUAL` (con su icono) por encima.
 */
const variantesBadge = cva(
  "inline-flex items-center justify-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 [&>svg]:pointer-events-none transition-colors duration-(--duracion-rapida)",
  {
    variants: {
      variant: {
        neutra: "border-transparent bg-muted text-tinta-2",
        marca: "border-transparent bg-marca-50 text-marca-700",
        solida: "border-transparent bg-tinta text-background",
        default: "border-transparent bg-marca-50 text-marca-700",
        secondary: "border-transparent bg-muted text-tinta-2",
        destructive: "border-transparent bg-tinta text-background",
        outline: "border-linea-fuerte text-tinta-2",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  vivo = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof variantesBadge> & {
    asChild?: boolean;
    /**
     * Para lo que está pasando ahora (una sesión en curso, un plazo abierto):
     * respira despacio. Solo uno por pantalla, o deja de significar algo.
     */
    vivo?: boolean;
  }) {
  const Componente = asChild ? Slot : "span";

  return (
    <Componente
      data-slot="badge"
      className={cn(variantesBadge({ variant }), vivo && "animate-soft-pulse", className)}
      {...props}
    />
  );
}

export { Badge, variantesBadge };
