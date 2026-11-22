"use client";

import { Printer } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

/**
 * Abre el diálogo de impresión del navegador: ahí se elige la impresora o «Guardar como
 * PDF». Es la misma vía para todo el sistema, así que cualquier pantalla se puede imprimir
 * o pasar a PDF sin generar nada aparte. El botón no sale en el papel.
 */
export function BotonImprimir({ className }: { className?: string }) {
  const t = useTranslations("export");

  return (
    <Button type="button" variant="outline" size="sm" className={`no-imprimir ${className ?? ""}`} onClick={() => window.print()}>
      <Printer className="size-4" />
      {t("print")}
    </Button>
  );
}
