import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { RevisorEntregas } from "@/components/profesor/revisor-entregas";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirDocencia } from "@/lib/auth";
import { usuarioTienePermiso } from "@/lib/rbac";
import { tareasParaRevisar } from "@/server/profesor/revision";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "teacherPortal.submissions" });

  return { title: t("title") };
}

/**
 * El único sitio donde se califica: todas las tareas del docente, con lo que
 * envió cada estudiante en vista previa. `?tarea=<id>` abre una tarea concreta
 * (los enlaces «Revisar entregas» de cada clase llegan así).
 */
export default async function PaginaEntregasDocente({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tarea?: string }>;
}) {
  const { locale } = await params;
  const { tarea } = await searchParams;
  const usuario = await requerirDocencia();
  // Coordinación ve las de todos; el docente, solo las de sus clases.
  const docenteId = usuarioTienePermiso(usuario, "academico.escribir") ? null : usuario.id;

  const [t, mensajes, tareas] = await Promise.all([
    getTranslations({ locale, namespace: "teacherPortal.submissions" }),
    mensajesCliente(["teacherPortal"]),
    tareasParaRevisar(docenteId),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-entrada">
      <EncabezadoPagina titulo={t("title")} />
      <NextIntlClientProvider messages={mensajes}>
        <RevisorEntregas
          tareas={tareas}
          tareaInicialId={tarea}
          idioma={locale === "en" ? "en" : "es"}
        />
      </NextIntlClientProvider>
    </div>
  );
}
