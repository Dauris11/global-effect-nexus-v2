import type { Metadata } from "next";
import {
  BookOpen,
  Building2,
  Camera,
  FolderGit2,
  GraduationCap,
  Sparkles,
  Users,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { GaleriaEvidencias } from "@/components/habitudes/galeria-evidencias";
import { HubRecursos } from "@/components/habitudes/hub-recursos";
import { PanelDirectorHabitudes } from "@/components/habitudes/panel-director-habitudes";
import { RegistroVisitaLiceo } from "@/components/habitudes/registro-visita-liceo";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { StatCard } from "@/components/ui/stat-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requerirRol } from "@/lib/auth";
import {
  usuarioTienePermiso,
} from "@/lib/rbac";
import {
  listarDocentesYEstudiantesParaAsignacion,
  listarLiceosHabitudes,
  listarRecursosHabitudes,
  listarVisitasEvidenciasHabitudes,
  metricasHabitudes,
  monitoreoProfesoresHabitudes,
} from "@/server/habitudes/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "habitudes" });

  return { title: t("pageTitle") };
}

export default async function PaginaHabitudesHub({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const usuario = await requerirRol([
    "habitudes",
    "dir_habitudes",
    "docente",
    "admin",
    "super_admin",
  ]);

  const [t, metricas, liceos, recursos, visitas] = await Promise.all([
    getTranslations({ locale, namespace: "habitudes" }),
    metricasHabitudes(),
    listarLiceosHabitudes(),
    listarRecursosHabitudes(),
    listarVisitasEvidenciasHabitudes(),
  ]);

  const puedeSubirRecursos = usuarioTienePermiso(usuario, "habitudes.recursos.subir");
  const puedeRegistrarVisitas = usuarioTienePermiso(usuario,
    "habitudes.evidencias.subir",
  );
  const puedeSupervisar = usuarioTienePermiso(usuario,
    "habitudes.supervisar",
  );

  const [profesoresMonitoreo, datosAsignacion] = puedeSupervisar
    ? await Promise.all([
        monitoreoProfesoresHabitudes(),
        listarDocentesYEstudiantesParaAsignacion(),
      ])
    : [[], { docentes: [], estudiantes: [] }];

  return (
    <div className="animate-entrada space-y-6">
      <EncabezadoPagina titulo={t("pageTitle")} />

      {/* Tarjetas de Impacto */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icono={Users}
          valor={metricas.estudiantes_impactados.toLocaleString()}
          etiqueta={t("statStudentsImpacted")}
          acento
        />
        <StatCard
          icono={Building2}
          valor={String(metricas.liceos_alcanzados)}
          etiqueta={t("statHighSchools")}
        />
        <StatCard
          icono={Camera}
          valor={String(metricas.total_visitas)}
          etiqueta={t("statVisitsCompleted")}
        />
        <StatCard
          icono={BookOpen}
          valor={String(metricas.recursos_disponibles)}
          etiqueta={t("statTeachingResources")}
        />
      </div>

      {/* Pestañas Operativas del Hub */}
      <Tabs defaultValue={puedeSupervisar ? "supervision" : "recursos"} className="space-y-6">
        <TabsList className={`grid w-full ${puedeSupervisar ? "grid-cols-2 sm:grid-cols-4 max-w-2xl" : "grid-cols-3 max-w-xl"}`}>
          {puedeSupervisar && (
            <TabsTrigger value="supervision" className="gap-2">
              <Sparkles className="size-4 text-[#2096BA]" />
              <span className="hidden sm:inline">{t("tabSupervision")}</span>
              <span className="sm:hidden">{t("tabSupervisionShort")}</span>
            </TabsTrigger>
          )}
          <TabsTrigger value="recursos" className="gap-2">
            <BookOpen className="size-4" />
            <span className="hidden sm:inline">{t("tabResources")}</span>
            <span className="sm:hidden">{t("tabResourcesShort")}</span>
          </TabsTrigger>
          {puedeRegistrarVisitas && (
            <TabsTrigger value="registrar" className="gap-2">
              <Camera className="size-4" />
              <span className="hidden sm:inline">{t("tabLogVisit")}</span>
              <span className="sm:hidden">{t("tabLogVisitShort")}</span>
            </TabsTrigger>
          )}
          <TabsTrigger value="evidencias" className="gap-2">
            <Users className="size-4" />
            <span className="hidden sm:inline">{t("tabEvidences")}</span>
            <span className="sm:hidden">{t("tabEvidencesShort")}</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 0 (Supervisión DH & Mapa La Vega) */}
        {puedeSupervisar && (
          <TabsContent value="supervision" className="space-y-4">
            <PanelDirectorHabitudes
              liceos={liceos}
              profesores={profesoresMonitoreo}
              docentesDisponibles={datosAsignacion.docentes}
              estudiantesDisponibles={datosAsignacion.estudiantes}
            />
          </TabsContent>
        )}

        {/* Tab 1: Repositorio de Recursos */}
        <TabsContent value="recursos" className="space-y-4">
          <HubRecursos
            recursosIniciales={recursos}
            puedeSubir={puedeSubirRecursos}
          />
        </TabsContent>

        {/* Tab 2: Registro de Visita y Cámara */}
        {puedeRegistrarVisitas && (
          <TabsContent value="registrar" className="max-w-2xl mx-auto space-y-4">
            <RegistroVisitaLiceo liceos={liceos} />
          </TabsContent>
        )}

        {/* Tab 3: Galería y Auditoría de Evidencias */}
        <TabsContent value="evidencias" className="space-y-4">
          <GaleriaEvidencias visitasIniciales={visitas} liceos={liceos} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
