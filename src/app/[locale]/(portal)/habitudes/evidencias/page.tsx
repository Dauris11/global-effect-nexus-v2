import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/app/page-header";
import { GaleriaEvidencias } from "@/components/habitudes/galeria-evidencias";
import { requerirPermiso } from "@/lib/auth";
import { usuarioTienePermiso } from "@/lib/rbac";
import { listarLiceosHabitudes, listarVisitasEvidenciasHabitudes } from "@/server/habitudes/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "habitudes" });

  return { title: t("tabEvidences") };
}

/** Galería de evidencias de las visitas; quien tiene permiso las da por auditadas. */
export default async function PaginaEvidenciasHabitudes({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const usuario = await requerirPermiso("habitudes.recursos.leer");
  const [t, visitas, liceos] = await Promise.all([
    getTranslations({ locale, namespace: "habitudes" }),
    listarVisitasEvidenciasHabitudes(),
    listarLiceosHabitudes(),
  ]);

  return (
    <div className="animate-entrada space-y-6">
      <PageHeader title={t("tabEvidences")} />
      <GaleriaEvidencias
        visitasIniciales={visitas}
        liceos={liceos}
        puedeAuditar={usuarioTienePermiso(usuario, "habitudes.evidencias.auditar")}
      />
    </div>
  );
}
