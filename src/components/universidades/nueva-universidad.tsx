"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

import { FormUniversidad } from "./formularios";

/**
 * Acción primaria de la lista de universidades: abre el alta en un panel lateral para no
 * sacar a nadie de la lista. El permiso (`catalogo.escribir`) lo decide la página para
 * mostrarlo y `guardarUniversidad` lo vuelve a exigir.
 */
export function NuevaUniversidad({ etiqueta }: { etiqueta?: string }) {
  const t = useTranslations("catalog");
  const tl = useTranslations("listas");
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <Button type="button" onClick={() => setAbierto(true)}>
        <Plus className="size-4" />
        {etiqueta ?? t("university.new")}
      </Button>

      <Sheet open={abierto} onOpenChange={setAbierto}>
        <SheetContent>
          <header className="border-b border-linea px-6 pt-6 pr-16 pb-4">
            <SheetTitle className="text-section">{tl("universidades.nuevaTitulo")}</SheetTitle>
            <SheetDescription className="sr-only">{tl("universidades.nuevaTitulo")}</SheetDescription>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <FormUniversidad alCerrar={() => setAbierto(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
