import { colorDeLetra, type Letra } from "@/lib/notas";
import { cn } from "@/lib/utils";

/**
 * La letra de una nota en su cuadro. El color sale de `colorDeLetra`
 * (`lib/notas.ts`), que es la única escala: A el azul más pesado, F en tinta.
 * Aquí solo se decide el tamaño.
 */
export function LetraNota({
  letra,
  pequena = false,
}: {
  letra: Letra;
  pequena?: boolean;
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-control border font-semibold",
        pequena ? "size-8 text-xs" : "size-10 text-sm",
        colorDeLetra(letra),
      )}
    >
      {letra}
    </span>
  );
}
