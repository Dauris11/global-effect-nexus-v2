import type { Metadata } from "next";
import { Bus, CalendarCheck, Clock, Navigation } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Cabecera } from "@/components/estudiante/cabecera";
import { FormularioRecurrente } from "@/components/transporte/formulario-recurrente";
import { MapaTransporte } from "@/components/transporte/mapa-transporte";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requerirRol } from "@/lib/auth";
import { estudianteDeUsuario } from "@/server/estudiantes/portal";
import {
  listarHorariosTransporte,
  listarRutasConParadas,
  obtenerInscripcionesRecurrentesEstudiante,
  obtenerViajeEnVivo,
} from "@/server/transporte/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "transport" });

  return { title: t("studentTransportTitle") };
}

export default async function PaginaTransporteEstudiante({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const usuario = await requerirRol(["estudiante", "admin", "super_admin"]);
  const estudiante = await estudianteDeUsuario(usuario.id);

  const [t, viajeEnVivo, rutas, horarios, inscripciones] = await Promise.all([
    getTranslations({ locale, namespace: "transport" }),
    obtenerViajeEnVivo(),
    listarRutasConParadas(),
    listarHorariosTransporte(),
    obtenerInscripcionesRecurrentesEstudiante(estudiante.id),
  ]);

  const paradasRuta = rutas[0]?.paradas ?? [];

  return (
    <div className="animate-fade-in-up mx-auto max-w-5xl space-y-6">
      <Cabecera
        eyebrow={t("eyebrow")}
        titulo={t("studentTransportTitle")}
        descripcion={t("studentTransportDesc")}
      />

      <Tabs defaultValue="mapa" className="space-y-5">
        <TabsList className="grid w-full grid-cols-2 sm:w-80">
          <TabsTrigger value="mapa" className="gap-2">
            <Navigation className="size-4" />
            {t("liveTrackingTab")}
          </TabsTrigger>
          <TabsTrigger value="horario" className="gap-2">
            <CalendarCheck className="size-4" />
            {t("weeklyScheduleTab")}
          </TabsTrigger>
        </TabsList>

        {/* Pestaña 1: Dónde viene la guagua en vivo */}
        <TabsContent value="mapa" className="space-y-4">
          <MapaTransporte viajeInicial={viajeEnVivo} paradas={paradasRuta} />

          {/* Información de paradas y orden del viaje */}
          <div className="rounded-card border border-linea bg-card p-5 shadow-card">
            <h3 className="texto-titulo-tarjeta flex items-center gap-2">
              <Bus className="size-4 text-marca-500" />
              {t("routeStopsTitle")}
            </h3>
            <p className="mt-1 text-xs text-tinta-2">
              {t("routeStopsSubtitle")}
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {paradasRuta.map((p) => (
                <div
                  key={p.id}
                  className="flex items-start gap-3 rounded-control border border-linea bg-muted/30 p-3 text-sm"
                >
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-marca-500/15 font-bold text-marca-600">
                    {p.orden}
                  </span>
                  <div>
                    <p className="font-semibold text-tinta">{p.nombre}</p>
                    {p.referencia && (
                      <p className="texto-meta">{p.referencia}</p>
                    )}
                    <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-marca-700">
                      <Clock className="size-3" />+{p.minutos_estimados} min
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Pestaña 2: Mi horario semanal */}
        <TabsContent value="horario">
          <FormularioRecurrente
            inscripcionesIniciales={inscripciones}
            horarios={horarios}
            paradas={paradasRuta}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

