"use client";

import { useMemo, useState } from "react";
import {
  BookOpen,
  CalendarCheck2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Inbox,
  MapPin,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { variantesBoton } from "@/components/ui/button-variantes";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { EntradaAgenda } from "@/server/estudiantes/agenda";

type OrigenFiltro = "todos" | EntradaAgenda["origen"];

const ESTILO_ORIGEN: Record<
  EntradaAgenda["origen"],
  { chip: string; punto: string; icono: typeof CalendarDays; href: string }
> = {
  clase: {
    chip: "bg-marca-50 text-marca-700 border-marca-500/25",
    punto: "bg-marca-500",
    icono: BookOpen,
    href: "/portal/estudiante/prematricula",
  },
  asignacion: {
    chip: "bg-marca-500/15 text-marca-700 border-marca-500/30",
    punto: "bg-marca-600",
    icono: ClipboardList,
    href: "/portal/estudiante/aula-virtual",
  },
  reunion: {
    chip: "bg-tinta text-background border-tinta",
    punto: "bg-tinta",
    icono: Users,
    href: "/reuniones",
  },
  evento: {
    chip: "bg-muted text-tinta border-linea-fuerte",
    punto: "bg-marca-700",
    icono: CalendarCheck2,
    href: "/portal/estudiante",
  },
  solicitud: {
    chip: "bg-muted/70 text-tinta-2 border-linea",
    punto: "bg-tinta-3",
    icono: Inbox,
    href: "/portal/estudiante/solicitudes",
  },
};

function sumarMes(mesIso: string, delta: number): string {
  const [anioStr, mesStr] = mesIso.split("-");
  const d = new Date(Number(anioStr), Number(mesStr) - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Calendario mensual interactivo del portal estudiantil:
 * rejilla de 7 columnas (Lu–Do), cambio libre de mes, filtros por origen
 * y detalle animado del día seleccionado.
 */
export function CalendarioMensualEstudiante({
  mes,
  hoy,
  entradas,
  locale,
}: {
  mes: string; // YYYY-MM
  hoy: string; // YYYY-MM-DD
  entradas: readonly EntradaAgenda[];
  locale: "es" | "en";
}) {
  const t = useTranslations("studentPortal.agenda");
  const tCal = useTranslations("studentPortal.fullCalendar");

  const [filtro, setFiltro] = useState<OrigenFiltro>("todos");

  const entradasFiltradas = useMemo(
    () =>
      filtro === "todos"
        ? entradas
        : entradas.filter((e) => e.origen === filtro),
    [entradas, filtro],
  );

  const porDia = useMemo(() => {
    const mapa = new Map<string, EntradaAgenda[]>();
    for (const e of entradasFiltradas) {
      const lista = mapa.get(e.dia) ?? [];
      lista.push(e);
      mapa.set(e.dia, lista);
    }
    return mapa;
  }, [entradasFiltradas]);

  const [diaSeleccionado, setDiaSeleccionado] = useState<string>(() => {
    if (hoy.startsWith(mes)) return hoy;
    return entradas[0]?.dia ?? `${mes}-01`;
  });

  // Si cambia de mes por navegación URL, sincronizar el día seleccionado
  const diaActivo = diaSeleccionado.startsWith(mes)
    ? diaSeleccionado
    : hoy.startsWith(mes)
      ? hoy
      : entradasFiltradas[0]?.dia ?? `${mes}-01`;

  const { celdas, etiquetaMes } = useMemo(() => {
    const [anioStr, mesStr] = mes.split("-");
    const anio = Number(anioStr);
    const numMes = Number(mesStr) - 1;
    const primero = new Date(anio, numMes, 1);
    const ultimo = new Date(anio, numMes + 1, 0);
    const offset = (primero.getDay() + 6) % 7;

    const lista: { iso: string | null; numero: number | null }[] = [];
    for (let i = 0; i < offset; i++) lista.push({ iso: null, numero: null });
    for (let d = 1; d <= ultimo.getDate(); d++) {
      lista.push({
        iso: `${mes}-${String(d).padStart(2, "0")}`,
        numero: d,
      });
    }
    while (lista.length % 7 !== 0) {
      lista.push({ iso: null, numero: null });
    }

    const nombreMes = new Intl.DateTimeFormat(
      locale === "en" ? "en-US" : "es-DO",
      { month: "long", year: "numeric" },
    ).format(primero);

    return { celdas: lista, etiquetaMes: nombreMes };
  }, [mes, locale]);

  const mesAnterior = sumarMes(mes, -1);
  const mesSiguiente = sumarMes(mes, 1);
  const mesHoy = hoy.slice(0, 7);

  const diasSemana =
    locale === "en"
      ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
      : ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  const actividadesDia = porDia.get(diaActivo) ?? [];

  const conteos = useMemo(() => {
    const c = { clase: 0, asignacion: 0, reunion: 0, evento: 0, solicitud: 0 };
    for (const e of entradas) c[e.origen] += 1;
    return c;
  }, [entradas]);

  return (
    <div className="space-y-6">
      {/* Cabecera de navegación de meses y filtros */}
      <Card>
        <CardContent className="space-y-4 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Link
                href={`/portal/estudiante/calendario?mes=${mesAnterior}`}
                aria-label={tCal("prevMonth")}
                className={variantesBoton({ variant: "outline", size: "icon", className: "size-9" })}
              >
                <ChevronLeft className="size-4" />
              </Link>

              <h2 className="min-w-44 text-center text-base font-semibold capitalize text-tinta">
                {etiquetaMes}
              </h2>

              <Link
                href={`/portal/estudiante/calendario?mes=${mesSiguiente}`}
                aria-label={tCal("nextMonth")}
                className={variantesBoton({ variant: "outline", size: "icon", className: "size-9" })}
              >
                <ChevronRight className="size-4" />
              </Link>
            </div>

            <div className="flex items-center gap-2">
              <span className="texto-meta">
                {t("count", { count: entradasFiltradas.length })}
              </span>
              {mes !== mesHoy && (
                <Link
                  href={`/portal/estudiante/calendario?mes=${mesHoy}`}
                  className={variantesBoton({ variant: "secondary", size: "sm" })}
                >
                  {tCal("today")}
                </Link>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: "todos", label: tCal("filterAll"), count: entradas.length },
                { id: "clase", label: tCal("filterClasses"), count: conteos.clase },
                { id: "asignacion", label: tCal("filterTasks"), count: conteos.asignacion },
                { id: "reunion", label: tCal("filterMeetings"), count: conteos.reunion },
                { id: "evento", label: tCal("filterEvents"), count: conteos.evento },
                { id: "solicitud", label: tCal("filterRequests"), count: conteos.solicitud },
              ] as const
            ).map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setFiltro(chip.id)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  filtro === chip.id
                    ? "bg-marca-500 text-white"
                    : "bg-muted text-tinta-2 hover:bg-marca-50 hover:text-marca-700",
                )}
              >
                {chip.label} ({chip.count})
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Rejilla mensual + panel lateral de detalle */}
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <CardContent className="pt-5">
            <div className="mb-2 grid grid-cols-7 text-center text-xs font-semibold text-tinta-3">
              {diasSemana.map((d) => (
                <div key={d} className="py-1">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {celdas.map((celda, idx) => {
                if (!celda.iso || !celda.numero) {
                  return (
                    <div
                      key={`vacio-${idx}`}
                      className="min-h-20 rounded-control bg-muted/20 sm:min-h-24"
                    />
                  );
                }

                const delDia = porDia.get(celda.iso) ?? [];
                const esHoy = celda.iso === hoy;
                const seleccionado = celda.iso === diaActivo;

                return (
                  <button
                    key={celda.iso}
                    type="button"
                    onClick={() => setDiaSeleccionado(celda.iso!)}
                    className={cn(
                      "flex min-h-20 flex-col items-stretch justify-start rounded-control border p-1.5 text-left transition-all duration-150 sm:min-h-24",
                      seleccionado
                        ? "border-marca-500 bg-marca-50/60 ring-1 ring-marca-500"
                        : esHoy
                          ? "border-marca-500/60 bg-card"
                          : "border-linea bg-card hover:border-marca-500/40",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          "inline-flex size-6 items-center justify-center rounded-full text-xs font-semibold",
                          esHoy
                            ? "bg-marca-500 text-white"
                            : seleccionado
                              ? "text-marca-700"
                              : "text-tinta",
                        )}
                      >
                        {celda.numero}
                      </span>
                      {delDia.length > 0 && (
                        <span className="text-[10px] font-medium text-tinta-3">
                          {delDia.length}
                        </span>
                      )}
                    </div>

                    <div className="mt-1 space-y-1">
                      {delDia.slice(0, 2).map((item) => (
                        <div
                          key={`${item.origen}-${item.id}`}
                          className={cn(
                            "truncate rounded px-1 py-0.5 text-[10px] font-medium border",
                            ESTILO_ORIGEN[item.origen].chip,
                          )}
                        >
                          {item.hora ? `${item.hora} ` : ""}
                          {item.titulo}
                        </div>
                      ))}
                      {delDia.length > 2 && (
                        <p className="px-1 text-[10px] font-semibold text-marca-600">
                          +{delDia.length - 2}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Detalle del día seleccionado */}
        <Card className="lg:col-span-4">
          <CardContent
            key={diaActivo}
            className="animate-fade-in-up space-y-4 pt-5"
          >
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm">
                <CalendarDays className="size-4 text-marca-600" />
                {tCal("dayTitle", { date: diaActivo })}
              </CardTitle>
              <Badge variant="outline" className="text-[10px]">
                {actividadesDia.length}
              </Badge>
            </div>

            {actividadesDia.length === 0 ? (
              <div className="rounded-card border border-dashed border-linea p-6 text-center">
                <p className="text-xs text-tinta-3">{tCal("dayEmpty")}</p>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {actividadesDia.map((act) => {
                  const cfg = ESTILO_ORIGEN[act.origen];
                  const Icono = cfg.icono;
                  return (
                    <li key={`${act.origen}-${act.id}-${act.hora ?? ""}`}>
                      <Link
                        href={cfg.href}
                        className="block rounded-control border border-linea bg-card p-3 transition-all duration-150 hover:-translate-y-0.5 hover:border-marca-500/40"
                      >
                        <div className="flex items-start gap-2.5">
                          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-marca-50 text-marca-600">
                            <Icono className="size-3.5" />
                          </span>
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <Badge variant="outline" className="text-[10px]">
                                {tCal(`origin.${act.origen}`)}
                              </Badge>
                              {act.hora && (
                                <span className="inline-flex items-center gap-1 text-[11px] text-tinta-3">
                                  <Clock className="size-3" />
                                  {act.hora}
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-semibold text-tinta">
                              {act.titulo}
                            </p>
                            {act.detalle && (
                              <p className="truncate text-[11px] text-tinta-2">
                                {act.detalle}
                              </p>
                            )}
                            {act.ubicacion && (
                              <p className="inline-flex items-center gap-1 text-[11px] text-tinta-3">
                                <MapPin className="size-3" />
                                {act.ubicacion}
                              </p>
                            )}
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

