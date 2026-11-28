import { cva, type VariantProps } from "class-variance-authority";
import { AlertCircle, Info } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Aviso en línea dentro de un formulario o una tarjeta. `danger` es el error
 * (tokens `status-danger-*`, que ya cambian solos en oscuro) y `info` es el aviso
 * neutro de marca. Siempre lleva icono: el color solo no sobrevive en grises.
 */
const variantesAlert = cva("flex items-start gap-2.5 rounded-control border px-4 py-3 text-sm", {
  variants: {
    variant: {
      danger: "border-status-danger-border bg-status-danger-bg text-status-danger-fg",
      info: "border-status-info-border bg-marca-50 text-marca-700",
    },
  },
  defaultVariants: { variant: "info" },
});

const ICONO = { danger: AlertCircle, info: Info } as const;

function Alert({
  className,
  variant = "info",
  children,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof variantesAlert>) {
  const Icono = ICONO[variant ?? "info"];

  return (
    <div
      data-slot="alert"
      // El error se anuncia al instante; un aviso informativo no interrumpe.
      role={variant === "danger" ? "alert" : "status"}
      className={cn(variantesAlert({ variant }), className)}
      {...props}
    >
      <Icono className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export { Alert, variantesAlert };
