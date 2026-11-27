import type { Metadata } from "next";
import { CalendarCheck, HeartHandshake, Mail, Users } from "lucide-react";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

import { CifraAcademica } from "@/components/academico/cifra";
import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { SelectorMes } from "@/components/app/selector-mes";
import { GraficasServicios } from "@/components/bienestar/graficas-servicios";
import { requerirPermiso } from "@/lib/auth";
import { planillaDelMes, resumenDelMes, ultimosDoceMeses } from "@/server/bienestar/consultas";

const MES = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "monthlyServices" });

  return { title: t("title") };
}

/** Reporte de servicios mensuales: los 4 indicadores y los 2 gráficos que salieron de la planilla de cumplimiento. */
export default async function ReporteServicios({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ mes?: string }>;
}) {
  const [{ locale }, { mes }] = await Promise.all([params, searchParams]);
  await requerirPermiso("operaciones.leer");
  const meses = await ultimosDoceMeses();
  const elegido = MES.test(mes ?? "") && meses.includes(mes!) ? mes! : (meses[0] ?? "");
  const [t, filas, resumen] = await Promise.all([getTranslations({ locale, namespace: "monthlyServices" }), planillaDelMes(elegido), resumenDelMes(elegido)]);

  const aplicanCarta = filas.filter((f) => f.correo !== "no_aplica").length;
  const conCarta = filas.filter((f) => f.correo === "cumplio").length;
  const conPendientes = filas.filter((f) => !f.hizo_servicio || !f.asistio_reunion || f.correo === "no_envio" || f.correo === "tardia" || f.correo === "en_revision").length;
  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title={t("title")}
        secondaryActions={
          <Suspense fallback={null}>
            <SelectorMes meses={meses} valor={elegido} etiqueta={t("month")} />
          </Suspense>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CifraAcademica valor={resumen.total} etiqueta={t("stats.called")} icono={Users} />
        <CifraAcademica valor={resumen.total > 0 ? `${pct(resumen.con_servicio, resumen.total)}%` : "—"} etiqueta={t("stats.service")} icono={HeartHandshake} acento />
        <CifraAcademica valor={resumen.total > 0 ? `${pct(resumen.con_reunion, resumen.total)}%` : "—"} etiqueta={t("stats.meeting")} icono={CalendarCheck} />
        <CifraAcademica valor={aplicanCarta > 0 ? `${pct(conCarta, aplicanCarta)}%` : "—"} etiqueta={t("stats.letter")} icono={Mail} />
      </div>
      <GraficasServicios
        alDia={Math.max(0, filas.length - conPendientes)}
        conPendientes={conPendientes}
        porcentajes={{ servicio: pct(resumen.con_servicio, resumen.total), reunion: pct(resumen.con_reunion, resumen.total), carta: pct(conCarta, aplicanCarta) }}
        etiquetas={{
          tituloBalance: t("chartBalanceTitle"),
          tituloRequisitos: t("chartBreakdownTitle"),
          alDia: t("chartUpToDate"),
          conPendientes: t("chartWithPending"),
          servicio: t("stats.service"),
          reunion: t("stats.meeting"),
          carta: t("stats.letter"),
          vacio: t("chartEmpty"),
        }}
      />
    </PageContainer>
  );
}
