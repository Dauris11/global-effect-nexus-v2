"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Award,
  BookOpen,
  ClipboardList,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { useTranslations } from "next-intl";

import {
  CalendarioCompacto,
  type EntradaCompacta,
} from "@/components/calendario/calendario-compacto";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { GraficoBarras, TONO } from "@/components/ui/grafico";
import { Progress } from "@/components/ui/progress";
import { Link } from "@/i18n/navigation";
import { AZUL, AZUL_SUAVE, TINTA } from "@/lib/paleta";

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
    },
    {
      etiqueta: `${t("gradesPage.gpaShort")} ${t("gpaScale")}`,
      valor: idxAnimado,
      progreso: indice !== null ? Math.min(100, Math.max(0, (indice / 4) * 100)) : 0,
      icono: Sparkles,
      href: "/portal/estudiante/calificaciones",
    },
    {
      etiqueta: t("stats.passed"),
      valor: aprobAnimado,
      progreso: Math.min(100, aprobadas * 12),
      icono: Award,
      href: "/portal/estudiante/calificaciones",
    },
    {
      etiqueta: t("stats.credits"),
      valor: credAnimado,
      progreso: Math.min(100, creditos * 5),
      icono: BookOpen,
      href: "/portal/estudiante/prematricula",
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
                  <Progress value={item.progreso} aria-label={item.etiqueta} className="h-1.5" />
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

  // 2. Todo lo que tiene fecha, para el calendario compacto de la tarjeta.
  const entradasCalendario = useMemo<EntradaCompacta[]>(() => {
    const lista: EntradaCompacta[] = [];

    for (const r of reuniones) {
      lista.push({
        id: `reu-${r.id}`,
        origen: "reunion",
        titulo: r.titulo,
        dia: r.fecha,
        hora: r.hora,
        href: "/reuniones",
      });
    }

    for (const ta of tareas) {
      if (ta.tipo === "anuncio") {
        lista.push({
          id: `foro-${ta.id}`,
          origen: "foro",
          titulo: ta.titulo,
          dia: ta.fechaIso,
          hora: ta.hora,
          href: "/portal/estudiante/tareas",
        });
      } else if (ta.tipo === "tarea" || ta.tipo === "examen") {
        lista.push({
          id: `tar-${ta.id}`,
          origen: "tarea",
          titulo: ta.titulo,
          dia: ta.fechaIso,
          hora: ta.hora,
          href: "/portal/estudiante/tareas",
        });
      }
    }

    for (const ev of eventos) {
      lista.push({
        id: `ev-${ev.id}`,
        origen: "evento",
        titulo: ev.titulo,
        dia: ev.fecha,
        hora: ev.hora,
        href: "/portal/estudiante/calendario",
      });
    }

    return lista;
  }, [reuniones, tareas, eventos]);

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
            </div>
            <Link
              href="/portal/estudiante/tareas"
              className="text-xs font-semibold text-marca-600 hover:text-marca-700 hover:underline"
            >
              {t("openClassroom")}
            </Link>
          </div>

          <GraficoBarras
            datos={datosSemana}
            claveX="dia"
            series={[
              { clave: "pendientes", nombre: t("legendPending"), color: TONO.base },
              { clave: "entregadas", nombre: t("legendDone"), color: TONO.suave },
              { clave: "vencidas", nombre: t("legendOverdue"), color: TONO.tinta },
            ]}
            etiqueta={t("weeklyTasksTitle")}
            vacio={t("weeklyTasksTitle")}
            altura={224}
          />

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

      <CalendarioCompacto
        className="lg:col-span-7"
        titulo={t("interactiveCalendarTitle")}
        entradas={entradasCalendario}
        hoy={hoyIso}
        enlaceCompleto={{
          href: "/portal/estudiante/calendario",
          etiqueta: t("viewFullAgenda"),
        }}
      />
    </section>
  );
}
