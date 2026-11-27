import type { Metadata } from "next";
import { Users } from "lucide-react";
import { Suspense } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/app/empty-state";
import { FilterBar } from "@/components/app/filter-bar";
import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { SelectorMes } from "@/components/app/selector-mes";
import { PlanillaServicios } from "@/components/bienestar/planilla-servicios";
import { BotonImprimir } from "@/components/comida/boton-imprimir";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirPermiso } from "@/lib/auth";
import { usuarioTienePermiso } from "@/lib/rbac";
import { planillaDelMes, ultimosDoceMeses } from "@/server/bienestar/consultas";

/** `YYYY-MM`, el formato que guarda `registro_servicio.mes`. */
const MES = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "monthlyServices" });

  return { title: t("title") };
}

/**
 * Servicios mensuales: una tarea de cumplimiento, no un reporte. Selector de mes en el encabezado y la tabla
 * de becados con tres requisitos (Servicio · Reunión · Carta al patrocinador), cada celda con su badge y,
 * las dos primeras, un clic para marcarla. El chip «Incumplen N» deja solo a quienes les falta algo. Los
 * indicadores y gráficos de antes viven en `/reportes/servicios`.
 *
 * El mes va en la URL (`?mes=`) y su valor por omisión sale de la base, no de `new Date()`.
 */
export default async function PaginaServiciosMensuales({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ mes?: string; estado?: string; faltan?: string; q?: string }>;
}) {
  const [{ locale }, { mes, estado, faltan, q }] = await Promise.all([params, searchParams]);

  const usuario = await requerirPermiso("operaciones.leer");
  const puedeEscribir = usuarioTienePermiso(usuario, "operaciones.escribir");
  const meses = await ultimosDoceMeses();
  const elegido = MES.test(mes ?? "") && meses.includes(mes!) ? mes! : (meses[0] ?? "");

  const [t, filas, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "monthlyServices" }),
    planillaDelMes(elegido),
    mensajesCliente(["monthlyServices", "comida", "estados"]),
  ]);

  // «Incumplen»: falta el servicio, la reunión o la carta al patrocinador.
  const incumple = (f: (typeof filas)[number]) =>
    !f.hizo_servicio || !f.asistio_reunion || f.correo === "no_envio" || f.correo === "tardia" || f.correo === "en_revision";
  const soloFaltan = estado === "incumplen" || faltan === "1";
  const texto = (q ?? "").trim().toLowerCase();
  const visibles = (soloFaltan ? filas.filter(incumple) : filas).filter((f) => !texto || f.nombre.toLowerCase().includes(texto));

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title={t("title")}
        secondaryActions={
          <>
            <Suspense fallback={null}>
              <SelectorMes meses={meses} valor={elegido} etiqueta={t("month")} />
            </Suspense>
            <NextIntlClientProvider messages={mensajes}>
              <BotonImprimir />
            </NextIntlClientProvider>
          </>
        }
      />
      <p className="texto-meta hidden print:block">{elegido}</p>

      <Suspense fallback={null}>
        <FilterBar
          chips={[{ value: "incumplen", label: t("incumplen"), count: filas.filter(incumple).length }]}
          totalChips={filas.length}
          placeholder={t("student")}
        />
      </Suspense>

      {visibles.length === 0 ? (
        <EmptyState icon={Users} title={t("empty")} readOnly />
      ) : (
        <NextIntlClientProvider messages={mensajes}>
          <PlanillaServicios filas={visibles} mes={elegido} puedeEscribir={puedeEscribir} />
        </NextIntlClientProvider>
      )}
    </PageContainer>
  );
}
