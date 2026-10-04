import { cn } from "@/lib/utils";

/**
 * Hueco de carga. Se dibuja con la MISMA forma que el contenido que va a
 * llegar —un título, tres cifras, una lista—, para que al cargar nada salte de
 * sitio. El brillo es `animate-shimmer` y se apaga con movimiento reducido.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn("animate-shimmer rounded-control", className)}
      {...props}
    />
  );
}

export { Skeleton };
