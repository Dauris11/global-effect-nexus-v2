import { cn } from "@/lib/utils";

/**
 * Interruptor de encendido/apagado. El área táctil crece más allá del dibujo
 * (44 px) para que se acierte con el pulgar, y la perilla se desliza en vez de
 * saltar. `role="switch"` + `aria-checked`: un lector de pantalla lo anuncia
 * como interruptor, no como botón.
 */
export function Interruptor({
  activo,
  onCambio,
  etiqueta,
  deshabilitado,
  className,
}: {
  activo: boolean;
  onCambio: (activo: boolean) => void;
  /** Nombre accesible: qué enciende o apaga. */
  etiqueta: string;
  deshabilitado?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      disabled={deshabilitado}
      onClick={() => onCambio(!activo)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-(--duracion-media) ease-salida",
        "after:absolute after:-inset-2.5 after:content-['']",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        activo ? "bg-marca-500" : "bg-linea-fuerte",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none block size-5 rounded-full bg-background shadow-card transition-transform duration-(--duracion-media) ease-salida",
          activo ? "translate-x-[22px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}
