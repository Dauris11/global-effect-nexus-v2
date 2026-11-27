import { useTranslations } from "next-intl";

import { CLASES_TOKEN, ICONO_TOKEN, esEstadoConocido, tokenDeEstado } from "@/lib/status-map";
import { cn } from "@/lib/utils";

/**
 * Pastilla de estado (docs/ux-rules.md §9). El color y el icono salen de
 * `src/lib/status-map.ts`, la etiqueta de `messages/*.json` → `estados.<valor>`. Una
 * pantalla solo dice `status="aprobada"`; nunca elige color.
 *
 * Lleva icono además del color (regla del proyecto: el estado se tiene que leer
 * también en escala de grises). Un valor que el mapa no conoce se muestra neutro y con
 * su nombre legible, en vez de romper la pantalla.
 */
export function StatusBadge({ status, label, className }: { status: string; /** Sustituye la etiqueta estándar (p. ej. «Entregada» → «Entregada hoy»). */ label?: string; className?: string }) {
  const t = useTranslations("estados");
  const token = tokenDeEstado(status);
  const clases = CLASES_TOKEN[token];
  const Icono = ICONO_TOKEN[token];
  const texto = label ?? (esEstadoConocido(status) ? t(status) : status.replace(/_/g, " "));

  return (
    <span className={cn("inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap", clases.pastilla, className)}>
      <Icono aria-hidden className={cn("size-3", clases.icono, token === "progress" && "animate-none")} />
      {texto}
    </span>
  );
}
