import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { Cabecera } from "@/components/estudiante/cabecera";
import { CalendarioMensualEstudiante } from "@/components/estudiante/calendario-mensual-estudiante";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirRol } from "@/lib/auth";
import { esVistaCalendario } from "@/lib/calendario";
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
 * trámites con fecha en el calendario base, con mes, semana, día y lista.
 */
export default async function PaginaCalendario({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ mes?: string; vista?: string }>;
}) {
  const { locale } = await params;
  const { mes: mesPedido, vista: vistaPedida } = await searchParams;

  const usuario = await requerirRol(["estudiante"]);
  const estudiante = await estudianteDeUsuario(usuario.id);

  const hoy = claveDia();
  const mesActual = claveMes();
  const mes = mesPedido && MES_VALIDO.test(mesPedido) ? mesPedido : mesActual;
  const vista = esVistaCalendario(vistaPedida) ? vistaPedida : undefined;

  const [t, mensajes, entradas] = await Promise.all([
    getTranslations({ locale, namespace: "studentPortal" }),
    mensajesCliente(["studentPortal", "calendar"]),
    agendaDelEstudiante(estudiante.id, mes, usuario.id),
  ]);

  return (
    <div className="animate-entrada mx-auto max-w-6xl space-y-6">
      <Cabecera titulo={t("agenda.title")} />

      <NextIntlClientProvider messages={mensajes}>
        <CalendarioMensualEstudiante
          mes={mes}
          vista={vista}
          hoy={hoy}
          entradas={entradas}
        />
      </NextIntlClientProvider>
    </div>
  );
}
