"use client";

import { useState } from "react";
import { Slot } from "@radix-ui/react-slot";
import { type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";

import { variantesBoton } from "@/components/ui/button-variantes";
import { cn } from "@/lib/utils";

/**
 * Botón base (docs/09-sistema-visual.md §3). Los estilos viven en `button-variantes.ts`
 * para que los componentes de servidor puedan usarlos sin importar este archivo de cliente.
 *
 * TODO botón tiene estado de carga, sin que cada pantalla lo cablee:
 *   · `cargando` lo fuerza desde fuera (acciones con `useTransition` o `useActionState`).
 *   · Un botón `type="submit"` dentro de un formulario con acción de servidor se carga
 *     solo mientras el formulario se envía (`useFormStatus`).
 *   · Si su `onClick` devuelve una promesa, se carga hasta que ella termine.
 * Cargando, el botón se deshabilita (un doble clic no manda dos veces), pone `aria-busy` y
 * cambia sus iconos por un único spinner; el texto se queda, para que el botón no cambie de ancho.
 */
function Button({
  className,
  variant,
  size,
  asChild = false,
  cargando,
  disabled,
  children,
  onClick,
  type,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof variantesBoton> & {
    /** Delega el estilo al hijo. Necesario para envolver un `Link`. */
    asChild?: boolean;
    /**
     * Fuerza el estado de carga. Con `asChild` no se pinta el spinner ni se deshabilita:
     * el hijo es un enlace.
     */
    cargando?: boolean;
  }) {
  const Componente = asChild ? Slot : "button";
  const { pending: enviando } = useFormStatus();
  const [ocupado, setOcupado] = useState(false);

  // Solo el botón que envía se carga con el formulario; los de «Cancelar» (type="button") no.
  const envia = !asChild && (type === "submit" || type === undefined) && enviando;
  const enCurso = !asChild && (cargando ?? (envia || ocupado));

  const alPulsar = onClick
    ? (evento: React.MouseEvent<HTMLButtonElement>) => {
        const resultado = (onClick as (e: React.MouseEvent<HTMLButtonElement>) => unknown)(evento);

        if (resultado && typeof (resultado as Promise<unknown>).then === "function") {
          setOcupado(true);
          void (resultado as Promise<unknown>).finally(() => setOcupado(false));
        }
      }
    : undefined;

  return (
    <Componente
      data-slot="button"
      // El test de UX (e2e/ux-guard) cuenta botones primarios: `default` es el CTA.
      data-variant={variant == null || variant === "default" ? "primary" : variant}
      className={cn(variantesBoton({ variant, size }), enCurso && "[&_svg:not([data-cargando])]:hidden", className)}
      disabled={asChild ? undefined : disabled || enCurso}
      aria-busy={enCurso || undefined}
      type={asChild ? undefined : type}
      onClick={alPulsar}
      {...props}
    >
      {enCurso ? (
        <>
          <Loader2 data-cargando className="animate-spin" />
          {children}
        </>
      ) : (
        children
      )}
    </Componente>
  );
}

export { Button };
