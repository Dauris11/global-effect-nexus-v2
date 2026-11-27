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
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <TituloPagina className="text-page">{title}</TituloPagina>
          {subtitle && <p className="text-meta mt-1">{subtitle}</p>}
        </div>
        {(secondaryActions || primaryAction) && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
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
