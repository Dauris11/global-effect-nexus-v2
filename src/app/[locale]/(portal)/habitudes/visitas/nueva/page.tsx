import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/app/page-header";
import { FormularioVisita } from "@/components/habitudes/formulario-visita";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirPermiso } from "@/lib/auth";
import { claveDia } from "@/lib/fechas";
import { listarLiceosHabitudes } from "@/server/habitudes/consultas";
import { NextIntlClientProvider } from "next-intl";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "habitudes" });

  return { title: t("tabLogVisit") };
}

/** Registrar visita: cuatro campos y «Más detalles», hecho para el celular. */
export default async function PaginaRegistrarVisita({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requerirPermiso("habitudes.evidencias.subir");
  const [t, liceos, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "habitudes" }),
    listarLiceosHabitudes(),
    mensajesCliente(["habitudes"]),
  ]);

  return (
    <div className="animate-entrada mx-auto max-w-xl space-y-6">
      <PageHeader title={t("tabLogVisit")} />
      <NextIntlClientProvider messages={mensajes}>
        <FormularioVisita liceos={liceos} hoy={claveDia()} />
      </NextIntlClientProvider>
    </div>
  );
}
