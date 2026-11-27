import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/app/page-header";
import { ListaEquipo } from "@/components/habitudes/lista-equipo";
import { PanelDirectorHabitudes } from "@/components/habitudes/panel-director-habitudes";
import { requerirPermiso } from "@/lib/auth";
import {
  listarDocentesYEstudiantesParaAsignacion,
  listarLiceosHabitudes,
  monitoreoProfesoresHabitudes,
} from "@/server/habitudes/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });

  return { title: t("team") };
}

/** Director: profesores con sus visitas del mes y el centro de asignaciones a liceos. */
export default async function PaginaEquipoHabitudes({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requerirPermiso("habitudes.supervisar");
  const [t, profesores, liceos, asignacion] = await Promise.all([
    getTranslations({ locale, namespace: "nav" }),
    monitoreoProfesoresHabitudes(),
    listarLiceosHabitudes(),
    listarDocentesYEstudiantesParaAsignacion(),
  ]);

  return (
    <div className="animate-entrada space-y-8">
      <PageHeader title={t("team")} />
      <ListaEquipo profesores={profesores} idioma={locale === "en" ? "en" : "es"} />
      <PanelDirectorHabitudes
        liceos={liceos}
        profesores={profesores}
        docentesDisponibles={asignacion.docentes}
        estudiantesDisponibles={asignacion.estudiantes}
        parte="asignaciones"
      />
    </div>
  );
}
