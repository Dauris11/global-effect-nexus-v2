import { CalendarCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Progress } from "@/components/ui/progress";
import type { TareaVista } from "@/lib/clases";
import { fechaLarga } from "@/lib/fechas";
import type { SesionDeAsistencia } from "@/server/estudiantes/clases";

/** Pestaña «Calificaciones» de una clase: lo calificado, con la nota y lo que dijo el docente. */
export async function PestanaCalificaciones({ tareas }: { tareas: readonly TareaVista[] }) {
  const t = await getTranslations("studentClasses");
  const calificadas = tareas.filter((x) => x.estado === "calificado" && x.calificacion !== null);

  if (calificadas.length === 0) {
    return <EmptyState readOnly icon={CalendarCheck} title={t("grades.emptyTitle")} description={t("grades.emptyHint")} />;
  }

  const obtenido = calificadas.reduce((n, x) => n + (x.calificacion ?? 0), 0);
  const posible = calificadas.reduce((n, x) => n + x.puntaje, 0);
  const porcentaje = posible > 0 ? Math.round((obtenido / posible) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-card border border-linea p-4">
        <p className="text-body tabular-nums">
          {t("grades.total", { obtenido: Number(obtenido.toFixed(1)), posible: Number(posible.toFixed(1)), porcentaje })}
        </p>
        <Progress value={porcentaje} aria-label={t("grades.progress")} />
      </div>
      <ul className="divide-y divide-linea overflow-hidden rounded-card border border-linea bg-card">
        {calificadas.map((x) => (
          <li key={x.id} className="space-y-1 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-body min-w-0 truncate font-medium">{x.titulo}</p>
              <span className="flex shrink-0 items-center gap-2">
                <span className="text-label tabular-nums">
                  {x.calificacion}/{x.puntaje}
                </span>
                <StatusBadge status="calificado" />
              </span>
            </div>
            {x.comentarioProfesor && <p className="text-meta whitespace-pre-line">{x.comentarioProfesor}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Pestaña «Asistencia»: presentes sobre las sesiones ya marcadas, y cada sesión. */
export async function PestanaAsistencia({
  sesiones,
  idioma,
}: {
  sesiones: readonly SesionDeAsistencia[];
  idioma: "es" | "en";
}) {
  const t = await getTranslations("studentClasses");

  if (sesiones.length === 0) {
    return (
      <EmptyState readOnly icon={CalendarCheck} title={t("attendance.emptyTitle")} description={t("attendance.emptyHint")} />
    );
  }

  const marcadas = sesiones.filter((s) => s.presente !== null);
  const presentes = marcadas.filter((s) => s.presente).length;
  const porcentaje = marcadas.length > 0 ? Math.round((presentes / marcadas.length) * 100) : null;

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-card border border-linea p-4">
        <p className="text-body tabular-nums">
          {porcentaje === null
            ? t("attendance.noneMarked")
            : t("attendance.summary", { presentes, marcadas: marcadas.length, porcentaje })}
        </p>
        {porcentaje !== null && <Progress value={porcentaje} aria-label={t("attendance.progress")} />}
      </div>
      <ul className="divide-y divide-linea overflow-hidden rounded-card border border-linea bg-card">
        {sesiones.map((s) => (
          <li key={s.fecha} className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="text-body">{fechaLarga(s.fecha, idioma)}</span>
            {s.presente === null ? (
              <StatusBadge status="borrador" label={t("attendance.unmarked")} />
            ) : s.presente ? (
              <StatusBadge status="completado" label={t("attendance.present")} />
            ) : (
              <StatusBadge status="rechazada" label={t("attendance.absent")} />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
