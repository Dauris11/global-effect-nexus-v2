import type { LucideIcon } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const BASE =
  "group flex w-full items-center gap-3 rounded-card border border-linea bg-card p-4 text-left shadow-card transition-[box-shadow,border-color] duration-(--duracion-rapida) hover:border-linea-fuerte hover:shadow-elevada focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

/**
 * Tarjeta de acción rápida para los inicios («Registrar visita», «Subir calificaciones»).
 * Con `href` es un enlace; con `onClick`, un botón. El icono va en tinta (el turquesa
 * queda para lo activo y el CTA).
 */
export function ActionTile({
  icon: Icono,
  title,
  hint,
  className,
  ...destino
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  className?: string;
} & ({ href: string; onClick?: undefined } | { onClick: () => void; href?: undefined })) {
  const contenido = (
    <>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-muted text-tinta">
        <Icono aria-hidden className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-tinta">{title}</span>
        {hint && <span className="text-meta block truncate">{hint}</span>}
      </span>
    </>
  );

  return destino.href !== undefined ? (
    <Link href={destino.href} className={cn(BASE, className)}>
      {contenido}
    </Link>
  ) : (
    <button type="button" onClick={destino.onClick} className={cn(BASE, className)}>
      {contenido}
    </button>
  );
}
