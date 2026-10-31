"use client";

import { ChevronDown, Eye, Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLES, type Rol } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { verComoRol } from "@/server/auth/acciones";

/**
 * Control del administrador maestro para mirar el sistema con los ojos de otro
 * rol. Solo se pinta si el rol REAL es `super_admin`; la acción lo vuelve a
 * comprobar en el servidor, así que esconderlo no es lo que protege.
 *
 * Mientras se «ve como», sale como franja fija encima de la cabecera: olvidar
 * que se está en otro rol y creer que falta una función es el error que evita.
 */
export function VerComo({ rol, rolReal }: { rol: Rol; rolReal: Rol }) {
  const t = useTranslations("verComo");
  const tRoles = useTranslations("roles");
  const [pendiente, iniciar] = useTransition();

  if (rolReal !== "super_admin") return null;

  const cambiar = (destino: Rol) => iniciar(() => verComoRol(destino));
  const viendoOtro = rol !== rolReal;

  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={viendoOtro ? "secondary" : "outline"}
          size="sm"
          disabled={pendiente}
          className="gap-1.5"
        >
          <Eye className="size-4" aria-hidden />
          {viendoOtro ? t("cambiar") : t("label")}
          <ChevronDown className="size-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>{t("label")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ROLES.filter((r) => r !== "super_admin").map((r) => (
          <DropdownMenuItem
            key={r}
            onSelect={() => cambiar(r)}
            aria-current={r === rol ? "true" : undefined}
            className={cn(r === rol && "text-marca-700 font-medium")}
          >
            {tRoles(r)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (!viendoOtro) return menu;

  return (
    <div
      role="status"
      className="bg-tinta text-background sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 px-4 py-2 text-sm"
    >
      <Eye className="size-4 shrink-0" aria-hidden />
      <span>{t("viendo", { rol: tRoles(rol) })}</span>
      <div className="flex items-center gap-2">
        {menu}
        <Button
          size="sm"
          onClick={() => cambiar("super_admin")}
          disabled={pendiente}
          className="gap-1.5"
        >
          <Undo2 className="size-4" aria-hidden />
          {t("volver")}
        </Button>
      </div>
    </div>
  );
}
