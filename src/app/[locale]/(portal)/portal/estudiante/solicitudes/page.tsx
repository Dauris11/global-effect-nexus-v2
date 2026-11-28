import type { Metadata } from "next";
import { Inbox } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { Cabecera } from "@/components/estudiante/cabecera";
import { FormularioSolicitud } from "@/components/solicitudes/formulario-solicitud";
import { FormularioSolicitudDinamica } from "@/components/solicitudes/formulario-solicitud-dinamica";
import { TarjetaSolicitud } from "@/components/solicitudes/tarjeta-solicitud";
import { Card } from "@/components/ui/card";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirRol } from "@/lib/auth";
import { claveDia } from "@/lib/fechas";
import { TRAMITES_ESTUDIANTE } from "@/lib/solicitudes";
import { proveedoresActivosPorProposito } from "@/server/contabilidad/proveedores/consultas";
import {
  listarLugaresPasaje,
  listarTiposMaterial,
} from "@/server/parametros/catalogos-consultas";
import { solicitudesDe } from "@/server/solicitudes/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "requests" });

  return { title: t("studentTitle") };
}

/**
 * Solicitudes y trámites del estudiante desde su portal.
 * Incluye los 3 tipos dinámicos (`MATERIALES`, `PASAJE`, `OTRO`) y los trámites
 * académicos tradicionales (`constancia`, `carta`, `cita_administracion`, `permiso`, `otro`).
 */
export default async function PaginaSolicitudesEstudiante({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const usuario = await requerirRol(["estudiante"]);

  const [t, solicitudes, tiposMaterial, lugaresPasaje, proveedoresEstudiantes, mensajes] =
    await Promise.all([
      getTranslations({ locale, namespace: "requests" }),
      solicitudesDe(usuario),
      listarTiposMaterial(true),
      listarLugaresPasaje(true),
      proveedoresActivosPorProposito("estudiantes"),
      mensajesCliente(["requests"]),
    ]);

  const catalogos = { tiposMaterial, lugaresPasaje, proveedoresEstudiantes };

  return (
    <div className="animate-entrada space-y-10">
      <Cabecera titulo={t("studentTitle")} />

      <NextIntlClientProvider messages={mensajes}>
        <section className="space-y-4">
          <h2 className="texto-titulo-seccion">{t("newTitle")}</h2>
          <Card className="p-5 md:p-6">
            <Tabs defaultValue="dinamicas" className="space-y-4">
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="dinamicas">{t("dinamica.tabSolicitudes")}</TabsTrigger>
                <TabsTrigger value="tramites">{t("dinamica.tabTramites")}</TabsTrigger>
              </TabsList>
              <TabsContent value="dinamicas">
                <FormularioSolicitudDinamica catalogos={catalogos} />
              </TabsContent>
              <TabsContent value="tramites">
                <FormularioSolicitud
                  origen="estudiante"
                  tipos={TRAMITES_ESTUDIANTE}
                  minimoFecha={claveDia()}
                />
              </TabsContent>
            </Tabs>
          </Card>
        </section>

        <section className="space-y-4">
          <h2 className="texto-titulo-seccion">{t("mineTitle")}</h2>

          {solicitudes.length === 0 ? (
            <EstadoVacio icono={Inbox} titulo={t("mineEmpty")} />
          ) : (
            <ul className="space-y-3">
              {solicitudes.map((solicitud) => (
                <TarjetaSolicitud
                  key={solicitud.id}
                  solicitud={solicitud}
                  catalogos={catalogos}
                />
              ))}
            </ul>
          )}
        </section>
      </NextIntlClientProvider>
    </div>
  );
}
