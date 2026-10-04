"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

/**
 * Modal. Es el patrón de formulario de todo el sistema: los 17 botones de
 * creación del inventario abren un Dialog.
 *
 * El contenido puede crecer mucho (el expediente son 6 pestañas y 75 campos),
 * así que `DialogContent` limita la altura y desplaza por dentro en vez de
 * empujar la página.
 *
 * DOS FORMAS, UN COMPONENTE (docs/09-sistema-visual.md §3):
 *   · ≥ md: modal centrado, `rounded-hoja`, cerrar a la IZQUIERDA y título
 *     centrado, como los de Airbnb.
 *   · < md: hoja inferior. Sube desde abajo, lleva un asa arriba y ocupa como
 *     mucho el 90 % del alto: en un teléfono un modal centrado deja el teclado
 *     tapando el botón de guardar.
 * Se hace con clases por breakpoint y no con dos componentes, para que ninguna
 * de las diecisiete pantallas que abren un diálogo tenga que cambiar.
 *
 * `DialogFooter` es pegajoso al fondo del área desplazable: en un formulario
 * largo, "Guardar" está siempre a la vista.
 */

function Dialog(props: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger(
  props: React.ComponentProps<typeof DialogPrimitive.Trigger>,
) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogClose(props: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/40",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className,
      )}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  mostrarCerrar = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  mostrarCerrar?: boolean;
}) {
  const t = useTranslations("common");

  return (
    <DialogPrimitive.Portal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "bg-background fixed z-50 grid gap-4 border border-linea p-5 pt-7 shadow-elevada duration-200 md:p-6",
          // Móvil: hoja inferior.
          "inset-x-0 bottom-0 max-h-[90dvh] w-full rounded-t-hoja pb-[max(1.25rem,env(safe-area-inset-bottom))]",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
          // Escritorio: modal centrado.
          "md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:w-[calc(100%-2rem)] md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-hoja md:pt-6",
          "md:data-[state=open]:slide-in-from-bottom-0 md:data-[state=closed]:slide-out-to-bottom-0 md:data-[state=open]:zoom-in-95 md:data-[state=closed]:zoom-out-95 md:data-[state=open]:fade-in-0 md:data-[state=closed]:fade-out-0",
          // Los formularios largos se desplazan por dentro.
          "overflow-y-auto md:max-h-[calc(100dvh-4rem)]",
          className,
        )}
        {...props}
      >
        {/* El asa de la hoja: dice "esto se puede bajar" sin texto. */}
        <span
          aria-hidden
          className="bg-linea-fuerte absolute top-2.5 left-1/2 h-1.5 w-10 -translate-x-1/2 rounded-full md:hidden"
        />
        {children}
        {mostrarCerrar && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="text-tinta hover:bg-muted focus-visible:ring-ring absolute top-3 left-3 flex size-9 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none md:top-4 md:left-4"
          >
            <X className="size-4" />
            <span className="sr-only">{t("close")}</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        // Título centrado y con aire a los lados para no pisar el botón de
        // cerrar, que va a la izquierda.
        "flex flex-col gap-1.5 border-b border-linea -mx-5 px-12 pb-4 text-center md:-mx-6",
        className,
      )}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "bg-background sticky -bottom-5 -mx-5 -mb-5 flex flex-col-reverse gap-2 border-t border-linea px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:-bottom-6 md:-mx-6 md:-mb-6 md:px-6",
        className,
      )}
      {...props}
    />
  );
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-base font-semibold leading-snug text-tinta", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm text-tinta-2", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
  DialogTrigger,
};
