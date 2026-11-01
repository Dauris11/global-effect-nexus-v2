import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";

import { Card, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";

/**
 * Tarjeta de un bloque de la bandeja: título con icono y, si hay adónde ir,
 * "Ver todo". Es la misma forma para todos los bloques para que la pantalla se
 * lea como una sola lista de cosas por atender y no como seis paneles distintos.
 */
export function TarjetaBandeja({
  icono: Icono,
  titulo,
  verTodo,
  acciones,
  children,
}: {
  icono: LucideIcon;
  titulo: string;
  verTodo?: { href: string; etiqueta: string };
  /** Algo propio del bloque junto al título (p. ej. "marcar todas"). */
  acciones?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5 md:p-6">
      <div className="mb-2 flex min-h-11 items-center justify-between gap-2">
        <CardTitle>
          <Icono className="size-4" />
          {titulo}
        </CardTitle>

        {acciones}

        {verTodo && (
          <Link
            href={verTodo.href}
            className="-mr-2 inline-flex h-11 shrink-0 items-center gap-1 rounded-control px-2 text-sm font-semibold text-marca-600 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {verTodo.etiqueta}
            <ArrowRight className="size-4" />
          </Link>
        )}
      </div>

      {children}
    </Card>
  );
}
