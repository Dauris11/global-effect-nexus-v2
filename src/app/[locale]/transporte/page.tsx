import type { Metadata } from "next";
import { ArrowLeft, Bus, Clock, LogIn, Navigation } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { FormularioPuntual } from "@/components/transporte/formulario-puntual";
import { MapaTransporte } from "@/components/transporte/mapa-transporte";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import {
  listarHorariosTransporte,
  listarRutasConParadas,
  obtenerViajeEnVivo,
} from "@/server/transporte/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "transport" });

  return {
    title: t("publicTransportTitle"),
    description: t("publicTransportDesc"),
  };
}

export default async function PaginaTransportePublico({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [t, viajeEnVivo, rutas, horarios] = await Promise.all([
    getTranslations({ locale, namespace: "transport" }),
    obtenerViajeEnVivo(),
    listarRutasConParadas(),
    listarHorariosTransporte(),
  ]);

  const paradasRuta = rutas[0]?.paradas ?? [];

  return (
    <div className="min-h-dvh bg-slate-50/70 px-4 py-8 dark:bg-background">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Barra superior de navegación rápida */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild className="gap-2 text-xs">
            <Link href="/">
              <ArrowLeft className="size-3.5" />
              {t("backToHome")}
            </Link>
          </Button>

          <Button variant="outline" size="sm" asChild className="gap-2 text-xs">
            <Link href="/login">
              <LogIn className="size-3.5" />
              {t("studentLoginCta")}
            </Link>
          </Button>
        </div>

        {/* Cabecera Principal */}
        <Card className="border-linea shadow-sm">
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3.5">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-marca-500/15 text-marca-600">
                  <Bus className="size-6" />
                </span>
                <div>
                  <h1 className="text-xl font-bold text-tinta">
                    {t("publicTransportTitle")}
                  </h1>
                  <p className="text-xs text-tinta-2">
                    {t("publicTransportDesc")}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    viajeEnVivo?.estado === "en_curso"
                      ? "marca"
                      : viajeEnVivo?.estado === "averiado"
                        ? "destructive"
                        : "neutra"
                  }
                  className="px-3 py-1 text-xs"
                >
                  {t(`status.${viajeEnVivo?.estado ?? "programado"}`)}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Mapa en Vivo con la Guagua 3D */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="flex items-center gap-2 text-sm font-bold text-tinta">
              <Navigation className="size-4 text-marca-500" />
              {t("liveTrackingTitle")}
            </h2>
            <span className="text-xs text-tinta-3">
              {viajeEnVivo?.horario_nombre ?? t("nextTripScheduled")}
            </span>
          </div>

          <MapaTransporte viajeInicial={viajeEnVivo} paradas={paradasRuta} />
        </div>

        {/* Grid de Formulario de Anotarse Rápido + Horarios Diarios */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Formulario rápido para hoy */}
          <FormularioPuntual horarios={horarios} paradas={paradasRuta} />

          {/* Horarios fijos de la ruta */}
          <Card className="border-linea p-5 shadow-sm">
            <div className="border-b border-linea pb-3">
              <h3 className="flex items-center gap-2 text-base font-bold text-tinta">
                <Clock className="size-4 text-marca-500" />
                {t("officialSchedulesTitle")}
              </h3>
              <p className="text-xs text-tinta-2">
                {t("officialSchedulesSubtitle")}
              </p>
            </div>

            <ul className="mt-4 divide-y divide-linea">
              {horarios.map((h) => (
                <li key={h.id} className="flex items-center justify-between py-3 text-xs">
                  <div>
                    <p className="font-semibold text-tinta">{h.nombre}</p>
                    <p className="text-tinta-3">{h.ruta_nombre}</p>
                  </div>
                  <span className="font-bold text-marca-600 bg-marca-500/10 px-2.5 py-1 rounded-md">
                    {h.hora_salida}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

