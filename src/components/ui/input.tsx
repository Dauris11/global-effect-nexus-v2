import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // 16px en móvil y 14px a partir de `sm`. Safari en iOS hace zoom al
        // enfocar cualquier campo de menos de 16px, y al salir NO vuelve atrás:
        // el usuario se queda con la página ampliada y desplazada. Los 14px del
        // diseño se conservan desde tablet para arriba, que es donde no pasa.
        "border-linea-fuerte file:text-foreground placeholder:text-tinta-3 flex h-[38px] pointer-coarse:h-11 w-full min-w-0 rounded-control border bg-background px-4 py-2 text-base text-tinta transition-[color,box-shadow,border-color] duration-(--duracion-rapida) ease-salida outline-none sm:text-[15px]",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        // Foco: borde brand-500 y halo de 3 px brand-100 (referencia visual).
        "focus-visible:border-marca-500 focus-visible:ring-[3px] focus-visible:ring-marca-100",
        "disabled:cursor-not-allowed disabled:opacity-50",
        // Inválido: el rojo de SEMAFORO en el borde, que es el único sitio de
        // un formulario donde la norma lo admite (docs/09 §2.3). El mensaje
        // que lo explica lo pone quien usa el campo.
        "aria-invalid:border-status-danger aria-invalid:ring-[3px] aria-invalid:ring-status-danger-border",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
