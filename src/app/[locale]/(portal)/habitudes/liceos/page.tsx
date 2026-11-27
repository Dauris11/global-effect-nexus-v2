import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/app/page-header";
import { ListaLiceos } from "@/components/habitudes/lista-liceos";
import { PanelDirectorHabitudes } from "@/components/habitudes/panel-director-habitudes";
import { requerirPermiso } from "@/lib/auth";
import { listarLiceosHabitudes } from "@/server/habitudes/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });

  return { title: t("schools") };
}

/** Director: liceos con su última visita y estado, y el mapa de la red. */
export default async function PaginaLiceosHabitudes({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requerirPermiso("habitudes.supervisar");
  const [t, liceos] = await Promise.all([getTranslations({ locale, namespace: "nav" }), listarLiceosHabitudes()]);

  return (
    <div className="animate-entrada space-y-8">
      <PageHeader title={t("schools")} />
      <ListaLiceos liceos={liceos} idioma={locale === "en" ? "en" : "es"} />
      <PanelDirectorHabitudes liceos={liceos} profesores={[]} docentesDisponibles={[]} estudiantesDisponibles={[]} parte="liceos" />
    </div>
  );
}
