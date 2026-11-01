import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { SuiteCalculadoras } from "@/components/contabilidad/calculadoras/suite-calculadoras";
import { requerirPermiso } from "@/lib/auth";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contab.calculadoras" });
  return { title: t("titulo") };
}

export default async function PaginaCalculadoras({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requerirPermiso("contabilidad.leer");

  const t = await getTranslations({ locale, namespace: "contab.calculadoras" });

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-entrada">
      <EncabezadoPagina
        titulo={t("titulo")}
      />

      <SuiteCalculadoras />
    </div>
  );
}
