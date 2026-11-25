"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Award,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Sparkles,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";

import {
  CalendarioCompacto,
  type EntradaCompacta,
} from "@/components/calendario/calendario-compacto";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { GraficoAnillo, GraficoBarras, LeyendaGrafico, TONO } from "@/components/ui/grafico";
import { Progress } from "@/components/ui/progress";
import { Link } from "@/i18n/navigation";
import { AZUL, AZUL_OSCURO, AZUL_SUAVE } from "@/lib/paleta";
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
                  <Progress value={item.progreso} aria-label={item.detalle} className="h-1.5" />
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

  // Las actividades del docente al formato del calendario compacto.
  const entradasCalendario = useMemo<EntradaCompacta[]>(
    () =>
      actividades.map((act) => ({
        id: act.id,
        origen: act.categoria,
        titulo: act.titulo,
        dia: act.fecha,
        hora: act.hora,
        href: act.href,
      })),
    [actividades],
  );

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
              <GraficoBarras
                datos={datosClases}
                claveX="clase"
                series={[
                  { clave: "inscritos", nombre: t("enrolledSeries"), color: TONO.suave },
                  { clave: "notas", nombre: t("gradesSeries"), color: TONO.oscuro },
                ]}
                etiqueta={t("classesChartTitle")}
                vacio={t("noClassesChart")}
                altura={224}
              />
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
                <GraficoAnillo
                  datos={datosEntregas}
                  etiqueta={t("reviewsChartTitle")}
                  vacio={t("noSubmissionsYet")}
                  altura={160}
                  centro={{ valor: `${pctRevisadas}%`, etiqueta: t("reviewedPct") }}
                />

                <LeyendaGrafico enLista items={datosEntregas.map((d) => ({ nombre: d.nombre, color: d.color, valor: d.valor }))} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <CalendarioCompacto
        titulo={t("calendarTitle")}
        entradas={entradasCalendario}
        hoy={hoyIso}
        enlaceCompleto={{ href: "/calendario", etiqueta: t("viewFullCalendar") }}
      />
    </div>
  );
}

