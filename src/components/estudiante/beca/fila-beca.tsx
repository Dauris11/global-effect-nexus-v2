import type { LucideIcon } from "lucide-react";

import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";

/**
 * Un renglón de «Mi beca»: qué es, cómo va (con su `StatusBadge`) y la acción
 * para completarlo. La acción es un enlace secundario: la página no tiene un
 * botón primario, porque cada renglón pide lo suyo.
 */
export function FilaBeca({
  icono: Icono,
  titulo,
  detalle,
  estado,
  etiquetaEstado,
  accion,
  href,
}: {
  icono: LucideIcon;
  titulo: string;
  detalle?: string;
  estado: string;
  etiquetaEstado: string;
  accion?: string;
  href?: string;
}) {
  return (
    <Card className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4 sm:p-5">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-tinta-2">
        <Icono aria-hidden className="size-5" />
      </span>
      <div className="min-w-0 flex-1 basis-48 space-y-0.5">
        <p className="text-body font-semibold">{titulo}</p>
        {detalle && <p className="text-meta">{detalle}</p>}
      </div>
      <StatusBadge status={estado} label={etiquetaEstado} />
      {accion && href && (
        <Button asChild variant="secondary" size="sm">
          <Link href={href}>{accion}</Link>
        </Button>
      )}
    </Card>
  );
}
