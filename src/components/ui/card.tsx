import { cn } from "@/lib/utils";

/**
 * Tarjeta (docs/09-sistema-visual.md §3): `rounded-card` (16 px), borde fino
 * `linea` y `shadow-card`, sobre un lienzo blanco. La separación la dan el aire
 * y la línea, no un fondo gris alrededor.
 *
 * `interactiva` es para la tarjeta que entera es un enlace o un botón: se eleva
 * al pasar y vuelve al pulsar. Una tarjeta que solo contiene cosas clicables no
 * la lleva, o todo el bloque parecería un botón.
 *
 * `CardTitle` va en `texto-titulo-tarjeta` y en tinta. Antes era gris pequeño,
 * del lenguaje de panel; en una app el título de la tarjeta es lo que se lee
 * primero.
 */

function Card({
  className,
  interactiva = false,
  ...props
}: React.ComponentProps<"div"> & { interactiva?: boolean }) {
  return (
    <div
      data-slot="card"
      className={cn(
        "bg-card text-card-foreground flex flex-col rounded-card border border-linea shadow-card",
        interactiva &&
          "cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-elevada active:scale-[0.99]",
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn("flex flex-col gap-1.5 p-5 md:p-6", className)}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "texto-titulo-tarjeta flex items-center gap-2 [&_svg]:text-tinta-2",
        className,
      )}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-tinta-2", className)}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn("ml-auto flex items-center gap-2", className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("p-5 md:p-6 pt-0", className)}
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center border-t border-linea p-5 md:px-6", className)}
      {...props}
    />
  );
}

export {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
};
