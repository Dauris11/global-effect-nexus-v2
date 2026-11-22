import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { EstablecerClave } from "@/components/auth/establecer-clave";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth.setPassword" });

  return { title: t("title") };
}

/** A donde llega quien recibió la invitación por correo: elige su contraseña y entra. */
export default async function PaginaEstablecerClave({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth.setPassword" });

  return (
    <div className="mx-auto w-full max-w-md space-y-6 rounded-hoja bg-card p-6 shadow-elevada sm:p-8">
      <Image src="/logo.webp" alt="" width={180} height={39} priority />
      <h1 className="texto-titulo-seccion">{t("title")}</h1>
      <EstablecerClave />
    </div>
  );
}
