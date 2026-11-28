import { ChevronRight, User } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { StatusBadge } from "@/components/app/status-badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Link } from "@/i18n/navigation";
import { claveDeClase, estadoDeUrgencia, type TareaVista } from "@/lib/clases";
import type { ClaseDelEstudiante } from "@/server/estudiantes/clases";

/**
 * La tarjeta de una clase: nombre, docente, avance y lo próximo a entregar.
 *
 * El avance es entregadas sobre evaluables (tareas y exámenes): es lo único que
 * el estudiante controla. «Lo próximo» es la primera pendiente por fecha, y las
 * vencidas van antes que las que aún tienen plazo porque son las que cuestan nota.
 */
export async function TarjetaClase({
  clase,
  tareas,
}: {
  clase: ClaseDelEstudiante;
  tareas: readonly TareaVista[];
}) {
  const t = await getTranslations("studentClasses");

  const evaluables = tareas.filter((x) => x.tipo === "tarea" || x.tipo === "examen");
  const hechas = evaluables.filter((x) => x.grupo === "entregadas").length;
  const porcentaje = evaluables.length > 0 ? Math.round((hechas / evaluables.length) * 100) : 0;

  const proxima = evaluables
    .filter((x) => x.grupo !== "entregadas")
    .sort((a, b) => Number(b.vencida) - Number(a.vencida) || (a.vence ?? "9999").localeCompare(b.vence ?? "9999"))[0];

  return (
    <Card className="transition-shadow hover:shadow-elevada hover:border-linea-fuerte">
      <Link
        href={`/portal/estudiante/clases/${claveDeClase(clase.origen, clase.id)}`}
        className="flex h-full flex-col gap-4 rounded-card p-5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-section line-clamp-2">{clase.nombre}</p>
            {clase.docente && (
              <p className="text-meta mt-1 flex items-center gap-1.5">
                <User aria-hidden className="size-3.5 shrink-0" />
                <span className="truncate">{clase.docente}</span>
              </p>
            )}
          </div>
          <ChevronRight aria-hidden className="mt-1 size-4 shrink-0 text-tinta-3" />
        </div>

        <div className="space-y-1.5">
          <Progress value={porcentaje} aria-label={t("classes.progress")} />
          <p className="text-meta tabular-nums">
            {evaluables.length > 0
              ? t("classes.tasksDone", { hechas, total: evaluables.length })
              : t("classes.noTasks")}
          </p>
        </div>

        {proxima ? (
          <div className="mt-auto flex flex-wrap items-center gap-2">
            <StatusBadge
              status={estadoDeUrgencia(proxima.grupo)}
              label={proxima.vencida ? t("state.overdue") : t("classes.upcoming")}
            />
            <span className="text-meta min-w-0 truncate">
              {proxima.venceTexto
                ? t("classes.nextDue", { titulo: proxima.titulo, fecha: proxima.venceTexto })
                : proxima.titulo}
            </span>
          </div>
        ) : evaluables.length > 0 ? (
          <div className="mt-auto">
            <StatusBadge status="entregado" label={t("classes.allDelivered")} />
          </div>
        ) : null}
      </Link>
    </Card>
  );
}
