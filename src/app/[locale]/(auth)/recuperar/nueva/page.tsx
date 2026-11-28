import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { CabeceraAcceso } from "@/components/auth/cabecera-acceso";
import { ClaveNueva } from "@/components/auth/clave-nueva";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth.newPassword" });

  return { title: t("metaTitle") };
}

/** A donde llega el enlace del correo «Reset password»: elige la contraseña nueva y entra a `/inicio`. */
export default async function PaginaClaveNueva({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth.newPassword" });

  return (
    <div>
      <CabeceraAcceso titulo={t("title")} subtitulo={t("subtitle")} />

      <div className="mt-8">
        <ClaveNueva />
      </div>
    </div>
  );
}
