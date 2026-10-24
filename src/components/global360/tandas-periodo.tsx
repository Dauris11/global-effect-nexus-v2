import { CircleDashed, GraduationCap, Info } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type {
  TandaDelEstudiante,
  Ventana,
} from "@/server/global360/consultas";

/**
 * Las dos tandas del período del estudiante y, si toca, el aviso de que le
 * falta elegir.
 *
 * El programa es obligatorio y se cursa una materia por tanda: una tanda vacía
 * con la ventana abierta es algo que el estudiante TIENE que resolver, así que
 * el aviso va arriba y en el azul de los avisos, no escondido en la lista.
 *
 * Vive en `global360/` y no en la página porque sale en dos sitios: la página
 * de 360, donde se elige, y la prematrícula, que solo avisa y enlaza.
 */
export function TandasPeriodo360({
  ventana,
  tandas,
  enlazar = false,
}: {
  ventana: Ventana;
  tandas: readonly TandaDelEstudiante[];
  /** Fuera de la página de 360, el aviso lleva un enlace para ir a elegir. */
  enlazar?: boolean;
}) {
  const t = useTranslations("global360");

  const pendiente =
    ventana.abierta && !tandas.some((tanda) => tanda.ronda === ventana.ronda);

  return (
    <section className="space-y-4">
      {pendiente && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-control bg-marca-50 p-4 text-marca-700"
        >
          <Info className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-semibold">
              {t("tandaPending", { n: ventana.ronda })}
            </p>
            <p className="text-sm">{t("tandaRule")}</p>
            {enlazar && (
              <Link
                href="/portal/estudiante/global-360"
                className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4"
              >
                {t("tandaChooseNow")}
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="space-y-1">
        <h2 className="texto-titulo-seccion">
          {t("tandasTitle", { periodo: ventana.periodo })}
        </h2>
        <p className="texto-meta">{t("tandaRule")}</p>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2">
        {([1, 2] as const).map((ronda) => {
          const elegida = tandas.find((tanda) => tanda.ronda === ronda);
          const abiertaAhora = ventana.abierta && ventana.ronda === ronda;

          return (
            <li
              key={ronda}
              className={cn(
                "flex items-start gap-3 rounded-card border p-4 shadow-card",
                abiertaAhora ? "border-marca-500" : "border-linea",
              )}
            >
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-full bg-muted",
                  elegida ? "text-marca-600" : "text-tinta-3",
                )}
              >
                {elegida ? (
                  <GraduationCap className="size-5" aria-hidden />
                ) : (
                  <CircleDashed className="size-5" aria-hidden />
                )}
              </span>

              <div className="min-w-0">
                <p className="texto-meta font-medium">
                  {t(ronda === 1 ? "tanda1" : "tanda2")}
                  {abiertaAhora && ` · ${t("tandaOpenNow")}`}
                </p>
                <p className="texto-titulo-tarjeta truncate">
                  {elegida ? elegida.materia : t("tandaEmpty")}
                </p>
                {elegida && (
                  <p className="text-sm text-tinta-2">
                    {t(`situation.${situacionConocida(elegida.estado)}`)}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const SITUACIONES = [
  "aprobada",
  "cursando",
  "prematriculada",
  "reprobada",
  "pendiente",
] as const;

/** Un estado inesperado se dibuja como pendiente en vez de imprimir la clave. */
function situacionConocida(estado: string): (typeof SITUACIONES)[number] {
  return SITUACIONES.includes(estado as (typeof SITUACIONES)[number])
    ? (estado as (typeof SITUACIONES)[number])
    : "pendiente";
}
