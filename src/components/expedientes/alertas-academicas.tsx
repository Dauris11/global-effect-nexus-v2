import { AlertCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { ALERTA_RIESGO } from "@/lib/paleta";
import type { AlertaAcademica } from "@/server/academico/indice";

/**
 * Las alertas académicas del expediente. Se derivan de las calificaciones al
 * mirarlo —no hay avisos guardados que se queden viejos—: al entrar una nota la
 * alerta aparece o desaparece. Con icono y texto, no con color de alarma.
 */
export async function AlertasAcademicas({ alertas }: { alertas: AlertaAcademica[] }) {
  const t = await getTranslations("catalog.alerts");

  if (alertas.length === 0) return null;

  return (
    <ul className="space-y-2" aria-label={t("title")}>
      {alertas.map((a) => (
        <li key={a.tipo} className={ALERTA_RIESGO.contenedor}>
          <AlertCircle className={ALERTA_RIESGO.icono} />
          <span className={ALERTA_RIESGO.texto}>
            {a.tipo === "indice_bajo" && t("lowIndex", { index: a.indice.toFixed(2), min: a.umbral.toFixed(2) })}
            {a.tipo === "indice_periodo_bajo" && t("lowPeriodIndex", { period: a.periodo, index: a.indice.toFixed(2), min: a.umbral.toFixed(2) })}
            {a.tipo === "reprobadas" && t("failed", { count: a.materias.length, subjects: a.materias.join(", ") })}
            {a.tipo === "retiradas" && t("withdrawn", { count: a.materias.length, subjects: a.materias.join(", ") })}
          </span>
        </li>
      ))}
    </ul>
  );
}
