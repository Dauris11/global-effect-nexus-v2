import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { HubReuniones } from "@/components/reuniones/hub-reuniones";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirPermiso } from "@/lib/auth";
import { usuarioTienePermiso } from "@/lib/rbac";
import {
  listarCandidatosParticipantes,
  listarReuniones,
  metricasReuniones,
} from "@/server/reuniones/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "reuniones" });
  return { title: t("title") };
}

/**
 * Agenda Institucional de Reuniones y Tutorías.
 *
 * Sustituye completamente el antiguo módulo clínico de psicología:
 * Centraliza las reuniones de coordinación interna, sesiones de tutoría
 * académica, seguimiento con estudiantes y acuerdos de dirección.
 */
export default async function PaginaReuniones({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ agendar?: string }>;
}) {
  const { locale } = await params;
  const { agendar } = await searchParams;

  const usuario = await requerirPermiso("reuniones.leer");
  const puedeGestionar = usuarioTienePermiso(usuario, "reuniones.gestionar");
  const puedeAgendar = usuarioTienePermiso(usuario, "reuniones.agendar");

  const [t, reuniones, candidatos, metricas, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "reuniones" }),
    listarReuniones({ usuarioId: usuario.id, rol: usuario.rol }),
    listarCandidatosParticipantes({ usuarioId: usuario.id, rol: usuario.rol }),
    metricasReuniones({ usuarioId: usuario.id, rol: usuario.rol }),
    mensajesCliente(["reuniones"]),
  ]);

  return (
    <div className="animate-entrada mx-auto max-w-7xl space-y-6">
      <EncabezadoPagina titulo={t("title")} />

      <NextIntlClientProvider messages={mensajes}>
        <HubReuniones
          reunionesIniciales={reuniones}
          candidatos={candidatos}
          metricas={metricas}
          usuarioActualId={usuario.id}
          puedeGestionar={puedeGestionar}
          puedeAgendar={puedeAgendar}
          abrirAgendarAlCargar={agendar === "true"}
        />
      </NextIntlClientProvider>
    </div>
  );
}
