"use client";

import { Printer } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

/**
 * Botón de impresión.
 *
 * Es lo ÚNICO cliente de la pantalla del comedor, y solo existe porque
 * `window.print()` no se puede llamar desde el servidor. Todo lo demás —el
 * filtro de fecha, la navegación entre días, la lista— es HTML y enlaces.
 *
 * El resto de la impresión no lo hace este botón sino las clases `print:` de
 * la página: quien prefiera Ctrl+P obtiene exactamente la misma hoja.
 */
export function BotonImprimir() {
  const t = useTranslations("comida");

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => window.print()}
      className="print:hidden"
    >
      <Printer className="size-3.5" />
      {t("print")}
    </Button>
  );
}
