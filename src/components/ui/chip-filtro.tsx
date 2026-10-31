import type { LucideIcon } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * Un filtro de la fila de chips: icono arriba, etiqueta abajo, y el elegido
 * subrayado en tinta. Es la barra de categorías de Airbnb.
 *
 * Con `href` es un enlace —el filtro vive en la URL y la página es de
 * servidor—; sin él es un botón, para los filtros que viven en el estado de un
 * componente cliente. `aria-current` marca el activo para lectores de pantalla.
 */
type Props = {
  icono: LucideIcon;
  etiqueta: string;
  activo?: boolean;
  className?: string;
};

const clases = (activo: boolean, className?: string) =>
  cn(
    "group relative flex min-w-14 shrink-0 flex-col items-center gap-1.5 border-b-2 pt-1 pb-2.5 text-xs font-medium transition-colors duration-(--duracion-rapida) outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-t-[6px]",
    /*
     * El subrayado del elegido crece desde el centro (scaleX) al cambiar de
     * filtro; el gris de "pasa el ratón" sigue siendo el borde, que es lo que
     * se ve debajo cuando el subrayado está a cero.
     */
    "after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:rounded-full after:bg-tinta after:transition-transform after:duration-(--duracion-media) after:ease-salida",
    activo
      ? "border-transparent text-tinta after:scale-x-100"
      : "border-transparent text-tinta-2 after:scale-x-0 hover:border-linea-fuerte hover:text-tinta",
    className,
  );

export function ChipFiltro({
  icono: Icono,
  etiqueta,
  activo = false,
  className,
  href,
  ...boton
}: Props &
  (
    | { href: string }
    | ({ href?: undefined } & Omit<React.ComponentProps<"button">, "className">)
  )) {
  const contenido = (
    <>
      <Icono
        className={cn(
          "size-6 transition-[opacity,scale] duration-(--duracion-instante) ease-salida group-active:scale-90",
          activo ? "opacity-100" : "opacity-70 group-hover:opacity-100",
        )}
      />
      <span className="whitespace-nowrap">{etiqueta}</span>
    </>
  );

  if (href !== undefined) {
    return (
      <Link
        href={href}
        aria-current={activo ? "page" : undefined}
        className={clases(activo, className)}
      >
        {contenido}
      </Link>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={activo}
      className={clases(activo, className)}
      {...boton}
    >
      {contenido}
    </button>
  );
}
