import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { PanelPasaje } from "@/components/contabilidad/pasaje/panel-pasaje";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirPermiso } from "@/lib/auth";
import { usuarioTienePermiso } from "@/lib/rbac";
import { listarSolicitudesPasaje } from "@/server/contabilidad/pasaje/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contab.pasaje" });
  return { title: t("titulo") };
}

/**
 * Módulo «Contabilidad > Pasaje» (Etapa 3) con pestañas «Solicitudes» e «Historial».
 */
export default async function PaginaPasajeContabilidad({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ locale }, { tab }] = await Promise.all([params, searchParams]);
  const usuario = await requerirPermiso("contabilidad.leer");

  const [t, datos, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "contab.pasaje" }),
    listarSolicitudesPasaje(),
    mensajesCliente(["contab", "requests", "estados"]),
  ]);

  const puedeRegistrar = usuarioTienePermiso(usuario, "contabilidad.registrar");
  const tabInicial = tab === "historial" ? "historial" : "solicitudes";

  return (
    <PageContainer className="animate-entrada space-y-6">
      <PageHeader title={t("titulo")} />

      <NextIntlClientProvider messages={mensajes}>
        <PanelPasaje
          solicitudes={datos.solicitudes}
          historial={datos.historial}
          puedeRegistrar={puedeRegistrar}
          tabInicial={tabInicial}
        />
      </NextIntlClientProvider>
    </PageContainer>
  );
}
