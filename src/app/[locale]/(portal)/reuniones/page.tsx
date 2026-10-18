import type { Metadata } from "next";
import { Users } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { HubReuniones } from "@/components/reuniones/hub-reuniones";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirUsuario } from "@/lib/auth";
import { tienePermiso } from "@/lib/rbac";
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

  const usuario = await requerirUsuario();
  const puedeLeer = tienePermiso(usuario.rol, "reuniones.leer");
  const puedeGestionar = tienePermiso(usuario.rol, "reuniones.gestionar");

  if (!puedeLeer) {
    return (
      <div className="mx-auto max-w-4xl p-8 text-center text-tinta-2">
        No tienes permiso para consultar las reuniones institucionales.
      </div>
    );
  }

  const [t, reuniones, candidatos, metricas, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "reuniones" }),
    listarReuniones({ usuarioId: usuario.id, rol: usuario.rol }),
    listarCandidatosParticipantes(),
    metricasReuniones(),
    mensajesCliente(["reuniones"]),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-1 border-b border-linea pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-marca-600">
            <Users className="size-5" />
            <span className="text-xs font-semibold uppercase tracking-wider text-tinta-2">
              {t("eyebrow")}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-tinta sm:text-3xl">
            {t("title")}
          </h1>
          <p className="text-sm text-tinta-2 max-w-2xl">
            {t("description")}
          </p>
        </div>
      </div>

      <NextIntlClientProvider messages={mensajes}>
        <HubReuniones
          reunionesIniciales={reuniones}
          candidatos={candidatos}
          metricas={metricas}
          usuarioActualId={usuario.id}
          puedeGestionar={puedeGestionar}
          abrirAgendarAlCargar={agendar === "true"}
        />
      </NextIntlClientProvider>
    </div>
  );
}
