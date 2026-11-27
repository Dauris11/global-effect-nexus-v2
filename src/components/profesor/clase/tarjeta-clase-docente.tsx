import { CalendarClock, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { StatusBadge } from "@/components/app/status-badge";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { claveDeClase } from "@/lib/clases";
import { fechaCorta } from "@/lib/fechas";
import type { ClaseDelDocente } from "@/server/profesor/clases";

/**
 * Tarjeta de una clase del docente: cuántos estudiantes, cuántas entregas
 * esperan nota (el aviso `warning`, que es lo que pide acción) y cuándo es la
 * próxima sesión. Sin KPIs: son tres datos de una sola clase.
 */
export async function TarjetaClaseDocente({ clase, idioma }: { clase: ClaseDelDocente; idioma: "es" | "en" }) {
  const t = await getTranslations("teacherClasses");

  return (
    <Card className="transition-shadow hover:shadow-elevada">
      <Link
        href={`/portal/profesor/clases/${claveDeClase(clase.origen, clase.id)}`}
        className="flex h-full flex-col gap-3 rounded-card p-5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <div className="min-w-0">
          <p className="text-section line-clamp-2">{clase.nombre}</p>
          <p className="text-meta mt-1 truncate">
            {[clase.origen === "g360" ? t("cards.program360") : t("cards.degree"), clase.periodo].filter(Boolean).join(" · ")}
          </p>
        </div>
        <p className="text-body flex items-center gap-2">
          <Users aria-hidden className="size-4 text-tinta-2" />
          {t("cards.students", { n: clase.estudiantes })}
        </p>
        <p className="text-body flex items-center gap-2">
          <CalendarClock aria-hidden className="size-4 text-tinta-2" />
          {clase.proxima_sesion ? t("cards.nextSession", { fecha: fechaCorta(clase.proxima_sesion, idioma) }) : t("cards.noSession")}
        </p>
        <div className="mt-auto">
          {clase.sin_calificar > 0 ? (
            <StatusBadge status="pendiente" label={t("cards.toGrade", { n: clase.sin_calificar })} />
          ) : (
            <StatusBadge status="completado" label={t("cards.upToDate")} />
          )}
        </div>
      </Link>
    </Card>
  );
}
