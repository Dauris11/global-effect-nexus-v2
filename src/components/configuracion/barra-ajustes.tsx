"use client";

import {
  Activity,
  BookOpen,
  Cpu,
  Eye,
  KeyRound,
  LayoutGrid,
  Megaphone,
  Palette,
  ScrollText,
  SlidersHorizontal,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import type { ClaveAjuste } from "@/lib/configuracion";
import { cn } from "@/lib/utils";

const ICONO: Record<ClaveAjuste, LucideIcon> = {
  general: LayoutGrid,
  staff: UserCog,
  permissions: KeyRound,
  visibility: Eye,
  parameters: SlidersHorizontal,
  landing: Megaphone,
  ia: Cpu,
  knowledge: BookOpen,
  activity: Activity,
  audit: ScrollText,
  appearance: Palette,
};

/**
 * Barra de iconos de la configuración: cada ajuste a un toque, sin pasar por
 * un índice de tarjetas. En el móvil se desliza en horizontal en vez de
 * partirse en dos filas, como las pestañas de una app.
 */
export function BarraAjustes({
  ajustes,
}: {
  ajustes: readonly { clave: ClaveAjuste; href: string }[];
}) {
  const t = useTranslations("settings.nav");
  const ruta = usePathname();

  return (
    <nav aria-label={t("label")} className="-mx-4 mb-6 md:mx-0">
      <ul className="flex snap-x gap-1 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:flex-wrap md:px-0">
        {ajustes.map(({ clave, href }) => {
          const Icono = ICONO[clave];
          const activo =
            href === "/configuracion" ? ruta === href : ruta === href || ruta.startsWith(`${href}/`);

          return (
            <li key={clave} className="snap-start">
              <Link
                href={href}
                aria-current={activo ? "page" : undefined}
                title={t(clave)}
                className={cn(
                  "group flex min-h-11 min-w-[4.75rem] flex-col items-center justify-center gap-1 rounded-control px-3 py-2 text-xs font-medium transition-colors duration-150",
                  "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                  activo ? "bg-marca-50 text-marca-700" : "text-tinta-2 hover:bg-muted hover:text-tinta",
                )}
              >
                <Icono
                  className={cn(
                    "size-5 transition-transform duration-150 group-hover:-translate-y-0.5 motion-reduce:transform-none",
                    activo && "text-marca-500",
                  )}
                  aria-hidden
                />
                <span className="whitespace-nowrap">{t(clave)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
