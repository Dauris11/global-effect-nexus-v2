"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Award,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  MessageSquareText,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { AZUL, AZUL_SUAVE, TINTA } from "@/lib/paleta";
import { cn } from "@/lib/utils";

export type TareaDashboard = {
  id: string;
  titulo: string;
  tipo: "tarea" | "examen" | "material" | "anuncio";
  materia: string;
  fechaIso: string; // YYYY-MM-DD (vencimiento o publicación)
  hora: string | null;
  estadoEntrega: "pendiente" | "entregado" | "calificado" | "tarde" | null;
  vencida: boolean;
};

export type EventoDashboard = {
  id: string;
  titulo: string;
  tipo: string;
  fecha: string; // YYYY-MM-DD
  hora: string | null;
  ubicacion: string | null;
};

export type ReunionDashboard = {
  id: string;
  titulo: string;
  tipo: string;
  modalidad: string;
  fecha: string; // YYYY-MM-DD
  hora: string;
};

function useConteoAnimado(objetivo: number | null, decimales = 0): string {
  const [valor, setValor] = useState(0);

  useEffect(() => {
    if (objetivo === null || !Number.isFinite(objetivo)) return;
    const inicio = performance.now();
    const duracion = 650;
    let raf = 0;

    const paso = (ahora: number) => {
      const progreso = Math.min(1, (ahora - inicio) / duracion);
      const suavizado = 1 - Math.pow(1 - progreso, 3);
      setValor(objetivo * suavizado);
      if (progreso < 1) {
        raf = requestAnimationFrame(paso);
      }
    };

    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [objetivo]);

  if (objetivo === null) return "—";
  return decimales > 0 ? valor.toFixed(decimales) : String(Math.round(valor));
}

/**
 * Tarjetas KPI animadas para Promedio, Índice, Aprobadas y Créditos.
 */
export function KpisAnimadosEstudiante({
  promedio,
  indice,
  aprobadas,
  creditos,
}: {
  promedio: number | null;
  indice: number | null;
  aprobadas: number;
  creditos: number;
}) {
  const t = useTranslations("studentPortal");

  const promAnimado = useConteoAnimado(promedio, 1);
  const idxAnimado = useConteoAnimado(indice, 2);
  const aprobAnimado = useConteoAnimado(aprobadas, 0);
  const credAnimado = useConteoAnimado(creditos, 0);

  const tarjetas = [
    {
      etiqueta: t("stats.average"),
      valor: promAnimado,
      progreso: promedio !== null ? Math.min(100, Math.max(0, promedio)) : 0,
      icono: TrendingUp,
      href: "/portal/estudiante/calificaciones",
      detalle: t("dashboard.averageHint"),
    },
    {
      etiqueta: `${t("gradesPage.gpaShort")} ${t("gpaScale")}`,
      valor: idxAnimado,
      progreso: indice !== null ? Math.min(100, Math.max(0, (indice / 4) * 100)) : 0,
      icono: Sparkles,
      href: "/portal/estudiante/calificaciones",
      detalle: t("dashboard.gpaHint"),
    },
    {
      etiqueta: t("stats.passed"),
      valor: aprobAnimado,
      progreso: Math.min(100, aprobadas * 12),
      icono: Award,
      href: "/portal/estudiante/calificaciones",
      detalle: t("dashboard.passedHint"),
    },
    {
      etiqueta: t("stats.credits"),
      valor: credAnimado,
      progreso: Math.min(100, creditos * 5),
      icono: BookOpen,
      href: "/portal/estudiante/prematricula",
      detalle: t("dashboard.creditsHint"),
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
      {tarjetas.map((item) => {
        const Icono = item.icono;
        return (
          <Link key={item.etiqueta} href={item.href} className="group block">
            <Card className="h-full overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:border-marca-500/40 hover:shadow-md">
              <CardContent className="flex h-full flex-col justify-between gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-tinta-3">
                      {item.etiqueta}
                    </p>
                    <p className="mt-1 text-2xl font-bold tracking-tight text-tinta tabular-nums transition-colors group-hover:text-marca-600 md:text-3xl">
                      {item.valor}
                    </p>
                  </div>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-marca-50 text-marca-600 transition-transform duration-200 group-hover:scale-110 group-hover:bg-marca-500 group-hover:text-white">
                    <Icono className="size-4" aria-hidden />
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-marca-500 transition-all duration-700 ease-out"
                      style={{ width: `${item.progreso}%` }}
                    />
                  </div>
                  <p className="truncate text-[11px] text-tinta-3">{item.detalle}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

type ActividadDia = {
  id: string;
  categoria: "reunion" | "tarea" | "foro" | "evento";
  titulo: string;
  subtitulo: string;
  hora: string | null;
  href: string;
};

/**
 * Dashboard gráfico del inicio estudiantil:
 * 1) Gráfico semanal de tareas pendientes/entregadas/vencidas.
 * 2) Calendario mensual interactivo con reuniones, tareas, foros/anuncios y eventos.
 */
export function DashboardGraficoEstudiante({
  tareas,
  eventos,
  reuniones,
  hoyIso,
  locale,
}: {
  tareas: readonly TareaDashboard[];
  eventos: readonly EventoDashboard[];
  reuniones: readonly ReunionDashboard[];
  hoyIso: string;
  locale: "es" | "en";
}) {
  const t = useTranslations("studentPortal.dashboard");

  // 1. Datos de la semana actual (Lunes a Domingo a partir de hoyIso)
  const datosSemana = useMemo(() => {
    const base = new Date(`${hoyIso}T12:00:00`);
    const diaSemana = base.getDay(); // 0=dom..6=sab
    const diffLunes = diaSemana === 0 ? -6 : 1 - diaSemana;
    const lunes = new Date(base);
    lunes.setDate(base.getDate() + diffLunes);

    const formateadorDia = new Intl.DateTimeFormat(
      locale === "en" ? "en-US" : "es-DO",
      { weekday: "short" },
    );

    const dias: {
      fecha: string;
      dia: string;
      pendientes: number;
      entregadas: number;
      vencidas: number;
    }[] = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(lunes);
      d.setDate(lunes.getDate() + i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

      let pendientes = 0;
      let entregadas = 0;
      let vencidas = 0;

      for (const tarea of tareas) {
        if (tarea.tipo !== "tarea" && tarea.tipo !== "examen") continue;
        if (tarea.fechaIso !== iso) continue;

        const yaEntrego =
          tarea.estadoEntrega === "entregado" ||
          tarea.estadoEntrega === "calificado" ||
          tarea.estadoEntrega === "tarde";

        if (yaEntrego) entregadas += 1;
        else if (tarea.vencida) vencidas += 1;
        else pendientes += 1;
      }

      dias.push({
        fecha: iso,
        dia: formateadorDia.format(d),
        pendientes,
        entregadas,
        vencidas,
      });
    }

    return dias;
  }, [tareas, hoyIso, locale]);

  const totalPendientesSemana = useMemo(
    () => datosSemana.reduce((acc, d) => acc + d.pendientes, 0),
    [datosSemana],
  );

  // 2. Mapa de actividades por fecha YYYY-MM-DD para el calendario interactivo
  const actividadesPorFecha = useMemo(() => {
    const mapa = new Map<string, ActividadDia[]>();
    const agregar = (fecha: string, item: ActividadDia) => {
      const lista = mapa.get(fecha) ?? [];
      lista.push(item);
      mapa.set(fecha, lista);
    };

    for (const r of reuniones) {
      agregar(r.fecha, {
        id: `reu-${r.id}`,
        categoria: "reunion",
        titulo: r.titulo,
        subtitulo: r.modalidad,
        hora: r.hora,
        href: "/reuniones",
      });
    }

    for (const ta of tareas) {
      if (ta.tipo === "anuncio") {
        agregar(ta.fechaIso, {
          id: `foro-${ta.id}`,
          categoria: "foro",
          titulo: ta.titulo,
          subtitulo: ta.materia,
          hora: ta.hora,
          href: "/portal/estudiante/aula-virtual",
        });
      } else if (ta.tipo === "tarea" || ta.tipo === "examen") {
        agregar(ta.fechaIso, {
          id: `tar-${ta.id}`,
          categoria: "tarea",
          titulo: ta.titulo,
          subtitulo: ta.materia,
          hora: ta.hora,
          href: "/portal/estudiante/aula-virtual",
        });
      }
    }

    for (const ev of eventos) {
      agregar(ev.fecha, {
        id: `ev-${ev.id}`,
        categoria: "evento",
        titulo: ev.titulo,
        subtitulo: ev.ubicacion ?? ev.tipo,
        hora: ev.hora,
        href: "/portal/estudiante/calendario",
      });
    }

    return mapa;
  }, [reuniones, tareas, eventos]);

  // Estado del calendario mensual interactivo
  const [anioMes, setAnioMes] = useState(() => ({
    anio: Number(hoyIso.slice(0, 4)),
    mes: Number(hoyIso.slice(5, 7)) - 1, // 0..11
  }));
  const [diaSeleccionado, setDiaSeleccionado] = useState(hoyIso);

  const calendario = useMemo(() => {
    const primerDia = new Date(anioMes.anio, anioMes.mes, 1);
    const ultimoDia = new Date(anioMes.anio, anioMes.mes + 1, 0);
    const offsetLunes = (primerDia.getDay() + 6) % 7; // Lunes = 0

    const celdas: { iso: string | null; numero: number | null }[] = [];
    for (let i = 0; i < offsetLunes; i++) {
      celdas.push({ iso: null, numero: null });
    }
    for (let d = 1; d <= ultimoDia.getDate(); d++) {
      const iso = `${anioMes.anio}-${String(anioMes.mes + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      celdas.push({ iso, numero: d });
    }

    const etiquetaMes = new Intl.DateTimeFormat(
      locale === "en" ? "en-US" : "es-DO",
      { month: "long", year: "numeric" },
    ).format(primerDia);

    return { celdas, etiquetaMes };
  }, [anioMes, locale]);

  const cambiarMes = (delta: number) => {
    setAnioMes((prev) => {
      const d = new Date(prev.anio, prev.mes + delta, 1);
      return { anio: d.getFullYear(), mes: d.getMonth() };
    });
  };

  const actividadesDelDia = actividadesPorFecha.get(diaSeleccionado) ?? [];
  const proximosEventos = useMemo(
    () => eventos.filter((e) => e.fecha >= hoyIso).slice(0, 3),
    [eventos, hoyIso],
  );

  const diasCabecera =
    locale === "en"
      ? ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]
      : ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];

  return (
    <section className="grid gap-6 lg:grid-cols-12">
      {/* Gráfico de tareas semanales pendientes */}
      <Card className="lg:col-span-5">
        <CardContent className="flex h-full flex-col justify-between gap-4 pt-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle>
                <ClipboardList className="size-4 text-marca-600" />
                {t("weeklyTasksTitle")}
              </CardTitle>
              <p className="mt-1 text-xs text-tinta-3">
                {t("weeklyTasksSubtitle", { count: totalPendientesSemana })}
              </p>
            </div>
            <Link
              href="/portal/estudiante/aula-virtual"
              className="text-xs font-semibold text-marca-600 hover:text-marca-700 hover:underline"
            >
              {t("openClassroom")}
            </Link>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={datosSemana}
                margin={{ top: 8, right: 8, left: -24, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.25} />
                <XAxis
                  dataKey="dia"
                  tick={{ fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "rgba(32, 150, 186, 0.08)" }}
                  contentStyle={{
                    borderRadius: "10px",
                    borderColor: "var(--border)",
                    fontSize: "12px",
                  }}
                />
                <Bar
                  dataKey="pendientes"
                  name={t("legendPending")}
                  fill={AZUL}
                  radius={[4, 4, 0, 0]}
                  animationDuration={700}
                />
                <Bar
                  dataKey="entregadas"
                  name={t("legendDone")}
                  fill={AZUL_SUAVE}
                  radius={[4, 4, 0, 0]}
                  animationDuration={700}
                />
                <Bar
                  dataKey="vencidas"
                  name={t("legendOverdue")}
                  fill={TINTA}
                  radius={[4, 4, 0, 0]}
                  animationDuration={700}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-tinta-2">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-marca-500" />
              {t("legendPending")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-marca-300" />
              {t("legendDone")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-tinta" />
              {t("legendOverdue")}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Calendario interactivo de reuniones, tareas y foros */}
      <Card className="lg:col-span-7">
        <CardContent className="pt-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>
                <CalendarDays className="size-4 text-marca-600" />
                {t("interactiveCalendarTitle")}
              </CardTitle>
              <p className="mt-1 text-xs text-tinta-3">
                {t("interactiveCalendarSubtitle")}
              </p>
            </div>

            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8"
                aria-label={t("prevMonth")}
                onClick={() => cambiarMes(-1)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="min-w-32 text-center text-xs font-semibold capitalize text-tinta">
                {calendario.etiquetaMes}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8"
                aria-label={t("nextMonth")}
                onClick={() => cambiarMes(1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {/* Rejilla mensual */}
            <div>
              <div className="mb-1.5 grid grid-cols-7 text-center text-[11px] font-semibold text-tinta-3">
                {diasCabecera.map((d) => (
                  <span key={d} className="py-1">
                    {d}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {calendario.celdas.map((celda, idx) => {
                  if (!celda.iso || !celda.numero) {
                    return <div key={`vacio-${idx}`} className="h-10" />;
                  }

                  const lista = actividadesPorFecha.get(celda.iso) ?? [];
                  const tieneReunion = lista.some((a) => a.categoria === "reunion");
                  const tieneTarea = lista.some((a) => a.categoria === "tarea");
                  const tieneForo = lista.some(
                    (a) => a.categoria === "foro" || a.categoria === "evento",
                  );
                  const esHoy = celda.iso === hoyIso;
                  const seleccionado = celda.iso === diaSeleccionado;

                  return (
                    <button
                      key={celda.iso}
                      type="button"
                      onClick={() => setDiaSeleccionado(celda.iso!)}
                      className={cn(
                        "relative flex h-10 flex-col items-center justify-center rounded-control text-xs font-medium transition-all duration-150",
                        seleccionado
                          ? "scale-105 bg-marca-500 font-bold text-white shadow-sm"
                          : esHoy
                            ? "border border-marca-500 bg-marca-50 text-marca-700"
                            : "hover:bg-muted text-tinta",
                      )}
                    >
                      <span>{celda.numero}</span>
                      {lista.length > 0 && (
                        <span className="mt-0.5 flex items-center gap-0.5">
                          {tieneReunion && (
                            <span
                              className={cn(
                                "size-1.5 rounded-full",
                                seleccionado ? "bg-white" : "bg-marca-700 animate-pulse",
                              )}
                            />
                          )}
                          {tieneTarea && (
                            <span
                              className={cn(
                                "size-1.5 rounded-full",
                                seleccionado ? "bg-white" : "bg-marca-500",
                              )}
                            />
                          )}
                          {tieneForo && (
                            <span
                              className={cn(
                                "size-1.5 rounded-full",
                                seleccionado ? "bg-white/80" : "bg-tinta",
                              )}
                            />
                          )}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-tinta-3">
                <span className="inline-flex items-center gap-1">
                  <span className="size-2 rounded-full bg-marca-700" />
                  {t("catMeeting")}
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="size-2 rounded-full bg-marca-500" />
                  {t("catTask")}
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="size-2 rounded-full bg-tinta" />
                  {t("catForum")}
                </span>
              </div>
            </div>

            {/* Panel animado del día seleccionado */}
            <div
              key={diaSeleccionado}
              className="animate-fade-in-up flex flex-col justify-between rounded-card border border-linea bg-muted/30 p-3.5"
            >
              <div>
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-tinta">
                    {t("dayAgendaTitle", { date: diaSeleccionado })}
                  </p>
                  <Badge variant="outline" className="text-[10px]">
                    {actividadesDelDia.length}
                  </Badge>
                </div>

                {actividadesDelDia.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <CheckCircle2 className="size-6 text-marca-500/70" />
                    <p className="mt-2 text-xs text-tinta-3">{t("dayEmpty")}</p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {actividadesDelDia.map((act) => {
                      const Icono =
                        act.categoria === "reunion"
                          ? Users
                          : act.categoria === "tarea"
                            ? ClipboardList
                            : act.categoria === "foro"
                              ? MessageSquareText
                              : CalendarDays;
                      return (
                        <li key={act.id}>
                          <Link
                            href={act.href}
                            className="group flex items-start gap-2.5 rounded-control bg-card p-2.5 shadow-xs transition-all duration-150 hover:translate-x-0.5 hover:border-marca-500/40"
                          >
                            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-marca-50 text-marca-600 transition-colors group-hover:bg-marca-500 group-hover:text-white">
                              <Icono className="size-3.5" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-semibold text-tinta">
                                {act.titulo}
                              </p>
                              <p className="truncate text-[11px] text-tinta-3">
                                {[act.hora, act.subtitulo].filter(Boolean).join(" · ")}
                              </p>
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="mt-3 space-y-2.5 border-t border-linea pt-2.5">
                {proximosEventos.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold text-tinta-2">
                      {t("upcomingEventsTitle")}
                    </p>
                    <ul className="space-y-1">
                      {proximosEventos.map((ev) => (
                        <li key={ev.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setDiaSeleccionado(ev.fecha);
                              setAnioMes({
                                anio: Number(ev.fecha.slice(0, 4)),
                                mes: Number(ev.fecha.slice(5, 7)) - 1,
                              });
                            }}
                            className="flex w-full items-center justify-between gap-2 rounded-control px-2 py-1 text-left text-[11px] transition-colors hover:bg-card"
                          >
                            <span className="truncate font-medium text-tinta">
                              {ev.titulo}
                            </span>
                            <span className="shrink-0 text-tinta-3">{ev.fecha}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex justify-end">
                  <Link
                    href="/portal/estudiante/calendario"
                    className="text-xs font-semibold text-marca-600 hover:underline"
                  >
                    {t("viewFullAgenda")}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
