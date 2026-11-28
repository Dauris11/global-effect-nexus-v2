import { useTranslations } from "next-intl";

import { ROLE_COLOR, ROLE_LABEL } from "@/lib/roles";
import type { Rol } from "@/lib/rbac";
import { CLASES_TOKEN, ICONO_TOKEN } from "@/lib/status-map";
import { cn } from "@/lib/utils";

/**
 * Etiqueta de un rol («Propietario», «Desarrollador»…). Mismo dibujo que `StatusBadge` pero el color sale de
 * `ROLE_COLOR`, que solo agrupa roles y no significa estado: por eso lleva icono y el nombre siempre escrito,
 * para que se lea igual en grises. Sirve en servidor y en cliente (`roles` viaja en los mensajes del armazón).
 */
export function RolBadge({ rol, className }: { rol: Rol | string; className?: string }) {
  const t = useTranslations();
  const conocido = rol in ROLE_LABEL;
  const token = conocido ? ROLE_COLOR[rol as Rol] : "neutral";
  const Icono = ICONO_TOKEN[token];

  return (
    <span
      className={cn(
        "inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold whitespace-nowrap",
        CLASES_TOKEN[token].pastilla,
        className,
      )}
    >
      <Icono aria-hidden className={cn("size-3 shrink-0", CLASES_TOKEN[token].icono)} />
      {conocido ? t(ROLE_LABEL[rol as Rol]) : rol}
    </span>
  );
}
