import type { Metadata } from "next";
import { ChevronRight } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { MapaTransporte } from "@/components/transporte/mapa-transporte";
import { PanelAdminTransporte } from "@/components/transporte/panel-admin-transporte";
import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirPermiso } from "@/lib/auth";
import {
  listarRutasConParadas,
  obtenerResumenAdminTransporte,
  obtenerViajeEnVivo,
} from "@/server/transporte/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "transport.admin" });

  return { title: t("title") };
}

/**
 * Gestión operativa del Transporte Institucional (`/administrativo/transporte`).
 * Protegida por el permiso `transporte.gestionar`.
 */
export default async function PaginaAdminTransporte({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requerirPermiso("transporte.gestionar");

  const [t, tAdmin, viajeEnVivo, rutas, resumen, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "transport" }),
    getTranslations({ locale, namespace: "transport.admin" }),
    obtenerViajeEnVivo(),
    listarRutasConParadas(),
    obtenerResumenAdminTransporte(),
    mensajesCliente(["transport"]),
  ]);

  const paradasRuta = rutas[0]?.paradas ?? [];

  return (
    <NextIntlClientProvider messages={mensajes}>
      <PageContainer className="space-y-6">
        <PageHeader title={tAdmin("title")} />

        {/* Primero el estado de los viajes de hoy (turno, chofer, estado, pasajeros) y sus incidencias; el mapa va
            debajo, plegado: se abre cuando hace falta ver dónde va la guagua. Las cuatro tarjetas de antes son
            ahora la línea de estado de cada viaje. */}
        <PanelAdminTransporte
          turnosIniciales={resumen.turnos}
          pasajerosPorHorario={resumen.pasajerosPorHorario}
          incidencias={resumen.incidenciasRecientes}
        />

        <details className="group/mapa rounded-card border border-linea bg-card">
          <summary className="text-section flex min-h-12 cursor-pointer list-none items-center gap-2 px-4">
            <ChevronRight aria-hidden className="size-4 transition-transform group-open/mapa:rotate-90" />
            {t(`status.${viajeEnVivo?.estado ?? "programado"}`)} · {tAdmin("mapTitle")}
          </summary>
          <div className="border-t border-linea p-2">
            <MapaTransporte viajeInicial={viajeEnVivo} paradas={paradasRuta} />
          </div>
        </details>
      </PageContainer>
    </NextIntlClientProvider>
  );
}
