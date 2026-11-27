"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * Formulario en panel lateral (docs/ux-rules.md §6 y §7): encabezado, cuerpo con
 * desplazamiento y pie fijo (Cancelar / acción primaria). Solo lo obligatorio va a la
 * vista; lo opcional va en `moreDetails`, plegado en «Más detalles». Sin modo
 * normal/guiado ni rápido/completo.
 *
 * Pasa `action` (acción de servidor) o `onSubmit`; el botón primario es el único de la
 * pantalla mientras el panel está abierto. Para más de 12 campos, usa una página.
 */
export function SidePanelForm({
  open,
  onOpenChange,
  title,
  description,
  children,
  moreDetails,
  submitLabel,
  submitIcon,
  pending,
  action,
  onSubmit,
  className,
}: {
  open: boolean;
  onOpenChange: (abierto: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  moreDetails?: React.ReactNode;
  submitLabel: string;
  submitIcon?: React.ReactNode;
  pending?: boolean;
  action?: (datos: FormData) => void | Promise<void>;
  onSubmit?: React.FormEventHandler<HTMLFormElement>;
  className?: string;
}) {
  const t = useTranslations("appUi");
  const [conDetalles, setConDetalles] = useState(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className={className}>
        <form action={action} onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <header className="border-b border-linea px-6 pt-6 pb-4 pr-16">
            <SheetTitle className="text-section">{title}</SheetTitle>
            {description ? <SheetDescription className="text-meta mt-1">{description}</SheetDescription> : <SheetDescription className="sr-only">{title}</SheetDescription>}
          </header>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {children}

            {moreDetails && (
              <div className="border-t border-linea pt-4">
                <button
                  type="button"
                  aria-expanded={conDetalles}
                  onClick={() => setConDetalles((v) => !v)}
                  className="text-label flex w-full items-center justify-between rounded-control py-1 text-tinta-2 hover:text-tinta focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {t("panel.moreDetails")}
                  <ChevronDown aria-hidden className={cn("size-4 transition-transform duration-(--duracion-rapida)", conDetalles && "rotate-180")} />
                </button>
                {conDetalles && <div className="mt-4 space-y-5">{moreDetails}</div>}
              </div>
            )}
          </div>

          <footer className="flex justify-end gap-2 border-t border-linea bg-background px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <SheetClose asChild>
              <Button type="button" variant="ghost">
                {t("panel.cancel")}
              </Button>
            </SheetClose>
            <Button type="submit" cargando={pending}>
              {submitIcon}
              {submitLabel}
            </Button>
          </footer>
        </form>
      </SheetContent>
    </Sheet>
  );
}
