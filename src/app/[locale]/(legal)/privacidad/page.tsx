import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { PaginaLegal } from "@/components/legal/pagina-legal";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal" });

  return { title: t("privacidad.meta") };
}

export default async function PaginaPrivacidad({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  return <PaginaLegal clave="privacidad" locale={locale} />;
}
