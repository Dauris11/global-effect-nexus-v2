import { CheckCircle2, HeartHandshake, XCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { FILA, Seccion } from "@/components/estudiante/seccion";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import type { CondicionMes } from "@/server/estudiantes/portal";

/**
 * Servicio mensual y reuniones de los últimos meses.
 *
 * Lo cumplido va en el azul de texto y lo que falta en tinta, con su icono:
 * lo que falta es lo que el estudiante tiene que mirar, así que es lo que más
 * pesa. Nunca verde y rojo (docs/09-sistema-visual.md §1.4).
 */
export async function CondicionFundacion({
  condicion,
}: {
  condicion: readonly CondicionMes[];
}) {
  const t = await getTranslations("studentPortal");

  return (
    <Seccion titulo={t("standingTitle")}>
      {condicion.length === 0 ? (
        <EstadoVacio icono={HeartHandshake} titulo={t("standingEmpty")} />
      ) : (
        <div>
          <p className="text-sm text-tinta-2">
            {t("standingSummary", {
              services: condicion.filter((mes) => mes.hizo_servicio).length,
              months: condicion.length,
              meetings: condicion.filter((mes) => mes.asistio_reunion).length,
            })}
          </p>

          <ul className="mt-2">
            {condicion.map((mes) => (
              <li key={mes.mes} className={FILA}>
                <span className="w-20 shrink-0 text-sm font-semibold">
                  {mes.mes}
                </span>

                <div className="flex min-w-0 flex-1 flex-wrap gap-x-4 gap-y-1">
                  <Marca
                    cumplido={mes.hizo_servicio}
                    etiqueta={mes.hizo_servicio ? t("service") : t("noService")}
                  />
                  <Marca
                    cumplido={mes.asistio_reunion}
                    etiqueta={
                      mes.asistio_reunion ? t("meeting") : t("noMeeting")
                    }
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Seccion>
  );
}

function Marca({
  cumplido,
  etiqueta,
}: {
  cumplido: boolean;
  etiqueta: string;
}) {
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-sm">
      {cumplido ? (
        <CheckCircle2 className="size-4 shrink-0 text-marca-600" />
      ) : (
        <XCircle className="size-4 shrink-0 text-tinta" />
      )}
      <span className={cumplido ? "text-tinta-2" : "font-medium text-tinta"}>
        {etiqueta}
      </span>
    </span>
  );
}
