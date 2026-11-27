"use client";

import * as SheetPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

/**
 * Panel lateral (docs/ux-rules.md §6): crear o editar sin salir de la lista.
 * Entra por la derecha y mide 480–560 px (a pantalla completa en el teléfono, donde
 * un panel de 520 px no cabe). Va sobre Radix Dialog: foco atrapado, Escape y
 * lectores de pantalla ya resueltos. Para formularios usa `SidePanelForm`.
 */
const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;
const SheetTitle = SheetPrimitive.Title;
const SheetDescription = SheetPrimitive.Description;

function SheetContent({ className, children, ...props }: React.ComponentProps<typeof SheetPrimitive.Content>) {
  const t = useTranslations("appUi");

  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay
        className={cn(
          "fixed inset-0 z-50 bg-black/40",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "duration-(--duracion-media) ease-salida",
        )}
      />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex h-dvh w-full flex-col bg-background shadow-elevada outline-none sm:w-[520px] sm:max-w-[560px] sm:rounded-l-hoja",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right",
          "duration-(--duracion-media) ease-salida",
          className,
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close
          aria-label={t("panel.close")}
          className="absolute top-4 right-4 inline-flex size-9 items-center justify-center rounded-full text-tinta-2 transition-colors hover:bg-muted hover:text-tinta focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <X className="size-4" />
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

export { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger };
