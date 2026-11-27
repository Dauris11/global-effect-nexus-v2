import { useTranslations } from "next-intl";

import { CLASES_TOKEN, esEstadoConocido, tokenDeEstado } from "@/lib/status-map";
import { cn } from "@/lib/utils";

/**
 * Pastilla de estado (docs/ux-rules.md §9 y docs/ui-reference.html §2): 22 px, un punto del color del estado,
 * el texto en 12/600 y el borde del tono `-bd`. El color y el nombre salen de `src/lib/status-map.ts` y de
 * `messages/*.json` → `estados.<valor>`. Una pantalla solo dice `status="aprobada"`; nunca elige color.
 *
 * El estado se lee también sin color: el TEXTO dice el estado (Vencida, Pendiente, Aprobada…) y el punto solo lo
 * refuerza. Un valor que el mapa no conoce se muestra neutro y con su nombre legible, en vez de romper la pantalla.
 */
export function StatusBadge({ status, label, className }: { status: string; /** Sustituye la etiqueta estándar (p. ej. «Entregada» → «Entregada hoy»). */ label?: string; className?: string }) {
  const t = useTranslations("estados");
  const token = tokenDeEstado(status);
  const clases = CLASES_TOKEN[token];
  const texto = label ?? (esEstadoConocido(status) ? t(status) : status.replace(/_/g, " "));

  return (
    <span className={cn("inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold whitespace-nowrap", clases.pastilla, className)}>
      <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full bg-current", clases.icono)} />
      {texto}
    </span>
  );
}
