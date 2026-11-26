"use client";

import {
  Award,
  BookOpen,
  ClipboardCheck,
  GraduationCap,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Card, CardContent, CardTitle } from "@/components/ui/card";
import {
  GraficoAnillo,
  GraficoBarras,
  GraficoLinea,
  LeyendaGrafico,
  TONO,
  acortar,
} from "@/components/ui/grafico";
import { AZUL, AZUL_OSCURO, AZUL_SUAVE, NEUTRO, TINTA } from "@/lib/paleta";

/** 1) Evolución de promedio por período en `/portal/estudiante/calificaciones`. */
export function GraficoEvolucionCalificaciones({
  periodos,
}: {
  periodos: readonly { nombre: string; promedio: number; materias: number }[];
}) {
  const t = useTranslations("studentPortal.moduleCharts");

  if (periodos.length === 0) return null;

  const datos = [...periodos].reverse().map((p) => ({
    periodo: acortar(p.nombre),
    promedio: Number(p.promedio.toFixed(1)),
    materias: p.materias,
  }));

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-3 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>
            <Award className="size-4 text-marca-600" />
            {t("gradesTrendTitle")}
          </CardTitle>
        </div>

        <GraficoLinea
          datos={datos}
          claveX="periodo"
          claveY="promedio"
          nombreSerie={t("averageSeries")}
          etiqueta={t("gradesTrendTitle")}
          vacio={t("gradesTrendTitle")}
          area
          dominio={[0, 100]}
          altura={208}
        />
      </CardContent>
    </Card>
  );
}

/** 2) Estado dinámico de entregas en `/portal/estudiante/aula-virtual`. */
export function GraficoEstadoAulaVirtual({
  pendientes,
  entregadas,
  calificadas,
  vencidas,
}: {
  pendientes: number;
  entregadas: number;
  calificadas: number;
  vencidas: number;
}) {
  const t = useTranslations("studentPortal.moduleCharts");
  const total = pendientes + entregadas + calificadas + vencidas;

  if (total === 0) return null;

  const completadas = entregadas + calificadas;
  const pct = Math.round((completadas / total) * 100);

  const datos = [
    { clave: "pending", nombre: t("classroomPending"), valor: pendientes, color: AZUL },
    { clave: "submitted", nombre: t("classroomSubmitted"), valor: entregadas, color: AZUL_SUAVE },
    { clave: "graded", nombre: t("classroomGraded"), valor: calificadas, color: AZUL_OSCURO },
    { clave: "overdue", nombre: t("classroomOverdue"), valor: vencidas, color: TINTA },
  ].filter((d) => d.valor > 0);

  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-5">
        <div className="grid gap-4 sm:grid-cols-[180px_1fr] sm:items-center">
          <GraficoAnillo
            datos={datos}
            etiqueta={t("classroomChartTitle")}
            vacio={t("classroomChartTitle")}
            altura={160}
            centro={{ valor: `${pct}%`, etiqueta: t("classroomDonePct") }}
          />

          <div className="space-y-3">
            <div>
              <CardTitle>
                <ClipboardCheck className="size-4 text-marca-600" />
                {t("classroomChartTitle")}
              </CardTitle>
              <p className="mt-1 text-xs text-tinta-3">
                {t("classroomChartHint", { done: completadas, total })}
              </p>
            </div>

            <LeyendaGrafico enLista items={datos.map((d) => ({ nombre: d.nombre, color: d.color, valor: d.valor }))} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** 3) Progreso y asistencia en `/portal/estudiante/global-360`. */
export function GraficoProgresoGlobal360({
  dadas,
  pendientes,
  asistencia,
}: {
  dadas: number;
  pendientes: number;
  asistencia: readonly { materia: string; porcentaje: number | null }[];
}) {
  const t = useTranslations("studentPortal.moduleCharts");
  const total = dadas + pendientes;
  const pct = total > 0 ? Math.round((dadas / total) * 100) : 0;

  const datosAnillo = [
    { nombre: t("g360Done"), valor: dadas, color: AZUL },
    { nombre: t("g360Pending"), valor: pendientes, color: NEUTRO },
  ].filter((d) => d.valor > 0);

  const datosAsistencia = asistencia
    .filter((a) => a.porcentaje !== null)
    .map((a) => ({
      materia: acortar(a.materia),
      porcentaje: a.porcentaje ?? 0,
    }));

  if (total === 0 && datosAsistencia.length === 0) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {total > 0 && (
        <Card className="overflow-hidden">
          <CardContent className="pt-5">
            <div className="grid gap-4 sm:grid-cols-[160px_1fr] sm:items-center">
              <GraficoAnillo
                datos={datosAnillo}
                etiqueta={t("g360ProgressTitle")}
                vacio={t("g360ProgressTitle")}
                altura={144}
                centro={{ valor: `${pct}%` }}
              />

              <div className="space-y-2">
                <CardTitle>
                  <GraduationCap className="size-4 text-marca-600" />
                  {t("g360ProgressTitle")}
                </CardTitle>
                <p className="text-xs text-tinta-3">
                  {t("g360ProgressHint", { done: dadas, total })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {datosAsistencia.length > 0 && (
        <Card className="overflow-hidden">
          <CardContent className="space-y-2 pt-5">
            <CardTitle>
              <BookOpen className="size-4 text-marca-600" />
              {t("attendanceBarTitle")}
            </CardTitle>
            <GraficoBarras
              datos={datosAsistencia}
              claveX="materia"
              series={[{ clave: "porcentaje", nombre: t("attendanceSeries"), color: TONO.base }]}
              etiqueta={t("attendanceBarTitle")}
              vacio={t("attendanceBarTitle")}
              dominio={[0, 100]}
              altura={144}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/** 4) Carga de créditos por materia en `/portal/estudiante/prematricula`. */
export function GraficoCargaPrematricula({
  materias,
}: {
  materias: readonly { nombre: string; creditos: number }[];
}) {
  const t = useTranslations("studentPortal.moduleCharts");

  if (materias.length === 0) return null;

  const datos = materias.slice(0, 7).map((m) => ({
    materia: acortar(m.nombre),
    creditos: m.creditos,
  }));

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-3 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>
            <BookOpen className="size-4 text-marca-600" />
            {t("enrollmentChartTitle")}
          </CardTitle>
        </div>

        <GraficoBarras
          datos={datos}
          claveX="materia"
          series={[{ clave: "creditos", nombre: t("creditsSeries"), color: TONO.oscuro }]}
          etiqueta={t("enrollmentChartTitle")}
          vacio={t("enrollmentChartTitle")}
          altura={176}
        />
      </CardContent>
    </Card>
  );
}

