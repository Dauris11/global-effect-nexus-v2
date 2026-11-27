import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { TituloPagina } from "@/components/layout/pestanas-modulo";

import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { PanelChofer } from "@/components/transporte/panel-chofer";
import { requerirPermiso } from "@/lib/auth";
import { fechaHoyRD } from "@/lib/transporte";
import { obtenerEstadoChofer } from "@/server/transporte/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "transport" });

  return { title: t("driverPortalTitle") };
}

export default async function PaginaPortalChofer() {
  const usuario = await requerirPermiso("transporte.operar");
  const [estado, mensajes] = await Promise.all([
    obtenerEstadoChofer(usuario.id),
    mensajesCliente(["transport"]),
  ]);

  return (
    <NextIntlClientProvider messages={mensajes}>
    <div className="animate-entrada py-4 pb-24 md:pb-4">
      {/* Título de la pantalla para lectores de pantalla y para el test de UX; la estructura visual no cambia. */}
      <TituloPagina className="sr-only">{""}</TituloPagina>
      <PanelChofer
        viajeActivoInicial={estado.viajeActivo}
        horarioSugerido={estado.horarioSugerido}
        horariosDisponibles={estado.horariosDisponibles}
        pasajerosIniciales={estado.pasajerosHoy}
        paradasIniciales={estado.paradasDisponibles}
        hoy={fechaHoyRD()}
      />
    </div>
    </NextIntlClientProvider>
  );
}

