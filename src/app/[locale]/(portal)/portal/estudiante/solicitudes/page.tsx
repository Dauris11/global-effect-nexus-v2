import type { Metadata } from "next";
import { Inbox } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { Cabecera } from "@/components/estudiante/cabecera";
import { FormularioSolicitudDinamica } from "@/components/solicitudes/formulario-solicitud-dinamica";
import { TablaMisSolicitudes } from "@/components/solicitudes/tabla-mis-solicitudes";
import { Card } from "@/components/ui/card";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirRol } from "@/lib/auth";
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
 * Solicitudes del estudiante desde su portal (`MATERIALES`, `PASAJE`, `OTRO`).
 * Los trámites académicos fueron retirados en Etapa 2.
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
      mensajesCliente(["requests", "estados"]),
    ]);

  const catalogos = { tiposMaterial, lugaresPasaje, proveedoresEstudiantes };

  return (
    <div className="animate-entrada space-y-10">
      <Cabecera titulo={t("studentTitle")} />

      <NextIntlClientProvider messages={mensajes}>
        <section className="space-y-4">
          <h2 className="texto-titulo-seccion">{t("newTitle")}</h2>
          <Card className="p-5 md:p-6">
            <FormularioSolicitudDinamica catalogos={catalogos} />
          </Card>
        </section>

        <section className="space-y-4">
          <h2 className="texto-titulo-seccion">{t("mineTitle")}</h2>

          {solicitudes.length === 0 ? (
            <EstadoVacio icono={Inbox} titulo={t("mineEmpty")} />
          ) : (
            <TablaMisSolicitudes filas={solicitudes} catalogos={catalogos} />
          )}
        </section>
      </NextIntlClientProvider>
    </div>
  );
}
