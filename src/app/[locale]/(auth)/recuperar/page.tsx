import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { CabeceraAcceso } from "@/components/auth/cabecera-acceso";
import { RecuperarForm } from "@/components/auth/recuperar-form";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth.recover" });

  return { title: t("metaTitle") };
}

/** «¿La olvidaste?»: pide el correo y manda el enlace. No requiere sesión ni revela qué correos existen. */
export default async function PaginaRecuperar({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth.recover" });

  return (
    <div>
      <CabeceraAcceso titulo={t("title")} subtitulo={t("subtitle")} />

      <div className="mt-8">
        <RecuperarForm />
      </div>
    </div>
  );
}
