"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DatesSetArg, EventDropArg } from "@fullcalendar/core";
import esLocale from "@fullcalendar/core/locales/es";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Grid3x3,
  List,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  ORIGEN_VISUAL,
  type EventoCalendario,
  type OrigenCalendario,
  type VistaCalendario,
} from "@/lib/calendario";
import { cn } from "@/lib/utils";

import type { PropiedadesCalendarioBase } from "./calendario-base";

/**
 * Núcleo de `CalendarioBase`. Va aparte para que FullCalendar (unos 200 KB con
 * sus plugins) se cargue solo en las pantallas que dibujan un calendario.
 */

const VISTA_FC: Record<VistaCalendario, string> = {
  mes: "dayGridMonth",
  semana: "timeGridWeek",
  dia: "timeGridDay",
  lista: "listMonth",
};

const VISTA_DESDE_FC: Record<string, VistaCalendario> = {
  dayGridMonth: "mes",
  timeGridWeek: "semana",
  timeGridDay: "dia",
  listMonth: "lista",
};

const ICONO_VISTA = {
  mes: CalendarDays,
  semana: Grid3x3,
  dia: Clock,
  lista: List,
} as const;

/** Por debajo de este ancho no cabe una rejilla legible: se arranca en lista. */
const ANCHO_MOVIL = 640;

export default function CalendarioBaseInterno({
  eventos,
  hoy,
  fechaInicial,
  vistaInicial,
  compacto = false,
  etiquetaOrigen,
  onAbrir,
  onDiaClick,
  onMover,
  onCambioRango,
  acciones,
  className,
}: PropiedadesCalendarioBase) {
  const t = useTranslations("calendar");
  const idioma = useLocale();
  const api = useRef<FullCalendar>(null);

  const [titulo, setTitulo] = useState("");
  const [vista, setVista] = useState<VistaCalendario>(vistaInicial ?? "mes");

  const entradas = useMemo(
    () =>
      eventos.map((evento) => {
        const horaFin = evento.horaFin?.slice(0, 5);
        const hora = evento.hora?.slice(0, 5);

        return {
          id: evento.clave,
          title: evento.titulo,
          start: hora ? `${evento.dia}T${hora}:00` : evento.dia,
          end: hora && horaFin ? `${evento.dia}T${horaFin}:00` : undefined,
          allDay: !hora,
          startEditable: Boolean(onMover && evento.movible),
          durationEditable: false,
          classNames: [`fc-origen-${evento.origen}`],
          extendedProps: { origen: evento.origen },
        };
      }),
    [eventos, onMover],
  );

  const origenesPresentes = useMemo(
    () => Array.from(new Set(eventos.map((evento) => evento.origen))),
    [eventos],
  );

  // En móvil la rejilla de mes queda en cuadritos ilegibles: si nadie pidió
  // una vista concreta (por la URL), se empieza en lista.
  useEffect(() => {
    if (compacto || vistaInicial) return;
    if (window.innerWidth < ANCHO_MOVIL) api.current?.getApi().changeView(VISTA_FC.lista);
  }, [compacto, vistaInicial]);

  function alCambiarRango(info: DatesSetArg) {
    setTitulo(info.view.title);

    const nueva = VISTA_DESDE_FC[info.view.type] ?? "mes";
    setVista(nueva);

    // Con `timeZone: "UTC"` las fechas de FullCalendar son UTC "de pared": el
    // mes sale tal cual, sin el desfase de un día que da la zona de América.
    const mes = info.view.currentStart.toISOString().slice(0, 7);
    onCambioRango?.({ mes, vista: nueva });
  }

  async function alSoltar(info: EventDropArg) {
    const inicio = info.event.start;

    if (!inicio || !onMover) {
      info.revert();
      return;
    }

    const iso = inicio.toISOString();
    // Solo en las rejillas por hora tiene sentido cambiar la hora; en la de
    // mes se manda vacía, que es decirle al servidor "deja la que tenía".
    const conHora = info.view.type.startsWith("timeGrid") && !info.event.allDay;

    const bien = await onMover(info.event.id, iso.slice(0, 10), conHora ? iso.slice(11, 16) : "");
    if (!bien) info.revert();
  }

  const esRejillaHoras = vista === "semana" || vista === "dia";

  return (
    <div
      className={cn(
        "calendario-base flex min-w-0 flex-col gap-3",
        compacto && "calendario-compacto",
        className,
      )}
      data-creable={onDiaClick ? "true" : "false"}
    >
      {/* ── Encabezado: navegación, título y vistas ─────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => api.current?.getApi().prev()}
            aria-label={t("previous")}
          >
            <ChevronLeft className="size-5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => api.current?.getApi().next()}
            aria-label={t("next")}
          >
            <ChevronRight className="size-5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => api.current?.getApi().today()}
          >
            {t("today")}
          </Button>
          <h2
            aria-live="polite"
            className="texto-titulo-tarjeta ml-1 min-w-0 truncate first-letter:uppercase sm:text-xl"
          >
            {titulo}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!compacto && (
            <div
              role="group"
              aria-label={t("view.month")}
              className="flex items-center gap-1 rounded-control border border-linea bg-background p-1"
            >
              {(["mes", "semana", "dia", "lista"] as const).map((clave) => {
                const Icono = ICONO_VISTA[clave];
                const etiqueta = t(
                  `view.${{ mes: "month", semana: "week", dia: "day", lista: "list" }[clave]}`,
                );

                return (
                  <Button
                    key={clave}
                    type="button"
                    variant={vista === clave ? "default" : "ghost"}
                    aria-pressed={vista === clave}
                    aria-label={etiqueta}
                    className="min-w-11 px-3"
                    onClick={() => api.current?.getApi().changeView(VISTA_FC[clave])}
                  >
                    <Icono className="size-4" />
                    <span className="hidden md:inline">{etiqueta}</span>
                  </Button>
                );
              })}
            </div>
          )}

          {acciones}
        </div>
      </div>

      <FullCalendar
        ref={api}
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        initialView={VISTA_FC[vistaInicial ?? "mes"]}
        initialDate={fechaInicial}
        now={hoy}
        timeZone="UTC"
        locales={[esLocale]}
        locale={idioma === "en" ? "en" : "es"}
        firstDay={1}
        headerToolbar={false}
        height={esRejillaHoras ? 680 : "auto"}
        fixedWeekCount={false}
        dayMaxEvents={compacto ? 1 : 3}
        moreLinkClick="popover"
        moreLinkContent={(arg) => t("more", { n: arg.num })}
        allDayText={t("allDay")}
        noEventsContent={t("monthEmpty")}
        slotMinTime="06:00:00"
        slotMaxTime="22:00:00"
        scrollTime="07:00:00"
        nowIndicator
        navLinks={!compacto}
        eventInteractive
        editable={Boolean(onMover)}
        eventLongPressDelay={400}
        eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
        slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
        events={entradas}
        datesSet={alCambiarRango}
        eventClick={(info) => {
          info.jsEvent.preventDefault();
          onAbrir?.(info.event.id);
        }}
        dateClick={(info) => onDiaClick?.(info.dateStr.slice(0, 10))}
        eventDrop={alSoltar}
        eventDidMount={(info) => {
          const origen = info.event.extendedProps.origen as OrigenCalendario;
          info.el.title = `${etiquetaOrigen(origen)}: ${info.event.title}`;
        }}
        eventContent={(arg) => {
          const origen = arg.event.extendedProps.origen as OrigenCalendario;
          const Icono = ORIGEN_VISUAL[origen].icono;
          const enLista = arg.view.type.startsWith("list");
          const enHoras = arg.view.type.startsWith("timeGrid");

          return (
            <div
              className={cn(
                "flex min-w-0 gap-1",
                enHoras ? "flex-col" : "items-center",
              )}
            >
              <span className="flex min-w-0 items-center gap-1">
                <Icono className="size-3 shrink-0" aria-hidden />
                {!enLista && arg.timeText && (
                  <span className="shrink-0 opacity-80">{arg.timeText}</span>
                )}
                {!enHoras && <span className="truncate">{arg.event.title}</span>}
              </span>
              {enHoras && <span className="truncate">{arg.event.title}</span>}
            </div>
          );
        }}
      />

      {origenesPresentes.length > 0 && (
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {origenesPresentes.map((origen) => {
            const Icono = ORIGEN_VISUAL[origen].icono;

            return (
              <li
                key={origen}
                className="texto-meta flex items-center gap-1.5"
              >
                <Icono className="size-3.5" aria-hidden />
                {etiquetaOrigen(origen)}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export type { EventoCalendario };
