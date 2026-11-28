"use client";

import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

/**
 * Panel lateral de detalle de una fila de lista contable (docs/ux-rules.md §6).
 *
 * El disparador es un botón estirado sobre toda la fila (`after:absolute
 * after:inset-0`): la `<tr>` tiene que ser `relative` y las acciones de la
 * fila llevan `relative z-10` para quedar por encima. El cuerpo, el pie y el
 * estado llegan ya armados desde la página de servidor (como nodos), así que
 * este componente no sabe nada de asientos ni de recibos.
 */
export function PanelFila({
  disparador,
  etiquetaAbrir,
  titulo,
  descripcion,
  estado,
  pie,
  children,
}: {
  /** Lo que se ve dentro de la celda (el folio). */
  disparador: React.ReactNode;
  /** Nombre accesible del botón: «Ver recibo RI-000012». */
  etiquetaAbrir: string;
  titulo: string;
  /** Solo para lectores de pantalla. */
  descripcion: string;
  estado: React.ReactNode;
  pie?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label={etiquetaAbrir}
          className="text-left outline-none after:absolute after:inset-0 after:content-[''] focus-visible:ring-2 focus-visible:ring-ring"
        >
          {disparador}
        </button>
      </SheetTrigger>

      <SheetContent>
        <header className="space-y-2 border-b border-linea px-6 pt-6 pr-16 pb-4">
          <SheetTitle className="folio">{titulo}</SheetTitle>
          <SheetDescription className="sr-only">{descripcion}</SheetDescription>
          {estado}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {pie && (
          <footer className="flex flex-wrap items-start justify-end gap-2 border-t border-linea px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {pie}
          </footer>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** Un dato del panel: etiqueta pequeña arriba y el valor debajo. */
export function DatoPanel({ etiqueta, children, ancho = false }: { etiqueta: string; children: React.ReactNode; ancho?: boolean }) {
  return (
    <div className={ancho ? "min-w-0 space-y-1 sm:col-span-2" : "min-w-0 space-y-1"}>
      <dt className="text-meta">{etiqueta}</dt>
      <dd className="text-body leading-snug font-medium break-words text-tinta">{children}</dd>
    </div>
  );
}
