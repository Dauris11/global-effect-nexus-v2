import type { Metadata } from "next";
import { CalendarCheck, Navigation, Users } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { Cabecera } from "@/components/estudiante/cabecera";
import { Invitados } from "@/components/transporte/invitados";
import { FormularioRecurrente } from "@/components/transporte/formulario-recurrente";
import { MapaTransporte } from "@/components/transporte/mapa-transporte";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requerirRol } from "@/lib/auth";
import { fechaHoyRD } from "@/lib/transporte";
import { estudianteDeUsuario } from "@/server/estudiantes/portal";
import {
  listarHorariosTransporte,
  invitadosDeUsuario,
  listarRutasConParadas,
  obtenerInscripcionesRecurrentesEstudiante,
  obtenerViajeEnVivo,
  viviendaEstudiante,
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

  const [t, viajeEnVivo, rutas, horarios, inscripciones, invitados, vivienda, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "transport" }),
    obtenerViajeEnVivo(),
    listarRutasConParadas(),
    listarHorariosTransporte(),
    obtenerInscripcionesRecurrentesEstudiante(estudiante.id),
    invitadosDeUsuario(usuario.id),
    viviendaEstudiante(estudiante.id),
    mensajesCliente(["transport"]),
  ]);

  const paradasRuta = rutas[0]?.paradas ?? [];

  return (
    <NextIntlClientProvider messages={mensajes}>
    <div className="animate-entrada mx-auto max-w-5xl space-y-6">
      <Cabecera
        titulo={t("studentTransportTitle")}
      />

      <Tabs defaultValue="mapa" className="space-y-5">
        <TabsList className="grid w-full grid-cols-3 sm:w-[28rem]">
          <TabsTrigger value="mapa" className="gap-2">
            <Navigation className="size-4" />
            {t("liveTrackingTab")}
          </TabsTrigger>
          <TabsTrigger value="horario" className="gap-2">
            <CalendarCheck className="size-4" />
            {t("weeklyScheduleTab")}
          </TabsTrigger>
          <TabsTrigger value="invitados" className="gap-2">
            <Users className="size-4" />
            {t("guestsTab")}
          </TabsTrigger>
        </TabsList>

        {/* Pestaña 1: Dónde viene la guagua en vivo */}
        <TabsContent value="mapa" className="space-y-4">
          <MapaTransporte
            viajeInicial={viajeEnVivo}
            paradas={paradasRuta}
            vivienda={vivienda}
          />
        </TabsContent>

        {/* Pestaña 3: personas que inscribí */}
        <TabsContent value="invitados">
          <Invitados
            invitados={invitados}
            horarios={horarios}
            paradas={paradasRuta}
            hoy={fechaHoyRD()}
          />
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
    </NextIntlClientProvider>
  );
}

