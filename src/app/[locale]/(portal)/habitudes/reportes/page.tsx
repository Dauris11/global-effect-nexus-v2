import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/app/page-header";
import { GraficoImpacto } from "@/components/habitudes/grafico-impacto";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirPermiso } from "@/lib/auth";
import { reporteImpactoHabitudes } from "@/server/habitudes/consultas";
import { NextIntlClientProvider } from "next-intl";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });

  return { title: t("impactReports") };
}

/** Director: impacto del programa por mes y por liceo. */
export default async function PaginaReportesHabitudes({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requerirPermiso("habitudes.supervisar");
  const [t, tr, reporte, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "nav" }),
    getTranslations({ locale, namespace: "habitudes.reports" }),
    reporteImpactoHabitudes(),
    mensajesCliente(["habitudes"]),
  ]);

  return (
    <div className="animate-entrada space-y-8">
      <PageHeader title={t("impactReports")} />

      <section className="space-y-3">
        <h2 className="text-section">{tr("byMonth")}</h2>
        <NextIntlClientProvider messages={mensajes}>
          <GraficoImpacto meses={reporte.porMes} />
        </NextIntlClientProvider>
      </section>

      <section className="space-y-3">
        <h2 className="text-section">{tr("bySchool")}</h2>
        <div className="overflow-x-auto rounded-card border border-linea bg-card">
          <table className="w-full text-sm">
            <thead className="text-meta border-b border-linea text-left">
              <tr>
                <th className="px-4 py-3 font-medium">{tr("school")}</th>
                <th className="px-4 py-3 text-right font-medium">{tr("visits")}</th>
                <th className="px-4 py-3 text-right font-medium">{tr("students")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-linea">
              {reporte.porLiceo.map((l) => (
                <tr key={l.liceo}>
                  <td className="px-4 py-3">{l.liceo}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{l.visitas}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{l.estudiantes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
