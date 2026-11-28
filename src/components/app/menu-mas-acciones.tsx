"use client";

import { MoreHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";

/** `icono` va como elemento (`<Download />`): un componente no puede cruzar de servidor a cliente. */
export type AccionDeMenu = { etiqueta: string; icono?: React.ReactNode; peligro?: boolean } & ({ href: string } | { onClick: () => void });

/** El menú «⋯» del encabezado: lo que no merece un botón (docs/ux-rules.md §5). */
export function MenuMasAcciones({ acciones, compacto = false }: { acciones: readonly AccionDeMenu[]; compacto?: boolean }) {
  const t = useTranslations("appUi");

  if (acciones.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={compacto ? "ghost" : "outline"}
          size={compacto ? "icon-sm" : "icon"}
          aria-label={t("menu.more")}
          title={t("menu.more")}
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {acciones.map((a) => {
          return "href" in a ? (
            <DropdownMenuItem key={a.etiqueta} asChild className={a.peligro ? "text-(--btn-danger-fg)" : undefined}>
              <Link href={a.href}>
                {a.icono}
                {a.etiqueta}
              </Link>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem key={a.etiqueta} onSelect={a.onClick} className={a.peligro ? "text-(--btn-danger-fg)" : undefined}>
              {a.icono}
              {a.etiqueta}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
