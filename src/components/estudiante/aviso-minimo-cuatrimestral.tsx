import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { ALERTA_RIESGO } from "@/lib/paleta";
import { cn } from "@/lib/utils";
import type { CumplimientoCuatrimestral } from "@/server/estudiantes/portal";

/**
 * Muestra el estado del mínimo obligatorio de 2 clases por cuatrimestre.
 * Solo exige el mínimo cuando el estudiante es universitario (`aplica = true`).
 */
export function AvisoMinimoCuatrimestral({
  cumplimiento,
  enlazar = false,
  mostrarCuandoNoAplica = false,
}: {
  cumplimiento: CumplimientoCuatrimestral;
  /** En el inicio del portal enlaza a Prematrícula y Global Effect 360. */
  enlazar?: boolean;
  /** En Global Effect 360 aclara que la obligatoriedad aplica solo a universitarios. */
  mostrarCuandoNoAplica?: boolean;
}) {
  const t = useTranslations("studentPortal.quarterlyRequirement");

  if (!cumplimiento.aplica) {
    if (!mostrarCuandoNoAplica) return null;

    return (
      <div
        role="status"
        className="bg-muted text-tinta-2 flex items-start gap-3 rounded-control p-4 text-sm"
      >
        <Info className="mt-0.5 size-5 shrink-0 text-tinta-3" aria-hidden />
        <div>
          <p className="font-semibold text-tinta">{t("onlyUniversityTitle")}</p>
          <p className="mt-0.5 text-tinta-2">{t("onlyUniversityHint")}</p>
        </div>
      </div>
    );
  }

  const periodo = cumplimiento.periodoNombre ?? t("currentTerm");

  if (cumplimiento.cumplido) {
    return (
      <div
        role="status"
        className="flex items-start gap-3 rounded-control border border-marca-500/30 bg-marca-50 p-4 text-marca-700"
      >
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-marca-600" aria-hidden />
        <div className="min-w-0 flex-1 space-y-0.5 text-sm">
          <p className="font-semibold">
            {t("metTitle", {
              taken: cumplimiento.tomadas,
              min: cumplimiento.minimo,
              term: periodo,
            })}
          </p>
          <p className="opacity-90">
            {t("metDetail", {
              c360: cumplimiento.clases360,
              career: cumplimiento.clasesCarrera,
            })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-control p-4 text-sm",
        ALERTA_RIESGO.contenedor,
      )}
    >
      <AlertCircle className={cn("mt-0.5 size-5 shrink-0", ALERTA_RIESGO.icono)} aria-hidden />
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="font-semibold">
          {t("pendingTitle", {
            taken: cumplimiento.tomadas,
            min: cumplimiento.minimo,
            missing: cumplimiento.faltantes,
            term: periodo,
          })}
        </p>
        <p className="opacity-90">{t("pendingDetail")}</p>
        {enlazar && (
          <div className="flex flex-wrap gap-4 pt-0.5">
            <Link
              href="/portal/estudiante/global-360"
              className="inline-flex min-h-9 items-center font-semibold underline underline-offset-4"
            >
              {t("go360")}
            </Link>
            <Link
              href="/portal/estudiante/prematricula"
              className="inline-flex min-h-9 items-center font-semibold underline underline-offset-4"
            >
              {t("goEnrollment")}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
