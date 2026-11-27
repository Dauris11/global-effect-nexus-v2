import type { Metadata } from "next";
import { BookOpen, Building2, Camera, ClipboardCheck, UserPlus, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { ActionTile } from "@/components/app/action-tile";
import { AttentionList, type ItemAtencion } from "@/components/app/attention-list";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { requerirPermiso } from "@/lib/auth";
import { usuarioTienePermiso } from "@/lib/rbac";
import { listarVisitasEvidenciasHabitudes, metricasHabitudes } from "@/server/habitudes/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "habitudes" });

  return { title: t("pageTitle") };
}

/**
 * Inicio de Habitudes. Las pestañas del Hub (Recursos, Registrar visita,
 * Evidencias) son ahora secciones del menú; aquí quedan las cuatro cifras del
 * programa, las acciones rápidas y, para quien supervisa, lo que espera
 * auditoría. «Postular candidato a beca» es una acción rápida más, no el botón
 * primario: lo que se hace cada semana es registrar visitas.
 */
export default async function PaginaInicioHabitudes({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // El mismo permiso que declara la entrada del menú en `nav.ts`.
  const usuario = await requerirPermiso("habitudes.recursos.leer");

  const puedeRegistrar = usuarioTienePermiso(usuario, "habitudes.evidencias.subir");
  const puedePostular = usuarioTienePermiso(usuario, "expedientes.postular");
  const puedeSupervisar = usuarioTienePermiso(usuario, "habitudes.supervisar");

  const [t, metricas, visitas] = await Promise.all([
    getTranslations({ locale, namespace: "habitudes" }),
    metricasHabitudes(),
    puedeSupervisar ? listarVisitasEvidenciasHabitudes() : Promise.resolve([]),
  ]);

  // Lo que espera auditoría: visitas completadas que nadie ha dado por revisadas.
  const porAuditar: ItemAtencion[] = visitas
    .filter((v) => v.estado === "completada")
    .slice(0, 7)
    .map((v) => ({
      id: v.id,
      status: "en_revision",
      title: v.liceo_nombre,
      context: `${v.facilitador_nombre} · ${t("home.studentsCount", { n: v.estudiantes_impactados })}`,
      date: v.fecha_visita,
      action: { label: t("home.review"), href: "/habitudes/evidencias" },
    }));

  return (
    <div className="animate-entrada space-y-6">
      <PageHeader title={t("pageTitle")} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icono={Users} valor={metricas.estudiantes_impactados.toLocaleString()} etiqueta={t("statStudentsImpacted")} acento />
        <StatCard icono={Building2} valor={String(metricas.liceos_alcanzados)} etiqueta={t("statHighSchools")} />
        <StatCard icono={Camera} valor={String(metricas.total_visitas)} etiqueta={t("statVisitsCompleted")} />
        <StatCard icono={BookOpen} valor={String(metricas.recursos_disponibles)} etiqueta={t("statTeachingResources")} />
      </div>

      <section className="space-y-3">
        <h2 className="text-section">{t("home.quickActions")}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {puedeRegistrar && (
            <ActionTile icon={Camera} title={t("home.logVisit")} hint={t("home.logVisitHint")} href="/habitudes/visitas/nueva" />
          )}
          {puedePostular && (
            <ActionTile
              icon={UserPlus}
              title={t("nominateCandidate")}
              hint={t("home.nominateHint")}
              href="/administrativo/solicitudes?tipo=alta_expediente"
            />
          )}
          <ActionTile icon={BookOpen} title={t("home.openResources")} hint={t("home.openResourcesHint")} href="/habitudes/recursos" />
          {puedeSupervisar && (
            <ActionTile icon={ClipboardCheck} title={t("home.audit")} hint={t("home.auditHint")} href="/habitudes/evidencias" />
          )}
        </div>
      </section>

      {puedeSupervisar && porAuditar.length > 0 && <AttentionList items={porAuditar} viewAllHref="/habitudes/evidencias" />}
    </div>
  );
}
