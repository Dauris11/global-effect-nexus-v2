import type { Metadata } from "next";
import { ClipboardCheck } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { ListaAgrupada } from "@/components/estudiante/clases/lista-agrupada";
import { Button } from "@/components/ui/button";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { Link } from "@/i18n/navigation";
import { requerirRol } from "@/lib/auth";
import { GRUPOS_TAREA } from "@/lib/clases";
import { estudianteDeUsuario } from "@/server/estudiantes/portal";
import { tareasDelEstudiante } from "@/server/estudiantes/tareas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "studentClasses" });

  return { title: t("tasks.title") };
}

/**
 * Todas las tareas de todas las clases en una lista: Vencidas · Esta semana ·
 * Próximas · Entregadas. Es lo que el estudiante viene a ver, así que arriba va
 * lo que vence y las entregadas, que ya no piden nada, al final.
 *
 * Solo lo evaluable (tareas y exámenes): el material y los anuncios se leen en
 * el detalle de cada clase.
 */
export default async function PaginaTareas({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const idioma = locale === "en" ? "en" : "es";

  const usuario = await requerirRol(["estudiante"]);
  const estudiante = await estudianteDeUsuario(usuario.id);

  const [t, mensajes, todas] = await Promise.all([
    getTranslations({ locale, namespace: "studentClasses" }),
    mensajesCliente(["studentClasses", "moodle"]),
    tareasDelEstudiante(estudiante.id, idioma),
  ]);

  const evaluables = todas.filter((x) => x.tipo === "tarea" || x.tipo === "examen");
  const porVencimiento = (a: (typeof evaluables)[number], b: (typeof evaluables)[number]) =>
    (a.vence ?? "9999").localeCompare(b.vence ?? "9999");

  const secciones = GRUPOS_TAREA.map((grupo) => ({
    id: grupo,
    titulo: t(`tasks.groups.${grupo}`),
    // Las entregadas, de la más reciente a la más antigua; el resto, por fecha de vencimiento.
    tareas: evaluables
      .filter((x) => x.grupo === grupo)
      .sort((a, b) => (grupo === "entregadas" ? -porVencimiento(a, b) : porVencimiento(a, b))),
  })).filter((s) => s.tareas.length > 0);

  return (
    <div className="animate-entrada space-y-6">
      <PageHeader title={t("tasks.title")} />

      {secciones.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title={t("tasks.emptyTitle")}
          description={t("tasks.emptyHint")}
          action={
            <Button asChild>
              <Link href="/portal/estudiante/clases">{t("tasks.seeClasses")}</Link>
            </Button>
          }
        />
      ) : (
        <NextIntlClientProvider messages={mensajes}>
          <ListaAgrupada secciones={secciones} />
        </NextIntlClientProvider>
      )}
    </div>
  );
}
