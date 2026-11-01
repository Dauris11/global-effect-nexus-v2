import { CalendarClock, FolderKanban, ListTodo } from "lucide-react";
import { useTranslations } from "next-intl";

import { TarjetaBandeja } from "@/components/bandeja/tarjeta-bandeja";
import { Badge } from "@/components/ui/badge";
import { Dato, FilaDatos } from "@/components/ui/dato";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import type { Locale } from "@/i18n/routing";
import { fechaCorta } from "@/lib/fechas";
import { PRIORIDAD } from "@/lib/paleta";
import type { TareaTorre } from "@/lib/torre-control";
import { cn } from "@/lib/utils";

const MAXIMO = 8;

/**
 * Las tareas abiertas de la persona, por vencimiento.
 *
 * `tareasDeUsuario` ya las trae con las vencidas primero y luego por fecha
 * límite, así que aquí solo se quitan las cerradas. La vencida se destaca con
 * tinta (borde y etiqueta) y no con rojo: el rojo es del semáforo y solo se
 * usa para el estado de una entidad.
 */
export function TareasBandeja({
  tareas,
  idioma,
}: {
  tareas: readonly TareaTorre[];
  idioma: Locale;
}) {
  const t = useTranslations("bandeja");
  const tPrioridad = useTranslations("torre.priority");

  const abiertas = tareas.filter((tarea) => tarea.estado !== "completada");

  return (
    <TarjetaBandeja
      icono={ListTodo}
      titulo={t("tasks.title")}
      verTodo={{ href: "/administrativo/tareas", etiqueta: t("seeAll") }}
    >
      {abiertas.length === 0 ? (
        <EstadoVacio icono={ListTodo} titulo={t("tasks.empty")} />
      ) : (
        <ul>
          {abiertas.slice(0, MAXIMO).map((tarea) => (
            <li
              key={tarea.id}
              className={cn(
                "-mx-2 flex items-start gap-3 border-b border-linea px-2 py-3 last:border-b-0",
                tarea.vencida && "border-l-2 border-l-tinta bg-muted/40",
              )}
            >
              <span
                aria-hidden
                className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", PRIORIDAD[tarea.prioridad].punto)}
              />

              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate text-sm font-semibold text-tinta">{tarea.titulo}</p>
                <FilaDatos>
                  <Dato icono={CalendarClock}>
                    {tarea.fecha_limite ? fechaCorta(tarea.fecha_limite, idioma) : t("tasks.noDate")}
                  </Dato>
                  <Dato icono={FolderKanban}>{tarea.proyecto_nombre ?? t("tasks.noProject")}</Dato>
                </FilaDatos>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1">
                {tarea.vencida && (
                  <Badge className="bg-tinta text-background">{t("tasks.overdue")}</Badge>
                )}
                <Badge className={PRIORIDAD[tarea.prioridad].clases}>
                  {tPrioridad(tarea.prioridad)}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </TarjetaBandeja>
  );
}
