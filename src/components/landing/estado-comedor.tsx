import { cn } from "@/lib/utils";

/**
 * Estado EN VIVO del comedor dentro de la tarjeta «Inscripción de comida».
 *
 * Es de servidor a propósito. La hora se calcula en `seccion-acceso.tsx` con la
 * zona de la Fundación (`America/Santo_Domingo`) y la página se regenera cada
 * minuto, así que el HTML llega con el estado ya resuelto: no hay un primer
 * pintado «sin hora» que luego salte al cargar, y la tarjeta no cambia de alto.
 * La versión anterior leía el reloj del navegador, que obligaba a esperar a
 * hidratar y movía el contenido.
 *
 * Abierta usa el token `success` con un punto que late; cerrada, `warning`. El
 * texto dice el estado por sí solo, el color solo lo refuerza (docs/ux-rules §9).
 */
export function EstadoComedor({ abierto, texto }: { abierto: boolean; texto: string }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-[22px] max-w-full items-center gap-1.5 rounded-[11px] border px-2.5 py-0.5 text-xs font-semibold",
        abierto
          ? "border-status-success-border bg-status-success-bg text-status-success-fg"
          : "border-status-warning-border bg-status-warning-bg text-status-warning-fg",
      )}
    >
      <span aria-hidden className={cn("relative size-2 shrink-0 rounded-full bg-current", abierto && "landing-vivo")} />
      {texto}
    </span>
  );
}
