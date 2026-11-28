import { ChevronRight } from "lucide-react";

import { MigasDeDetalle, PestanasModulo, TituloPagina } from "@/components/layout/pestanas-modulo";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export type MigaPan = { etiqueta: string; href?: string };

/**
 * Encabezado único de página (docs/ux-rules.md §10): título, subtítulo opcional y la
 * acción. Sin eyebrow encima del título. El `breadcrumb` es solo para el 2.º nivel
 * (una ficha de detalle); en páginas de primer nivel no se pasa.
 *
 * `primaryAction` es UNA: el único botón primario de la página, arriba a la derecha y
 * con verbo + objeto. Lo demás va en `secondaryActions` o en `MenuMasAcciones` (⋯).
 */
export function PageHeader({
  title,
  subtitle,
  primaryAction,
  secondaryActions,
  breadcrumb,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  primaryAction?: React.ReactNode;
  secondaryActions?: React.ReactNode;
  breadcrumb?: readonly MigaPan[];
  className?: string;
}) {
  return (
    <div className="space-y-4">
    <header className={cn("space-y-2", className)}>
      {!breadcrumb?.length && <MigasDeDetalle />}
      {breadcrumb && breadcrumb.length > 0 && (
        <nav aria-label="breadcrumb" className="text-meta flex flex-wrap items-center gap-1">
          {breadcrumb.map((m, i) => (
            <span key={`${m.etiqueta}-${i}`} className="flex items-center gap-1">
              {i > 0 && <ChevronRight aria-hidden className="size-3.5" />}
              {m.href ? (
                <Link href={m.href} className="hover:text-tinta hover:underline">
                  {m.etiqueta}
                </Link>
              ) : (
                <span aria-current="page">{m.etiqueta}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      {/* items-end: el botón primario queda sobre la línea base del h1 y no centrado con el subtítulo.
          En móvil también va en fila (envuelve solo si no cabe) y el botón se compacta en vez de ocupar
          una fila propia. */}
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-3">
        <div className="min-w-0 flex-1 basis-40">
          <TituloPagina className="text-page">{title}</TituloPagina>
          {subtitle && <p className="text-meta mt-1">{subtitle}</p>}
        </div>
        {(secondaryActions || primaryAction) && (
          <div className="flex shrink-0 items-center gap-2 max-sm:[&_[data-slot=button]]:px-3 max-sm:[&_[data-slot=button]]:text-[13px]">
            {secondaryActions}
            {primaryAction}
          </div>
        )}
      </div>
    </header>
    <PestanasModulo />
    </div>
  );
}
