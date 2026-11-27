"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { useTranslations } from "next-intl";

import { FormularioRendicionGasto } from "@/components/colaborador/formulario-rendicion-gasto";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import type { SolicitudParaRendir } from "@/server/colaborador/consultas";

/**
 * «Subir comprobante» en un panel lateral (docs/ux-rules.md §6): el formulario con OCR
 * deja de ir encima de la bandeja y se abre solo cuando se va a usar. El panel se cierra
 * por su cuenta cuando el comprobante se envía (`onExito`).
 *
 * El formulario trae su propia tarjeta; dentro del panel se le quita el borde y la
 * sombra para que no haya una caja dentro de otra.
 */
export function SubirRendicion({
  programas,
  solicitudes,
  becados,
}: {
  programas: { id: string; nombre: string; codigo: string | null }[];
  solicitudes: SolicitudParaRendir[];
  becados: { id: string; nombre: string }[] | null;
}) {
  const t = useTranslations("rendicion");
  const tl = useTranslations("listas");
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <Button type="button" onClick={() => setAbierto(true)}>
        <Upload />
        {tl("rendiciones.subir" as never)}
      </Button>

      <Sheet open={abierto} onOpenChange={setAbierto}>
        <SheetContent>
          <div className="border-b border-linea px-6 py-5 pr-14">
            <SheetTitle className="text-section">{t("formTitle")}</SheetTitle>
            <SheetDescription className="sr-only">{t("formSubtitle")}</SheetDescription>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 [&_[data-slot=card]]:border-0 [&_[data-slot=card]]:bg-transparent [&_[data-slot=card]]:shadow-none [&_[data-slot=card-content]]:px-0 [&_[data-slot=card-header]]:hidden">
            <FormularioRendicionGasto
              programas={programas}
              solicitudes={solicitudes}
              becados={becados}
              onExito={() => setAbierto(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
