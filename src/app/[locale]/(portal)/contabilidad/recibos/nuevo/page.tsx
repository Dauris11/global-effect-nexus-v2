import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { FormularioRecibo } from "@/components/contabilidad/recibos/formulario-recibo";
import { Card } from "@/components/ui/card";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirPermiso } from "@/lib/auth";
import { claveDia } from "@/lib/fechas";
import { opcionesRecibo } from "@/server/contabilidad/recibos/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contab.formulario" });
  return { title: t("tituloNuevo") };
}

export default async function PaginaNuevoRecibo({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requerirPermiso("contabilidad.registrar");

  const [t, tc, opciones, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "contab.formulario" }),
    getTranslations({ locale, namespace: "contab" }),
    opcionesRecibo(),
    mensajesCliente(["contab"]),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <EncabezadoPagina antetitulo={tc("area")} titulo={t("tituloNuevo")} subtitulo={t("subtitulo")} />
      <Card className="p-5 md:p-6">
        <NextIntlClientProvider messages={mensajes}>
          <FormularioRecibo opciones={opciones} hoy={claveDia()} />
        </NextIntlClientProvider>
      </Card>
    </div>
  );
}
