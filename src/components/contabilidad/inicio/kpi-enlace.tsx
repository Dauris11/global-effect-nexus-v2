import type { LucideIcon } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { TARJETA } from "@/lib/paleta";

/**
 * Cifra del tablero que lleva a su módulo. Es enlace y no `StatCard` porque
 * la cifra es la puerta: quien ve "Por pagar" quiere abrir las cuentas por
 * pagar, no leer el número y buscar el menú.
 */
export function KpiEnlace({
  href,
  icono: Icono,
  etiqueta,
  valor,
  detalle,
  acento = false,
}: {
  href: string;
  icono: LucideIcon;
  etiqueta: string;
  valor: string;
  detalle?: string;
  acento?: boolean;
}) {
  return (
    <Link href={href} className={`${TARJETA.interactiva} flex min-h-11 flex-col gap-3 p-5`}>
      <span
        className={`flex size-10 items-center justify-center rounded-control ${
          acento ? "bg-marca-50 text-marca-600" : "bg-muted text-tinta"
        }`}
      >
        <Icono className="size-5" />
      </span>
      <span>
        <span className="texto-meta block">{etiqueta}</span>
        <span className="mt-0.5 block truncate text-2xl font-semibold tracking-tight text-tinta">
          {valor}
        </span>
        {detalle && <span className="texto-meta mt-0.5 block truncate">{detalle}</span>}
      </span>
    </Link>
  );
}
