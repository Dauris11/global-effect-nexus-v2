import type { Metadata } from "next";
import { ArrowLeft, Plus, Repeat } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { ListaPlantillas } from "@/components/contabilidad/asientos/lista-plantillas";
import { Button } from "@/components/ui/button";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { Link } from "@/i18n/navigation";
import { requerirPermiso } from "@/lib/auth";
import { usuarioTienePermiso } from "@/lib/rbac";
import { plantillasRecurrentes } from "@/server/contabilidad/asientos/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contab.asientos.plantillas" });
  return { title: t("titulo") };
}

/**
 * Plantillas de asientos que se repiten (alquiler, depreciación fija…).
 * Nunca se generan solas: alguien pulsa "Generar el de este mes", y ese
 * alguien queda en la bitácora.
 */
export default async function PaginaRecurrentes({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const idioma = locale === "en" ? "en" : "es";
  const usuario = await requerirPermiso("contabilidad.leer");

  const [t, tc, plantillas, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "contab.asientos.plantillas" }),
    getTranslations({ locale, namespace: "contab" }),
    plantillasRecurrentes(),
    mensajesCliente(["contab"]),
  ]);
  const opera = usuarioTienePermiso(usuario, "contabilidad.asiento_manual");
  const nueva = opera && (
    <Button asChild>
      <Link href="/contabilidad/asientos/recurrentes/nueva">
        <Plus className="size-4" />
        {t("nueva")}
      </Link>
    </Button>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link
        href="/contabilidad/asientos"
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-marca-600 hover:underline"
      >
        <ArrowLeft className="size-4" />
        {t("volver")}
      </Link>

      <EncabezadoPagina antetitulo={tc("area")} titulo={t("titulo")} subtitulo={t("subtitulo")} acciones={nueva} />

      {plantillas.length === 0 ? (
        <EstadoVacio icono={Repeat} titulo={t("vacio")} texto={t("vacioTexto")} accion={nueva || undefined} />
      ) : (
        <NextIntlClientProvider messages={mensajes}>
          <ListaPlantillas plantillas={plantillas} puedeOperar={opera} idioma={idioma} />
        </NextIntlClientProvider>
      )}
    </div>
  );
}
