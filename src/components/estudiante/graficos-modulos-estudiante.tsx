"use client";

import {
  Award,
  BookOpen,
  ClipboardCheck,
  GraduationCap,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Area,
  AreaChart,
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

import { Card, CardContent, CardTitle } from "@/components/ui/card";
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
    periodo: p.nombre.length > 14 ? `${p.nombre.slice(0, 13)}…` : p.nombre,
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
          <span className="text-xs text-tinta-3">{t("gradesTrendHint")}</span>
        </div>

        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={datos}
              margin={{ top: 10, right: 12, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.25} />
              <XAxis
                dataKey="periodo"
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "10px",
                  borderColor: "var(--border)",
                  fontSize: "12px",
                }}
              />
              <Area
                type="monotone"
                dataKey="promedio"
                name={t("averageSeries")}
                stroke={AZUL_OSCURO}
                strokeWidth={2.5}
                fill={AZUL_SUAVE}
                fillOpacity={0.35}
                animationDuration={700}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
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
          <div className="relative h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={datos}
                  dataKey="valor"
                  nameKey="nombre"
                  innerRadius={44}
                  outerRadius={66}
                  paddingAngle={3}
                  animationDuration={650}
                >
                  {datos.map((d) => (
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
              <span className="text-lg font-bold text-tinta">{pct}%</span>
              <span className="text-[10px] text-tinta-3">{t("classroomDonePct")}</span>
            </div>
          </div>

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

            <div className="grid grid-cols-2 gap-2 text-xs">
              {datos.map((d) => (
                <div
                  key={d.clave}
                  className="flex items-center justify-between rounded-control border border-linea bg-muted/30 px-2.5 py-1.5"
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
      materia: a.materia.length > 14 ? `${a.materia.slice(0, 13)}…` : a.materia,
      porcentaje: a.porcentaje ?? 0,
    }));

  if (total === 0 && datosAsistencia.length === 0) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {total > 0 && (
        <Card className="overflow-hidden">
          <CardContent className="pt-5">
            <div className="grid gap-4 sm:grid-cols-[160px_1fr] sm:items-center">
              <div className="relative h-36 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={datosAnillo}
                      dataKey="valor"
                      nameKey="nombre"
                      innerRadius={40}
                      outerRadius={60}
                      paddingAngle={3}
                      animationDuration={650}
                    >
                      {datosAnillo.map((d) => (
                        <Cell key={d.nombre} fill={d.color} />
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
                  <span className="text-lg font-bold text-tinta">{pct}%</span>
                </div>
              </div>

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
            <div className="h-36 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={datosAsistencia}
                  margin={{ top: 6, right: 8, left: -24, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.25} />
                  <XAxis dataKey="materia" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "10px",
                      borderColor: "var(--border)",
                      fontSize: "12px",
                    }}
                  />
                  <Bar
                    dataKey="porcentaje"
                    name={t("attendanceSeries")}
                    fill={AZUL}
                    radius={[5, 5, 0, 0]}
                    animationDuration={650}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
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
    materia: m.nombre.length > 14 ? `${m.nombre.slice(0, 13)}…` : m.nombre,
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
          <span className="text-xs text-tinta-3">{t("enrollmentChartHint")}</span>
        </div>

        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={datos}
              margin={{ top: 8, right: 8, left: -24, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.25} />
              <XAxis dataKey="materia" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  borderRadius: "10px",
                  borderColor: "var(--border)",
                  fontSize: "12px",
                }}
              />
              <Bar
                dataKey="creditos"
                name={t("creditsSeries")}
                fill={AZUL_OSCURO}
                radius={[5, 5, 0, 0]}
                animationDuration={650}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

