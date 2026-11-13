import { ArrowRight, CircleCheck } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { TARJETA } from "@/lib/paleta";

export type ClavePendiente =
  | "cxpVencidas"
  | "cxpSemana"
  | "recibosBorrador"
  | "facturasBorrador"
  | "rendiciones"
  | "arqueos"
  | "porConciliar"
  | "sinProcesar"
  | "cajasBajas"
  | "compras";

export type PendienteVisible = {
  clave: ClavePendiente;
  cuantos: number;
  href: string;
  /** Lo vencido pesa más que lo que vence: va en tinta, no en gris. */
  urgente?: boolean;
};

/**
 * Lo que espera a alguien hoy, con su destino.
 *
 * Solo llegan las filas con número: si no queda nada, se dice en una línea en
 * vez de pintar una lista de ceros.
 */
export function ParaHoy({ pendientes }: { pendientes: readonly PendienteVisible[] }) {
  const t = useTranslations("contab.inicio.paraHoy");

  if (pendientes.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-tinta-2">
        <CircleCheck className="size-5 text-tinta-2" />
        {t("alDia")}
      </p>
    );
  }

  return (
    <ul className={TARJETA.contenido}>
      {pendientes.map((pendiente) => (
        <li key={pendiente.clave} className="border-b border-linea last:border-b-0">
          <Link
            href={pendiente.href}
            className="flex min-h-11 items-center gap-3 px-4 py-3 hover:bg-muted/50"
          >
            <span
              className={
                pendiente.urgente
                  ? "flex min-w-9 justify-center rounded-full bg-tinta px-2 py-0.5 text-sm font-semibold text-background"
                  : "flex min-w-9 justify-center rounded-full bg-muted px-2 py-0.5 text-sm font-semibold text-tinta"
              }
            >
              {pendiente.cuantos}
            </span>
            <span className="min-w-0 flex-1 text-tinta">
              {t(pendiente.clave, { count: pendiente.cuantos })}
            </span>
            <ArrowRight className="size-4 shrink-0 text-tinta-3" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
