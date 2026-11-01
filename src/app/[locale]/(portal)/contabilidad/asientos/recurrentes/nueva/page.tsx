import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { FormularioPlantilla } from "@/components/contabilidad/asientos/formularios";
import { Card } from "@/components/ui/card";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirPermiso } from "@/lib/auth";
import { cuentasDeMovimiento } from "@/server/contabilidad/asientos/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contab.asientos.plantillas.formulario" });
  return { title: t("titulo") };
}

export default async function PaginaNuevaPlantilla({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requerirPermiso("contabilidad.asiento_manual");

  const [t, tc, cuentas, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "contab.asientos.plantillas.formulario" }),
    getTranslations({ locale, namespace: "contab" }),
    cuentasDeMovimiento(),
    mensajesCliente(["contab"]),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-entrada">
      <EncabezadoPagina titulo={t("titulo")} />
      <Card className="p-5 md:p-6">
        <NextIntlClientProvider messages={mensajes}>
          <FormularioPlantilla cuentas={cuentas} />
        </NextIntlClientProvider>
      </Card>
    </div>
  );
}
