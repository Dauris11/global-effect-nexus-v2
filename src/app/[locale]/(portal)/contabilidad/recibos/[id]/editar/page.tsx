import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { FormularioRecibo } from "@/components/contabilidad/recibos/formulario-recibo";
import { Card } from "@/components/ui/card";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { redirigir } from "@/i18n/navigation";
import { requerirPermiso } from "@/lib/auth";
import { claveDia } from "@/lib/fechas";
import { numeroDocumento } from "@/lib/contabilidad/formato";
import { opcionesRecibo, reciboPorId } from "@/server/contabilidad/recibos/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contab.formulario" });
  return { title: t("tituloEditar") };
}

/** Solo un borrador se edita; lo demás vuelve a su ficha. */
export default async function PaginaEditarRecibo({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  await requerirPermiso("contabilidad.registrar");

  const recibo = await reciboPorId(id);
  if (!recibo) notFound();
  if (recibo.estado !== "borrador") redirigir(`/contabilidad/recibos/${id}`, locale);

  const [t, opciones, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "contab.formulario" }),
    opcionesRecibo(),
    mensajesCliente(["contab"]),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-entrada">
      <EncabezadoPagina
        antetitulo={numeroDocumento(recibo.serie, recibo.numero)}
        titulo={t("tituloEditar")}
      />
      <Card className="p-5 md:p-6">
        <NextIntlClientProvider messages={mensajes}>
          <FormularioRecibo opciones={opciones} recibo={recibo} hoy={claveDia()} />
        </NextIntlClientProvider>
      </Card>
    </div>
  );
}
