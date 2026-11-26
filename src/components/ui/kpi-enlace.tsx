import type { LucideIcon } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { TARJETA } from "@/lib/paleta";

/**
 * Cifra que lleva a su pantalla: es enlace y no `StatCard` porque la cifra es
 * la puerta. Quien ve «Por atender» quiere abrir las solicitudes, no leer el
 * número y buscar el menú.
 */
export function KpiEnlace({
  href,
  icono: Icono,
  etiqueta,
  valor,
  acento = false,
}: {
  href: string;
  icono: LucideIcon;
  etiqueta: string;
  valor: number | string;
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
        <span className="mt-0.5 block text-2xl font-semibold tracking-tight text-tinta tabular-nums">
          {valor}
        </span>
      </span>
    </Link>
  );
}
