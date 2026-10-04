import type { LucideIcon } from "lucide-react";
import { ArrowRight, CalendarDays, FolderKanban, ListTodo } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { fechaCorta } from "@/lib/fechas";
import { clasesDeEstado, esPrioridad, PRIORIDAD, TARJETA } from "@/lib/paleta";
import { cn } from "@/lib/utils";
import type {
  EventoPanel,
  ProyectoPanel,
  TareaPanel,
} from "@/server/dashboard/consultas";

/**
 * Las tres listas del panel: tareas, proyectos y eventos.
 *
 * Comparten una forma —tarjeta con título y "ver todo", filas separadas por
 * una línea fina `linea` y `EstadoVacio` cuando no hay nada— y por eso viven
 * juntas: antes cada fila era una caja gris redondeada dentro de la tarjeta,
 * y las cajas dentro de cajas eran justo lo que la norma quita (docs/09 §1.3).
 *
 * Cada tarea trae quién la tiene y de dónde sale —su proyecto, o el evento que
 * generó—. Una lista de títulos sin dueño no sirve para decidir nada.
 */

/** Tarjeta de lista: título con icono y, si hay adónde ir, "Ver todo". */
function TarjetaLista({
  icono: Icono,
  titulo,
  verTodo,
  children,
}: {
  icono: LucideIcon;
  titulo: string;
  verTodo?: { href: string; etiqueta: string };
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5 md:p-6">
      <div className="mb-2 flex min-h-11 items-center justify-between gap-2">
        <CardTitle>
          <Icono className="size-4" />
          {titulo}
        </CardTitle>

        {verTodo && (
          <Link
            href={verTodo.href}
            className="-mr-2 inline-flex h-11 shrink-0 items-center gap-1 rounded-control px-2 text-sm font-semibold text-marca-600 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {verTodo.etiqueta}
            <ArrowRight className="size-4" />
          </Link>
        )}
      </div>

      {children}
    </Card>
  );
}

export function ListaTareas({
  tareas,
  idioma,
}: {
  tareas: readonly TareaPanel[];
  idioma: Locale;
}) {
  const t = useTranslations("dashboard");

  return (
    <TarjetaLista
      icono={ListTodo}
      titulo={t("tasksTitle")}
      verTodo={{ href: "/administrativo/tareas", etiqueta: t("seeAll") }}
    >
      {tareas.length === 0 ? (
        <EstadoVacio icono={ListTodo} titulo={t("tasksEmpty")} />
      ) : (
        <ul>
          {tareas.map((tarea) => {
            const prioridad = esPrioridad(tarea.prioridad) ? tarea.prioridad : "baja";

            return (
              <li key={tarea.id} className={cn(TARJETA.fila, "-mx-2 px-2")}>
                <span
                  aria-hidden
                  className={cn(
                    "mt-1.5 size-2.5 shrink-0 rounded-full",
                    PRIORIDAD[prioridad].punto,
                  )}
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-tinta">
                    {tarea.titulo}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-tinta-2">
                    {tarea.proyecto ?? tarea.evento ?? t("taskNoProject")}
                    {" · "}
                    {tarea.responsables ?? t("taskOwnerless")}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge className={PRIORIDAD[prioridad].clases}>
                    {t(`priority.${prioridad}`)}
                  </Badge>
                  {tarea.fecha_limite && (
                    <span className="texto-meta">
                      {fechaCorta(tarea.fecha_limite, idioma)}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </TarjetaLista>
  );
}

export function ListaProyectos({
  proyectos,
}: {
  proyectos: readonly ProyectoPanel[];
}) {
  const t = useTranslations("dashboard");

  return (
    <TarjetaLista
      icono={FolderKanban}
      titulo={t("projectsTitle")}
      verTodo={{ href: "/administrativo/proyectos", etiqueta: t("seeAll") }}
    >
      {proyectos.length === 0 ? (
        <EstadoVacio icono={FolderKanban} titulo={t("projectsEmpty")} />
      ) : (
        <ul>
          {proyectos.map((proyecto) => (
            <li
              key={proyecto.id}
              className={cn(TARJETA.fila, "-mx-2 items-center px-2")}
            >
              <span className={TARJETA.iconoPequeno}>
                <FolderKanban className="size-4" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-tinta">
                  {proyecto.nombre}
                </p>
                <p className="mt-0.5 truncate text-sm text-tinta-2">
                  {proyecto.responsable ?? t("taskOwnerless")}
                  {" · "}
                  {t("openTasksOf", {
                    abiertas: proyecto.abiertas,
                    total: proyecto.total,
                  })}
                </p>
              </div>

              {/* Las abiertas, con el peso del estado del proyecto: en marcha
                  en azul suave, en planificación en gris. */}
              <Badge className={cn("tabular-nums", clasesDeEstado(proyecto.estado))}>
                {proyecto.abiertas}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </TarjetaLista>
  );
}

export function ListaEventos({
  eventos,
  idioma,
}: {
  eventos: readonly EventoPanel[];
  idioma: Locale;
}) {
  const t = useTranslations("dashboard");

  return (
    <TarjetaLista icono={CalendarDays} titulo={t("eventsTitle")}>
      {eventos.length === 0 ? (
        <EstadoVacio icono={CalendarDays} titulo={t("eventsEmpty")} />
      ) : (
        <ul>
          {eventos.map((evento) => (
            <li
              key={evento.id}
              className={cn(TARJETA.fila, "-mx-2 items-center px-2")}
            >
              <span className={TARJETA.iconoPequeno}>
                <CalendarDays className="size-4" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-tinta">
                  {evento.titulo}
                </p>
                <p className="mt-0.5 truncate text-sm text-tinta-2">
                  {fechaCorta(evento.fecha, idioma)}
                  {evento.hora_inicio ? ` · ${evento.hora_inicio.slice(0, 5)}` : ""}
                  {evento.ubicacion ? ` · ${evento.ubicacion}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </TarjetaLista>
  );
}
