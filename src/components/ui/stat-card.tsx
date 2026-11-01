import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { STAT_CARD } from "@/lib/paleta";
import { cn } from "@/lib/utils";

/**
 * Tarjeta de cifra (KPI). Una sola para todo el sistema.
 *
 * Antes había dos —`CifraAcademica`, con icono al lado, y la `Cifra` centrada
 * del portal estudiantil— y cada una se parecía a sus vecinas y no a la otra.
 * Ahora son dos variantes del mismo componente:
 *
 *   · `con-icono` (por defecto): icono en círculo, cifra grande y etiqueta.
 *     Es la de las pantallas de gestión y la fila de cifras de cada portal.
 *   · `centrada`: cifra y etiqueta centradas, sin icono, para las subpáginas
 *     del estudiante.
 *
 * La cifra va en tinta. El acento —cuando lo hay— lo lleva solo el icono: si
 * todas las cifras destacan, ninguna destaca.
 *
 * Movimiento: la cifra sube 8 px al llegar, un pelo después que la tarjeta, y
 * al pasar el ratón solo el icono reacciona. La tarjeta no se eleva: no es un
 * enlace, y elevarla prometería un clic que no existe.
 */
export function StatCard({
  valor,
  etiqueta,
  icono: Icono,
  acento = false,
  variant = "con-icono",
  color,
  className,
}: {
  valor: string | number;
  etiqueta: string;
  icono?: LucideIcon;
  /** Para la cifra que se viene a mirar. */
  acento?: boolean;
  variant?: "con-icono" | "centrada";
  /** Clase de color del valor, solo en `centrada` (p. ej. un estado SEMAFORO). */
  color?: string;
  className?: string;
}) {
  if (variant === "centrada") {
    return (
      <Card className={cn("items-center justify-center p-5 text-center", className)}>
        <p className={cn(STAT_CARD.valorNeutro, "animate-entrada [animation-delay:60ms]", color)}>
          {valor}
        </p>
        <p className={STAT_CARD.label}>{etiqueta}</p>
      </Card>
    );
  }

  return (
    <Card className={cn("group/cifra flex-row items-center gap-4 p-5", className)}>
      {Icono && (
        <span
          className={cn(
            acento ? STAT_CARD.iconoAcento : STAT_CARD.iconoNeutro,
            "transition-transform duration-(--duracion-media) ease-salida group-hover/cifra:scale-105",
          )}
        >
          <Icono className="size-5" />
        </span>
      )}
      <div className="min-w-0">
        <p className={cn(STAT_CARD.valorNeutro, "animate-entrada [animation-delay:60ms]")}>
          {valor}
        </p>
        <p className={cn(STAT_CARD.label, "line-clamp-2 break-words")}>{etiqueta}</p>
      </div>
    </Card>
  );
}
