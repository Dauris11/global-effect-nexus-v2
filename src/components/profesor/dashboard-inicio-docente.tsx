"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Award,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Sparkles,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { AZUL, AZUL_OSCURO, AZUL_SUAVE } from "@/lib/paleta";
import { cn } from "@/lib/utils";
import type { ActividadCalendarioDocente } from "@/server/profesor/consultas";

export type ClaseResumenGrafico = {
  id: string;
  nombre: string;
  inscritos: number;
  con_nota: number;
};

function useConteoAnimado(objetivo: number): number {
  const [valor, setValor] = useState(0);

  useEffect(() => {
    const inicio = performance.now();
    const duracion = 650;
    let raf = 0;

    const paso = (ahora: number) => {
      const progreso = Math.min(1, (ahora - inicio) / duracion);
      const suavizado = 1 - Math.pow(1 - progreso, 3);
      setValor(objetivo * suavizado);
      if (progreso < 1) raf = requestAnimationFrame(paso);
    };

    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [objetivo]);

  return Math.round(valor);
}

/**
 * KPIs animados e interactivos del Portal Docente.
 */
export function KpisAnimadosDocente({
  totalClases,
  estudiantes,
  notas,
  porRevisar,
}: {
  totalClases: number;
  estudiantes: number;
  notas: number;
  porRevisar: number;
}) {
  const t = useTranslations("teacherPortal");

  const clasesAnim = useConteoAnimado(totalClases);
  const estAnim = useConteoAnimado(estudiantes);
  const notasAnim = useConteoAnimado(notas);
  const revAnim = useConteoAnimado(porRevisar);

  const tarjetas = [
    {
      etiqueta: t("stats.classes360"),
      valor: clasesAnim,
      progreso: Math.min(100, totalClases * 15),
      icono: Sparkles,
      href: "/academico/clases-360",
      detalle: t("dashboard.classesHint"),
    },
    {
      etiqueta: t("stats.students"),
      valor: estAnim,
      progreso: Math.min(100, estudiantes * 4),
      icono: Users,
      href: "/portal/profesor/materias",
      detalle: t("dashboard.studentsHint"),
    },
    {
      etiqueta: t("stats.grades"),
      valor: notasAnim,
      progreso: estudiantes > 0 ? Math.min(100, (notas / Math.max(1, estudiantes)) * 100) : 0,
      icono: Award,
      href: "/academico/clases-360",
      detalle: t("dashboard.gradesHint"),
    },
    {
      etiqueta: t("stats.toReview"),
      valor: revAnim,
      progreso: Math.min(100, porRevisar * 10),
      icono: ClipboardList,
      href: "/portal/profesor/materias",
      detalle: t("dashboard.toReviewHint"),
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

/**
 * Dashboard gráfico e interactivo del Portal Docente:
 * 1) Gráfico de clases, estudiantes inscritos y notas finales puestas.
 * 2) Gráfico de entregas por revisar vs calificadas.
 * 3) Calendario mensual interactivo con reuniones, tareas y eventos.
 */
export function DashboardGraficoDocente({
  resumenClases,
  porRevisar,
  calificadas,
  actividades,
  hoyIso,
  locale,
}: {
  resumenClases: readonly ClaseResumenGrafico[];
  porRevisar: number;
  calificadas: number;
  actividades: readonly ActividadCalendarioDocente[];
  hoyIso: string;
  locale: "es" | "en";
}) {
  const t = useTranslations("teacherPortal.dashboard");

  const datosClases = useMemo(
    () =>
      resumenClases.slice(0, 7).map((c) => ({
        clase: c.nombre.length > 14 ? `${c.nombre.slice(0, 13)}…` : c.nombre,
        inscritos: c.inscritos,
        notas: c.con_nota,
      })),
    [resumenClases],
  );

  const totalEntregas = porRevisar + calificadas;
  const pctRevisadas =
    totalEntregas > 0 ? Math.round((calificadas / totalEntregas) * 100) : 100;

  const datosEntregas = [
    { clave: "pending", nombre: t("toReviewSeries"), valor: porRevisar, color: AZUL },
    { clave: "graded", nombre: t("gradedSeries"), valor: calificadas, color: AZUL_SUAVE },
  ].filter((d) => d.valor > 0);

  // Calendario interactivo
  const porFecha = useMemo(() => {
    const mapa = new Map<string, ActividadCalendarioDocente[]>();
    for (const act of actividades) {
      const lista = mapa.get(act.fecha) ?? [];
      lista.push(act);
      mapa.set(act.fecha, lista);
    }
    return mapa;
  }, [actividades]);

  const [anioMes, setAnioMes] = useState(() => ({
    anio: Number(hoyIso.slice(0, 4)),
    mes: Number(hoyIso.slice(5, 7)) - 1,
  }));
  const [diaSeleccionado, setDiaSeleccionado] = useState(hoyIso);

  const calendario = useMemo(() => {
    const primero = new Date(anioMes.anio, anioMes.mes, 1);
    const ultimo = new Date(anioMes.anio, anioMes.mes + 1, 0);
    const offset = (primero.getDay() + 6) % 7;

    const celdas: { iso: string | null; numero: number | null }[] = [];
    for (let i = 0; i < offset; i++) celdas.push({ iso: null, numero: null });
    for (let d = 1; d <= ultimo.getDate(); d++) {
      celdas.push({
        iso: `${anioMes.anio}-${String(anioMes.mes + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
        numero: d,
      });
    }

    const etiquetaMes = new Intl.DateTimeFormat(
      locale === "en" ? "en-US" : "es-DO",
      { month: "long", year: "numeric" },
    ).format(primero);

    return { celdas, etiquetaMes };
  }, [anioMes, locale]);

  const cambiarMes = (delta: number) => {
    setAnioMes((prev) => {
      const d = new Date(prev.anio, prev.mes + delta, 1);
      return { anio: d.getFullYear(), mes: d.getMonth() };
    });
  };

  const actividadesDia = porFecha.get(diaSeleccionado) ?? [];
  const diasCabecera =
    locale === "en"
      ? ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]
      : ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];

  return (
    <div className="space-y-6">
      {/* Fila superior: gráficos de clases/estudiantes/notas + entregas por revisar */}
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardContent className="space-y-3 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>
                  <BookOpen className="size-4 text-marca-600" />
                  {t("classesChartTitle")}
                </CardTitle>
                <p className="mt-1 text-xs text-tinta-3">{t("classesChartHint")}</p>
              </div>
              <div className="flex items-center gap-3 text-xs text-tinta-2">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-marca-300" />
                  {t("enrolledSeries")}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-marca-700" />
                  {t("gradesSeries")}
                </span>
              </div>
            </div>

            {datosClases.length === 0 ? (
              <p className="py-12 text-center text-xs text-tinta-3">
                {t("noClassesChart")}
              </p>
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={datosClases}
                    margin={{ top: 8, right: 8, left: -22, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.25} />
                    <XAxis dataKey="clase" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: "rgba(32, 150, 186, 0.08)" }}
                      contentStyle={{
                        borderRadius: "10px",
                        borderColor: "var(--border)",
                        fontSize: "12px",
                      }}
                    />
                    <Bar
                      dataKey="inscritos"
                      name={t("enrolledSeries")}
                      fill={AZUL_SUAVE}
                      radius={[4, 4, 0, 0]}
                      animationDuration={650}
                    />
                    <Bar
                      dataKey="notas"
                      name={t("gradesSeries")}
                      fill={AZUL_OSCURO}
                      radius={[4, 4, 0, 0]}
                      animationDuration={650}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-5">
          <CardContent className="flex h-full flex-col justify-between gap-4 pt-5">
            <div>
              <CardTitle>
                <ClipboardCheck className="size-4 text-marca-600" />
                {t("reviewsChartTitle")}
              </CardTitle>
              <p className="mt-1 text-xs text-tinta-3">
                {t("reviewsChartHint", { pending: porRevisar, graded: calificadas })}
              </p>
            </div>

            {totalEntregas === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <CheckCircle2 className="size-7 text-marca-500/70" />
                <p className="mt-2 text-xs text-tinta-3">{t("noSubmissionsYet")}</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-[160px_1fr] sm:items-center">
                <div className="relative h-40 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={datosEntregas}
                        dataKey="valor"
                        nameKey="nombre"
                        innerRadius={42}
                        outerRadius={64}
                        paddingAngle={3}
                        animationDuration={650}
                      >
                        {datosEntregas.map((d) => (
                          <Cell key={d.clave} fill={d.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          borderRadius: "10px",
                          borderColor: "var(--border)",
                          fontSize: "12px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-lg font-bold text-tinta">{pctRevisadas}%</span>
                    <span className="text-[10px] text-tinta-3">{t("reviewedPct")}</span>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  {datosEntregas.map((d) => (
                    <div
                      key={d.clave}
                      className="flex items-center justify-between rounded-control border border-linea bg-muted/30 px-3 py-2"
                    >
                      <span className="inline-flex items-center gap-1.5 text-tinta-2">
                        <span
                          className="size-2.5 rounded-full"
                          style={{ backgroundColor: d.color }}
                        />
                        {d.nombre}
                      </span>
                      <span className="font-semibold text-tinta tabular-nums">{d.valor}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Calendario interactivo del docente */}
      <Card>
        <CardContent className="pt-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>
                <CalendarDays className="size-4 text-marca-600" />
                {t("calendarTitle")}
              </CardTitle>
              <p className="mt-1 text-xs text-tinta-3">{t("calendarSubtitle")}</p>
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

                  const lista = porFecha.get(celda.iso) ?? [];
                  const tieneReunion = lista.some((a) => a.categoria === "reunion");
                  const tieneTarea = lista.some((a) => a.categoria === "tarea");
                  const tieneEvento = lista.some((a) => a.categoria === "evento");
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
                            : "text-tinta hover:bg-muted",
                      )}
                    >
                      <span>{celda.numero}</span>
                      {lista.length > 0 && (
                        <span className="mt-0.5 flex items-center gap-0.5">
                          {tieneReunion && (
                            <span
                              className={cn(
                                "size-1.5 rounded-full",
                                seleccionado ? "bg-white" : "animate-pulse bg-marca-700",
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
                          {tieneEvento && (
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
                  {t("catEvent")}
                </span>
              </div>
            </div>

            <div
              key={diaSeleccionado}
              className="animate-fade-in-up flex flex-col justify-between rounded-card border border-linea bg-muted/30 p-3.5"
            >
              <div>
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-tinta">
                    {t("dayTitle", { date: diaSeleccionado })}
                  </p>
                  <Badge variant="outline" className="text-[10px]">
                    {actividadesDia.length}
                  </Badge>
                </div>

                {actividadesDia.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <CheckCircle2 className="size-6 text-marca-500/70" />
                    <p className="mt-2 text-xs text-tinta-3">{t("dayEmpty")}</p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {actividadesDia.map((act) => {
                      const Icono =
                        act.categoria === "reunion"
                          ? Users
                          : act.categoria === "tarea"
                            ? ClipboardList
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

              <div className="mt-3 flex justify-end border-t border-linea pt-2.5">
                <Link
                  href="/calendario"
                  className="text-xs font-semibold text-marca-600 hover:underline"
                >
                  {t("viewFullCalendar")}
                </Link>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

