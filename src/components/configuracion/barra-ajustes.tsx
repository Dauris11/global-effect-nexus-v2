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
 * Menú lateral de la configuración: cada ajuste a un toque, sin pasar por un
 * índice de tarjetas. En el móvil no cabe una columna, así que se convierte en
 * una tira que se desliza en horizontal, como las pestañas de una app.
 *
 * Las etiquetas llegan traducidas del servidor: así el espacio `settings`
 * entero no viaja al navegador por once palabras.
 */
export function BarraAjustes({
  titulo,
  ajustes,
}: {
  titulo: string;
  ajustes: readonly { clave: ClaveAjuste; href: string; etiqueta: string }[];
}) {
  const ruta = usePathname();

  return (
    <nav aria-label={titulo} className="-mx-4 md:sticky md:top-24 md:mx-0 md:self-start">
      <p className="texto-meta mb-2 hidden px-3 font-medium md:block">{titulo}</p>
      <ul className="flex gap-1 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:flex-col md:overflow-visible md:px-0 md:pb-0">
        {ajustes.map(({ clave, href, etiqueta }) => {
          const Icono = ICONO[clave];
          const activo =
            href === "/configuracion" ? ruta === href : ruta === href || ruta.startsWith(`${href}/`);

          return (
            <li key={clave} className="shrink-0">
              <Link
                href={href}
                aria-current={activo ? "page" : undefined}
                className={cn(
                  "group flex min-h-11 items-center gap-3 rounded-control px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-150",
                  "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                  activo ? "bg-marca-50 text-marca-700" : "text-tinta-2 hover:bg-muted hover:text-tinta",
                )}
              >
                <Icono
                  className={cn(
                    "size-5 shrink-0 transition-transform duration-150 group-hover:scale-110 motion-reduce:transform-none",
                    activo && "text-marca-500",
                  )}
                  aria-hidden
                />
                {etiqueta}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
