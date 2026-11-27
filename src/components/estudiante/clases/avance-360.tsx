import { GraduationCap } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { AvanceEn360 } from "@/server/global360/consultas";

/**
 * Cuánto lleva del programa Global Effect 360 (aprobadas sobre el catálogo
 * activo, todo obligatorio). Vive arriba de «Mis clases» y no en una página
 * aparte: es el mismo estudiante mirando su avance, no un módulo.
 */
export async function Avance360({ avance }: { avance: AvanceEn360 }) {
  const t = await getTranslations("studentClasses");

  if (avance.total === 0) return null;
  const porcentaje = Math.round((avance.dadas / avance.total) * 100);

  return (
    <Card className="flex items-center gap-4 p-5">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-marca-50 text-marca-600">
        <GraduationCap aria-hidden className="size-6" />
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-section">{t("program.title")}</p>
        <Progress value={porcentaje} aria-label={t("program.progress")} />
        <p className="text-body tabular-nums">
          {t("program.summary", { dadas: avance.dadas, total: avance.total })}
        </p>
      </div>
    </Card>
  );
}
