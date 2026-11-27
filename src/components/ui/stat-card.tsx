import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { CifraContador } from "@/components/ui/cifra-contador";
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
 * si es un número cuenta hasta su valor (`CifraContador`);
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
      <Card data-kpi className={cn("items-center justify-center p-5 text-center", className)}>
        <Valor valor={valor} className={cn(STAT_CARD.valorNeutro, "animate-entrada [animation-delay:60ms]", color)} />
        <p className={STAT_CARD.label}>{etiqueta}</p>
      </Card>
    );
  }

  // Etiqueta arriba y cifra debajo: la cifra es lo que se mira y la etiqueta, lo que la nombra.
  // El icono pasa a la esquina en un cuadrado redondeado, como el resto de las superficies.
  return (
    <Card data-kpi className={cn("group/cifra gap-4 p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className={cn(STAT_CARD.label, "mt-0 line-clamp-2 break-words font-medium")}>{etiqueta}</p>
        {Icono && (
          <span
            className={cn(
              acento ? STAT_CARD.iconoAcento : STAT_CARD.iconoNeutro,
              "transition-transform duration-(--duracion-media) ease-salida group-hover/cifra:scale-105",
            )}
          >
            <Icono className="size-[18px]" />
          </span>
        )}
      </div>
      <Valor
        valor={valor}
        // Un monto como «RD$ 1,164,987» a 34 px se partiría en dos renglones: baja a 26 y no se parte.
        className={cn(
          STAT_CARD.valorNeutro,
          "animate-entrada [animation-delay:60ms]",
          typeof valor === "string" && valor.length > 8 && "text-[26px] whitespace-nowrap",
        )}
      />
    </Card>
  );
}

/** Un número cuenta; un texto ya formateado («RD$ 1,200», «3/5») se pinta tal cual. */
function Valor({ valor, className }: { valor: string | number; className: string }) {
  return typeof valor === "number" && Number.isFinite(valor) ? (
    <CifraContador valor={valor} className={className} />
  ) : (
    <p className={className}>{valor}</p>
  );
}
