import { ListTodo } from "lucide-react";
import { useTranslations } from "next-intl";

import { TarjetaBandeja } from "@/components/bandeja/tarjeta-bandeja";
import { TareasBandejaInteractiva } from "@/components/bandeja/tareas-bandeja-interactiva";
import type { Locale } from "@/i18n/routing";
import type { TareaTorre } from "@/lib/torre-control";

/**
 * Las tareas abiertas de la persona, por vencimiento.
 *
 * `tareasDeUsuario` ya las trae con las vencidas primero y luego por fecha
 * límite. El wrapper lee las traducciones en servidor y pasa el contenido a
 * `TareasBandejaInteractiva` para filtrar por urgencia/vencimiento o
 * completar tareas sin salir de la bandeja.
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

  return (
    <TarjetaBandeja
      icono={ListTodo}
      titulo={t("tasks.title")}
      verTodo={{ href: "/bandeja?tab=tareas&vista=tablero", etiqueta: t("seeAll") }}
    >
      <TareasBandejaInteractiva
        tareasIniciales={tareas}
        idioma={idioma}
        etiquetas={{
          vacio: t("tasks.empty"),
          vacioFiltro: t("tasks.emptyFiltered"),
          vencida: t("tasks.overdue"),
          sinFecha: t("tasks.noDate"),
          sinProyecto: t("tasks.noProject"),
          todas: t("tasks.filterAll"),
          vencidas: t("tasks.filterOverdue"),
          urgentes: t("tasks.filterUrgent"),
          completar: t("tasks.markDone"),
          error: t("tasks.updateError"),
          prioridades: {
            baja: tPrioridad("baja"),
            media: tPrioridad("media"),
            alta: tPrioridad("alta"),
            urgente: tPrioridad("urgente"),
          },
        }}
      />
    </TarjetaBandeja>
  );
}
