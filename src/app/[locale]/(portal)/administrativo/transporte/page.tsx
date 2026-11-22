import type { Metadata } from "next";
import { AlertTriangle, MapPin, Navigation, Users } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { MapaTransporte } from "@/components/transporte/mapa-transporte";
import { PanelAdminTransporte } from "@/components/transporte/panel-admin-transporte";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { StatCard } from "@/components/ui/stat-card";
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
  const totalPasajerosHoy = resumen.turnos.reduce(
    (suma, turno) => suma + turno.pasajeros_hoy,
    0,
  );

  return (
    <NextIntlClientProvider messages={mensajes}>
      <div className="animate-entrada mx-auto max-w-6xl space-y-6">
        <EncabezadoPagina
          antetitulo={t("eyebrow")}
          titulo={tAdmin("title")}
          subtitulo={tAdmin("subtitle")}
        />

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            icono={Navigation}
            valor={t(`status.${viajeEnVivo?.estado ?? "programado"}`)}
            etiqueta={tAdmin("kpiActiveTrip")}
            acento={viajeEnVivo?.estado === "en_curso"}
          />
          <StatCard
            icono={Users}
            valor={totalPasajerosHoy}
            etiqueta={tAdmin("kpiPassengersToday")}
          />
          <StatCard
            icono={MapPin}
            valor={paradasRuta.length}
            etiqueta={tAdmin("kpiStops")}
          />
          <StatCard
            icono={AlertTriangle}
            valor={resumen.incidenciasRecientes.length}
            etiqueta={tAdmin("kpiIncidents")}
          />
        </div>

        <MapaTransporte viajeInicial={viajeEnVivo} paradas={paradasRuta} />

        <PanelAdminTransporte
          turnosIniciales={resumen.turnos}
          pasajerosPorHorario={resumen.pasajerosPorHorario}
          incidencias={resumen.incidenciasRecientes}
        />
      </div>
    </NextIntlClientProvider>
  );
}
