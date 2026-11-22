import { ClipboardCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Progress } from "@/components/ui/progress";
import { Link } from "@/i18n/navigation";
import { completitudFicha } from "@/lib/ficha-completa";
import type { ExpedienteCompleto } from "@/server/expedientes/consultas";

/**
 * «Ficha completa al 64 %»: lo que falta llenar de un expediente, dicho por sección y con
 * un enlace directo a editarlo. Existe para el registro rápido: se da de alta con lo básico
 * y aquí se ve qué queda pendiente. Con la ficha al 100 % no se muestra.
 */
export async function FichaCompleta({ e, puedeEditar }: { e: ExpedienteCompleto; puedeEditar: boolean }) {
  const t = await getTranslations("records");
  const { porcentaje, incompletas } = completitudFicha({
    ...e,
    familiares_con_nombre: Object.values(e.familiares).filter((f) => f?.nombre?.trim()).length,
  });

  if (incompletas.length === 0) return null;

  return (
    <section className="no-imprimir rounded-card border border-linea bg-card p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <ClipboardCheck className="size-4 text-marca-500" />
          {t("complete.title", { percent: porcentaje })}
        </p>
        {puedeEditar && (
          <Link href={`/expedientes/${e.id}?editar=1`} className="text-sm font-medium text-marca-700 hover:underline">
            {t("complete.fill")}
          </Link>
        )}
      </div>
      <Progress value={porcentaje} className="mt-3" />
      <p className="texto-meta mt-2">{t("complete.missing", { sections: incompletas.map((s) => t(`tab.${s}`)).join(", ") })}</p>
    </section>
  );
}
