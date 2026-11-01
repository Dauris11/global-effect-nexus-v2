import { cn } from "@/lib/utils";

/**
 * Campo de texto largo. Los expedientes lo usan mucho: historia de vida,
 * situación familiar, situación económica, amonestaciones.
 */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        // 16px en móvil: por debajo de eso Safari en iOS amplía al enfocar y no
        // deshace el zoom al salir. Ver el mismo apunte en `input.tsx`.
        "border-linea-fuerte placeholder:text-tinta-3 flex field-sizing-content min-h-24 w-full rounded-control border bg-background px-4 py-3 text-base text-tinta transition-[color,box-shadow,border-color] duration-(--duracion-rapida) ease-salida outline-none sm:text-[15px]",
        "focus-visible:border-tinta focus-visible:ring-1 focus-visible:ring-tinta",
        "disabled:cursor-not-allowed disabled:opacity-50",
        // Inválido: el rojo de SEMAFORO en el borde, que es el único sitio de
        // un formulario donde la norma lo admite (docs/09 §2.3). El mensaje
        // que lo explica lo pone quien usa el campo.
        "aria-invalid:border-[#B4342B] aria-invalid:ring-1 aria-invalid:ring-[#B4342B]",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
