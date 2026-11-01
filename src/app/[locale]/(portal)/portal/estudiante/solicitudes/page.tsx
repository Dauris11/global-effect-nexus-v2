import type { Metadata } from "next";
import { Inbox } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { Cabecera } from "@/components/estudiante/cabecera";
import { FormularioSolicitud } from "@/components/solicitudes/formulario-solicitud";
import { TarjetaSolicitud } from "@/components/solicitudes/tarjeta-solicitud";
import { Card } from "@/components/ui/card";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirRol } from "@/lib/auth";
import { claveDia } from "@/lib/fechas";
import { TRAMITES_ESTUDIANTE } from "@/lib/solicitudes";
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
 * Trámites del estudiante con administración (migración 0031).
 *
 * Sustituye a la cita de psicología, que desapareció con el departamento. Lo
 * que el estudiante pide ahora no es siempre una cita: una constancia, una
 * carta, un permiso. Cada trámite pasa por los mismos pasos y él ve cada uno en
 * la línea de tiempo, con el nombre de quien lo lleva.
 *
 * Solo el rol `estudiante`, y solo lo suyo: `solicitudesDe` filtra por el
 * usuario de la sesión. La única acción que le aparece es cancelar, mientras
 * nadie la haya decidido.
 */
export default async function PaginaSolicitudesEstudiante({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const usuario = await requerirRol(["estudiante"]);

  const [t, solicitudes, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "requests" }),
    solicitudesDe(usuario),
    mensajesCliente(["requests"]),
  ]);

  return (
    <div className="animate-fade-in-up mx-auto max-w-4xl space-y-10">
      <Cabecera
        eyebrow={t("studentEyebrow")}
        titulo={t("studentTitle")}
        descripcion={t("studentDescription")}
      />

      <NextIntlClientProvider messages={mensajes}>
        {/* El formulario es lo que se viene a hacer: va en su tarjeta, arriba.
            Lo ya pedido queda debajo, como lista. */}
        <section className="space-y-4">
          <h2 className="texto-titulo-seccion">{t("newTitle")}</h2>
          <Card className="p-5 md:p-6">
            <FormularioSolicitud
              origen="estudiante"
              tipos={TRAMITES_ESTUDIANTE}
              minimoFecha={claveDia()}
            />
          </Card>
        </section>

        <section className="space-y-4">
          <h2 className="texto-titulo-seccion">{t("mineTitle")}</h2>

          {solicitudes.length === 0 ? (
            <EstadoVacio icono={Inbox} titulo={t("mineEmpty")} />
          ) : (
            <ul className="space-y-3">
              {solicitudes.map((solicitud) => (
                <TarjetaSolicitud key={solicitud.id} solicitud={solicitud} />
              ))}
            </ul>
          )}
        </section>
      </NextIntlClientProvider>
    </div>
  );
}
