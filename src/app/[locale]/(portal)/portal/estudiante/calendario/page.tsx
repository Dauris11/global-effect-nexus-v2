import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { Cabecera } from "@/components/estudiante/cabecera";
import { CalendarioMensualEstudiante } from "@/components/estudiante/calendario-mensual-estudiante";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import type { Locale } from "@/i18n/routing";
import { requerirRol } from "@/lib/auth";
import { claveDia, claveMes } from "@/lib/fechas";
import { agendaDelEstudiante } from "@/server/estudiantes/agenda";
import { estudianteDeUsuario } from "@/server/estudiantes/portal";

const MES_VALIDO = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "studentPortal" });

  return { title: t("agenda.title") };
}

/**
 * Calendario mensual del estudiante:
 * eventos, vencimientos de tareas/exámenes, clases proyectadas, reuniones y
 * trámites con fecha en una rejilla de mes completa con navegación libre.
 */
export default async function PaginaCalendario({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ mes?: string }>;
}) {
  const { locale } = await params;
  const { mes: mesPedido } = await searchParams;
  const idioma: Locale = locale === "en" ? "en" : "es";

  const usuario = await requerirRol(["estudiante"]);
  const estudiante = await estudianteDeUsuario(usuario.id);

  const hoy = claveDia();
  const mesActual = claveMes();
  const mes = mesPedido && MES_VALIDO.test(mesPedido) ? mesPedido : mesActual;

  const [t, mensajes, entradas] = await Promise.all([
    getTranslations({ locale, namespace: "studentPortal" }),
    mensajesCliente(["studentPortal"]),
    agendaDelEstudiante(estudiante.id, mes, usuario.id),
  ]);

  return (
    <div className="animate-entrada mx-auto max-w-6xl space-y-6">
      <Cabecera titulo={t("agenda.title")} />

      <NextIntlClientProvider messages={mensajes}>
        <CalendarioMensualEstudiante
          mes={mes}
          hoy={hoy}
          entradas={entradas}
          locale={idioma}
        />
      </NextIntlClientProvider>
    </div>
  );
}
