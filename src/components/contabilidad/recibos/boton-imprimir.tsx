"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

/** El diálogo de impresión del navegador, que también guarda como PDF. */
export function BotonImprimir({ etiqueta }: { etiqueta: string }) {
  return (
    <Button type="button" onClick={() => window.print()} className="print:hidden">
      <Printer className="size-4" />
      {etiqueta}
    </Button>
  );
}
