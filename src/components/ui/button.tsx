import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Botón base (docs/09-sistema-visual.md §3).
 *
 * `default` es el CTA: un degradado sutil de la marca, como el de Airbnb, y es
 * el único sitio donde el turquesa ocupa una superficie entera. `secondary` es
 * blanco con borde. `destructive` es tinta y no rojo: la gravedad la dice el
 * peso, no el matiz.
 *
 * Se mantiene la API de shadcn (variant, size, asChild) para que las pantallas
 * no cambien de firma; lo que cambia es el aspecto.
 */
const variantesBoton = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control text-sm font-semibold transicion-control active:scale-[0.97] active:duration-(--duracion-instante) disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-marca-500 to-marca-600 text-white shadow-card hover:from-marca-600 hover:to-marca-700 hover:shadow-elevada active:shadow-card",
        destructive: "bg-tinta text-background hover:bg-tinta/90",
        outline:
          "border border-linea-fuerte bg-background text-tinta hover:border-tinta hover:bg-muted",
        secondary:
          "border border-linea-fuerte bg-background text-tinta hover:bg-muted",
        ghost: "text-tinta hover:bg-muted",
        link: "text-tinta underline underline-offset-4 decoration-linea-fuerte hover:decoration-tinta active:scale-100",
      },
      size: {
        default: "h-11 px-5 has-[>svg]:px-4",
        sm: "h-9 gap-1.5 px-3.5 has-[>svg]:px-3",
        lg: "h-12 px-6 text-base has-[>svg]:px-5",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  cargando = false,
  disabled,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof variantesBoton> & {
    /** Delega el estilo al hijo. Necesario para envolver un `Link`. */
    asChild?: boolean;
    /**
     * Mientras se envía: muestra un spinner y deshabilita el botón, para que un
     * doble clic no mande el formulario dos veces. Con `asChild` no se pinta el
     * spinner —el hijo es un enlace y no se puede deshabilitar—.
     */
    cargando?: boolean;
  }) {
  const Componente = asChild ? Slot : "button";

  return (
    <Componente
      data-slot="button"
      className={cn(variantesBoton({ variant, size }), className)}
      disabled={asChild ? undefined : disabled || cargando}
      aria-busy={cargando || undefined}
      {...props}
    >
      {cargando && !asChild ? (
        <>
          <Loader2 className="animate-spin" />
          {children}
        </>
      ) : (
        children
      )}
    </Componente>
  );
}

export { Button, variantesBoton };
