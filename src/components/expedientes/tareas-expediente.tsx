import { Award, CalendarClock, ClipboardList, UserRound } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Dato, FilaDatos } from "@/components/ui/dato";
import { visualDeEntrega } from "@/lib/estado-entrega";
import { fechaConHora } from "@/lib/fechas";
import { cn } from "@/lib/utils";
import type { AsignacionDelEstudiante } from "@/server/estudiantes/aula";

/**
 * Lo que los docentes le han dejado al estudiante en el aula virtual —sobre
 * todo en sus clases de Global Effect 360— y cómo va con cada cosa.
 *
 * Solo tareas y exámenes: el material y los anuncios no se entregan, así que
 * no dicen nada de cómo va la persona. Lo vencido sin entregar va primero
 * porque es lo único que pide que alguien haga algo.
 */
const MAXIMO = 12;

export async function TareasExpediente({
  asignaciones,
}: {
  asignaciones: AsignacionDelEstudiante[];
}) {
  const t = await getTranslations("records.portada");
  const idioma = (await getLocale()) === "en" ? "en" : "es";

  const evaluables = asignaciones
    .filter((a) => a.tipo === "tarea" || a.tipo === "examen")
    .sort((a, b) => Number(b.vencida) - Number(a.vencida));

  const cuenta = {
    pendientes: evaluables.filter((a) => !a.vencida && a.estado_entrega === "pendiente").length,
    entregadas: evaluables.filter((a) => a.estado_entrega === "entregado" || a.estado_entrega === "tarde").length,
    calificadas: evaluables.filter((a) => a.estado_entrega === "calificado").length,
    vencidas: evaluables.filter((a) => a.vencida).length,
  };

  return (
    <section className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="texto-titulo-seccion">{t("tareasTitulo")}</h2>

        {evaluables.length > 0 && (
          <FilaDatos>
            <span className="texto-meta">{t("resumen", cuenta)}</span>
          </FilaDatos>
        )}
      </div>

      {evaluables.length === 0 ? (
        <p className="rounded-card border border-linea bg-card p-4 text-sm text-tinta-2">
          {t("tareasVacia")}
        </p>
      ) : (
        <ul className="divide-y divide-linea rounded-card border border-linea bg-card shadow-card">
          {evaluables.slice(0, MAXIMO).map((tarea) => {
            const visual = visualDeEntrega(tarea.estado_entrega, tarea.vencida);

            return (
              <li key={tarea.id} className="space-y-2 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="min-w-0 truncate font-semibold">{tarea.titulo}</p>

                  <Badge className={cn("gap-1", visual.clases)}>
                    <visual.icono aria-hidden />
                    {tarea.vencida
                      ? t("vencida")
                      : t(`estadoEntrega.${tarea.estado_entrega ?? "pendiente"}`)}
                  </Badge>
                </div>

                <FilaDatos>
                  <Dato icono={ClipboardList}>
                    {t(`origen.${tarea.origen}`)} · {tarea.materia}
                  </Dato>
                  {tarea.docente_nombre && (
                    <Dato icono={UserRound}>{tarea.docente_nombre}</Dato>
                  )}
                  {tarea.fecha_vencimiento && (
                    <Dato icono={CalendarClock}>
                      {fechaConHora(tarea.fecha_vencimiento, idioma)}
                    </Dato>
                  )}
                  {tarea.calificacion !== null && (
                    <Dato icono={Award}>
                      {t("nota", {
                        nota: tarea.calificacion,
                        maximo: tarea.puntaje_maximo ?? 100,
                      })}
                    </Dato>
                  )}
                </FilaDatos>
              </li>
            );
          })}
        </ul>
      )}

      {evaluables.length > MAXIMO && (
        <p className="texto-meta">{t("masTareas", { n: evaluables.length - MAXIMO })}</p>
      )}
    </section>
  );
}
