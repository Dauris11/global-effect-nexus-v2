import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/app/page-header";
import { HubRecursos } from "@/components/habitudes/hub-recursos";
import { requerirPermiso } from "@/lib/auth";
import { usuarioTienePermiso } from "@/lib/rbac";
import { listarRecursosHabitudes } from "@/server/habitudes/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "habitudes" });

  return { title: t("tabResources") };
}

/** Biblioteca de recursos: buscador, chips por tipo y tarjetas con su miniatura. */
export default async function PaginaRecursosHabitudes({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const usuario = await requerirPermiso("habitudes.recursos.leer");
  const [t, recursos] = await Promise.all([
    getTranslations({ locale, namespace: "habitudes" }),
    listarRecursosHabitudes(),
  ]);

  return (
    <div className="animate-entrada space-y-6">
      <PageHeader title={t("tabResources")} />
      <HubRecursos recursosIniciales={recursos} puedeSubir={usuarioTienePermiso(usuario, "habitudes.recursos.subir")} />
    </div>
  );
}
