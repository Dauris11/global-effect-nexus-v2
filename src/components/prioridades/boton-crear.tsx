"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";
/** Solo datos serializables: un componente de icono no cruza de servidor a cliente. */
type Opcion = { clave: string; href: string };

/** El único botón primario de `/inicio`: «Nueva solicitud ▾» o «Registrar ▾», con el menú de crear. */
export function BotonCrear({ etiqueta, opciones }: { etiqueta: "newRequest" | "register"; opciones: readonly Opcion[] }) {
  const t = useTranslations("priorities");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button>
          {t(`primary.${etiqueta}`)}
          <ChevronDown aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {opciones.map((o) => (
          <DropdownMenuItem key={o.clave} asChild>
            <Link href={o.href}>
              {t(`quick.${o.clave}`)}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
