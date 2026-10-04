import { cn } from "@/lib/utils";

/**
 * Barra de progreso de los proyectos (módulo 17).
 *
 * Sin Radix a propósito: `@radix-ui/react-progress` no está entre las
 * dependencias del proyecto y un div con `role="progressbar"` cubre el caso
 * completo, incluida la accesibilidad.
 */
function Progress({
  value = 0,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  /** Porcentaje 0-100. Se recorta al rango para que la barra no se desborde. */
  value?: number | null;
}) {
  const porcentaje = Math.min(100, Math.max(0, value ?? 0));

  return (
    <div
      data-slot="progress"
      role="progressbar"
      aria-valuenow={porcentaje}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(
        "bg-muted relative h-2 w-full overflow-hidden rounded-full",
        className,
      )}
      {...props}
    >
      <div
        data-slot="progress-indicator"
        className="bg-primary h-full rounded-full transition-[width] duration-500"
        style={{ width: `${porcentaje}%` }}
      />
    </div>
  );
}

export { Progress };
