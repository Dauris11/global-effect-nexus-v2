"use client";

import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Inbox,
  MapPin,
  Sparkles,
  User,
  XCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";

import type { PeriodoConNotas } from "@/components/estudiante/periodos";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { GraficoAnillo, GraficoBarras, TONO, acortar } from "@/components/ui/grafico";
import { Link } from "@/i18n/navigation";
import { fechaCorta } from "@/lib/fechas";
import { AZUL, AZUL_OSCURO, AZUL_SUAVE, NEUTRO, SERIE, TINTA } from "@/lib/paleta";
import { cn } from "@/lib/utils";
import type { MateriaInscrita } from "@/server/estudiantes/portal";
import type { FilaSolicitud } from "@/server/solicitudes/consultas";

/**
 * Materias en curso con gráfico de distribución de créditos y tarjetas interactivas.
 */
export function MateriasEnCursoInteractivo({
  materias,
}: {
  materias: readonly MateriaInscrita[];
}) {
  const t = useTranslations("studentPortal");
  const tDash = useTranslations("studentPortal.dashboard");
  const [activa, setActiva] = useState<string | null>(null);

  const datosGrafico = useMemo(
    () =>
      materias.slice(0, 6).map((m, i) => ({
        id: m.id,
        nombre: acortar(m.nombre, 18),
        completo: m.nombre,
        creditos: m.creditos && m.creditos > 0 ? m.creditos : 1,
        color: SERIE[i % SERIE.length],
      })),
    [materias],
  );

  const indiceActivo = activa ? datosGrafico.findIndex((d) => d.id === activa) : -1;

  const totalCreditos = useMemo(
    () => materias.reduce((s, m) => s + (m.creditos ?? 0), 0),
    [materias],
  );

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-4 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>
              <BookOpen className="size-4 text-marca-600" />
              {t("subjectsTitle")}
              <Badge className="ml-1 bg-marca-500/15 text-[10px] text-marca-700">
                {materias.length}
              </Badge>
            </CardTitle>
            <p className="mt-1 text-xs text-tinta-3">
              {tDash("subjectsInteractiveHint", { credits: totalCreditos })}
            </p>
          </div>
          <Link
            href="/portal/estudiante/prematricula"
            className="inline-flex items-center gap-1 text-xs font-semibold text-marca-600 hover:underline"
          >
            {tDash("manageSubjects")}
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>

        {materias.length === 0 ? (
          <div className="rounded-card border border-dashed border-linea p-6 text-center">
            <p className="text-sm font-medium text-tinta">{t("subjectsEmpty")}</p>
            <p className="mt-1 text-xs text-tinta-3">{t("subjectsEmptyHint")}</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-[170px_1fr] sm:items-center">
            {/* Dona de distribución de créditos */}
            <GraficoAnillo
              datos={datosGrafico.map((d) => ({ nombre: d.completo, valor: d.creditos, color: d.color }))}
              etiqueta={tDash("manageSubjects")}
              vacio={t("subjectsEmpty")}
              altura={160}
              centro={{ valor: totalCreditos, etiqueta: t("stats.credits") }}
              activo={indiceActivo >= 0 ? indiceActivo : null}
              alPasar={(i) => setActiva(i === null ? null : (datosGrafico[i]?.id ?? null))}
            />

            {/* Tarjetas interactivas */}
            <ul className="space-y-2">
              {materias.slice(0, 5).map((materia, i) => (
                <li
                  key={materia.id}
                  onMouseEnter={() => setActiva(materia.id)}
                  onMouseLeave={() => setActiva(null)}
                >
                  <Link
                    href={`/portal/estudiante/aula-virtual?materia=${encodeURIComponent(materia.nombre)}`}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-control border border-linea bg-card p-2.5 transition-all duration-150 hover:-translate-y-0.5 hover:border-marca-500/40 hover:shadow-xs",
                      activa === materia.id && "border-marca-500 bg-marca-50/40",
                    )}
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-2.5">
                      <span
                        className="mt-1.5 size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: SERIE[i % SERIE.length] }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-tinta">
                          {materia.nombre}
                        </p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-tinta-3">
                          {materia.horario && <span>{materia.horario}</span>}
                          {materia.aula && (
                            <span className="inline-flex items-center gap-0.5">
                              <MapPin className="size-3" />
                              {materia.aula}
                            </span>
                          )}
                          {materia.profesor && (
                            <span className="inline-flex items-center gap-0.5">
                              <User className="size-3" />
                              {materia.profesor}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    {materia.creditos !== null && (
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {t("creditsShort", { count: materia.creditos })}
                      </Badge>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Calificaciones recientes con gráfico de barras por asignatura y detalle interactivo.
 */
export function NotasRecientesInteractivo({
  periodo,
}: {
  periodo?: PeriodoConNotas;
}) {
  const t = useTranslations("studentPortal");
  const tDash = useTranslations("studentPortal.dashboard");

  const datosGrafico = useMemo(
    () =>
      (periodo?.notas ?? []).slice(0, 6).map((f) => ({
        id: f.id,
        materia: acortar(f.materia),
        completo: f.materia,
        nota: Number(f.nota.toFixed(1)),
      })),
    [periodo],
  );

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-4 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>
              <Sparkles className="size-4 text-marca-600" />
              {t("gradesTitle")}
            </CardTitle>
            <p className="mt-1 text-xs text-tinta-3">
              {periodo ? periodo.nombre : t("gradesEmpty")}
            </p>
          </div>
          <Link
            href="/portal/estudiante/calificaciones"
            className="inline-flex items-center gap-1 text-xs font-semibold text-marca-600 hover:underline"
          >
            {t("viewHistory")}
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>

        {!periodo || periodo.notas.length === 0 ? (
          <div className="rounded-card border border-dashed border-linea p-6 text-center">
            <p className="text-sm font-medium text-tinta">{t("gradesEmpty")}</p>
            <p className="mt-1 text-xs text-tinta-3">{t("gradesEmptyHint")}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <GraficoBarras
              datos={datosGrafico}
              claveX="materia"
              series={[{ clave: "nota", nombre: tDash("gradeLabel") }]}
              etiqueta={t("gradesTitle")}
              vacio={t("gradesEmpty")}
              dominio={[0, 100]}
              altura={176}
              // El peso del tono dice el rango: oscuro 85+, acento 70+, tinta el resto.
              colorFila={(fila) => (Number(fila.nota) >= 85 ? TONO.oscuro : Number(fila.nota) >= 70 ? TONO.base : TONO.tinta)}
            />

            <ul className="space-y-2">
              {periodo.notas.slice(0, 4).map((fila) => (
                <li
                  key={fila.id}
                  className="rounded-control border border-linea bg-card p-2.5 transition-all duration-150 hover:border-marca-500/40"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate font-semibold text-tinta">
                      {fila.materia}
                    </span>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="font-bold tabular-nums text-tinta">
                        {fila.nota.toFixed(1)}
                      </span>
                      <Badge className="bg-marca-500/15 text-[10px] text-marca-700">
                        {fila.letra}
                      </Badge>
                    </div>
                  </div>
                  <Progress value={fila.nota} className="mt-1.5" aria-label={fila.letra} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type FiltroSolicitud = "todas" | "en_proceso" | "aprobadas" | "rechazadas";

/**
 * Resumen interactivo de solicitudes con barra de distribución y filtros por estado.
 */
export function SolicitudesInteractivo({
  solicitudes,
  locale,
}: {
  solicitudes: readonly FilaSolicitud[];
  locale: "es" | "en";
}) {
  const t = useTranslations("requests");
  const tDash = useTranslations("studentPortal.dashboard");
  const [filtro, setFiltro] = useState<FiltroSolicitud>("todas");

  const conteos = useMemo(() => {
    let aprobadas = 0;
    let enProceso = 0;
    let rechazadas = 0;
    for (const s of solicitudes) {
      if (s.estado === "aprobada") aprobadas += 1;
      else if (s.estado === "rechazada" || s.estado === "cancelada") rechazadas += 1;
      else enProceso += 1;
    }
    return { total: solicitudes.length, aprobadas, enProceso, rechazadas };
  }, [solicitudes]);

  const filtradas = useMemo(() => {
    const lista = solicitudes.filter((s) => {
      if (filtro === "aprobadas") return s.estado === "aprobada";
      if (filtro === "rechazadas") return s.estado === "rechazada" || s.estado === "cancelada";
      if (filtro === "en_proceso") {
        return s.estado !== "aprobada" && s.estado !== "rechazada" && s.estado !== "cancelada";
      }
      return true;
    });
    return lista.slice(0, 5);
  }, [solicitudes, filtro]);

  const total = Math.max(1, conteos.total);

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-4 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>
              <Inbox className="size-4 text-marca-600" />
              {t("mineTitle")}
              <Badge className="ml-1 bg-marca-500/15 text-[10px] text-marca-700">
                {conteos.total}
              </Badge>
            </CardTitle>
            <p className="mt-1 text-xs text-tinta-3">{tDash("requestsInteractiveHint")}</p>
          </div>
          <Link
            href="/portal/estudiante/solicitudes"
            className="inline-flex items-center gap-1 text-xs font-semibold text-marca-600 hover:underline"
          >
            {tDash("openRequests")}
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>

        {/* Barra de distribución visual */}
        {conteos.total > 0 && (
          <div className="space-y-2">
            <div className="flex h-3 w-full gap-1">
              <div
                className="rounded-full transition-all duration-500"
                style={{
                  width: `${(conteos.aprobadas / total) * 100}%`,
                  backgroundColor: AZUL,
                }}
              />
              <div
                className="rounded-full transition-all duration-500"
                style={{
                  width: `${(conteos.enProceso / total) * 100}%`,
                  backgroundColor: AZUL_SUAVE,
                }}
              />
              <div
                className="rounded-full transition-all duration-500"
                style={{
                  width: `${(conteos.rechazadas / total) * 100}%`,
                  backgroundColor: NEUTRO,
                }}
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: "todas", label: tDash("reqFilterAll"), count: conteos.total },
                  { id: "en_proceso", label: tDash("reqFilterPending"), count: conteos.enProceso },
                  { id: "aprobadas", label: tDash("reqFilterApproved"), count: conteos.aprobadas },
                  { id: "rechazadas", label: tDash("reqFilterRejected"), count: conteos.rechazadas },
                ] as const
              ).map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setFiltro(chip.id)}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                    filtro === chip.id
                      ? "bg-marca-500 text-white"
                      : "bg-muted text-tinta-2 hover:bg-marca-50 hover:text-marca-700",
                  )}
                >
                  {chip.label} ({chip.count})
                </button>
              ))}
            </div>
          </div>
        )}

        {filtradas.length === 0 ? (
          <div className="rounded-card border border-dashed border-linea p-6 text-center">
            <p className="text-xs text-tinta-3">{t("mineEmpty")}</p>
          </div>
        ) : (
          <ul key={filtro} className="animate-fade-in-up space-y-2">
            {filtradas.map((sol) => {
              const Icono =
                sol.estado === "aprobada"
                  ? CheckCircle2
                  : sol.estado === "rechazada" || sol.estado === "cancelada"
                    ? XCircle
                    : Clock;
              return (
                <li key={sol.id}>
                  <Link
                    href="/portal/estudiante/solicitudes"
                    className="flex items-center justify-between gap-3 rounded-control border border-linea bg-card p-2.5 transition-all duration-150 hover:-translate-y-0.5 hover:border-marca-500/40"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-marca-50 text-marca-600">
                        <Icono className="size-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-tinta">
                          {sol.titulo}
                        </p>
                        <p className="text-[11px] text-tinta-3">
                          {fechaCorta(sol.creada, locale)}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {t(`status.${sol.estado}`)}
                    </Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
