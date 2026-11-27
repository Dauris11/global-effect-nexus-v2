"use client";

import { MoreHorizontal, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";

export type AccionDeMenu = { etiqueta: string; icono?: LucideIcon } & ({ href: string } | { onClick: () => void });

/** El menú «⋯» del encabezado: lo que no merece un botón (docs/ux-rules.md §5). */
export function MenuMasAcciones({ acciones }: { acciones: readonly AccionDeMenu[] }) {
  const t = useTranslations("appUi");

  if (acciones.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label={t("menu.more")}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {acciones.map((a) => {
          const Icono = a.icono;

          return "href" in a ? (
            <DropdownMenuItem key={a.etiqueta} asChild>
              <Link href={a.href}>
                {Icono && <Icono />}
                {a.etiqueta}
              </Link>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem key={a.etiqueta} onSelect={a.onClick}>
              {Icono && <Icono />}
              {a.etiqueta}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
