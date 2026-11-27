import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/app/page-header";
import { ListaAgrupada, type SeccionTareas } from "@/components/estudiante/clases/lista-agrupada";
import { PestanaAsistencia, PestanaCalificaciones } from "@/components/estudiante/clases/pestanas-clase";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/app/empty-state";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirRol } from "@/lib/auth";
import {
  GRUPOS_TAREA,
  finDeSemana,
  inicioDeSemana,
  leerClaveDeClase,
  rangoDeSemana,
  claveDeClase,
} from "@/lib/clases";
import { diaEnRD } from "@/lib/fechas";
import { asistenciaDeClase, claseDelEstudiante } from "@/server/estudiantes/clases";
import { estudianteDeUsuario } from "@/server/estudiantes/portal";
import { tareasDelEstudiante } from "@/server/estudiantes/tareas";
import { BookOpen } from "lucide-react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "studentClasses" });

  return { title: t("classes.title") };
}

/**
 * Detalle de una clase, estilo Moodle: Contenido · Tareas · Calificaciones ·
 * Asistencia.
 *
 * LA PUERTA ES LA MATRÍCULA: `claseDelEstudiante` devuelve `null` si el
 * estudiante no está inscrito, y entonces es un 404 idéntico al de una clase
 * que no existe. Con solo el id de la URL se vería la retroalimentación de otro.
 *
 * El contenido va por semanas según la fecha de publicación (en hora de la
 * Fundación): las asignaciones no tienen columna de tema o semana, y agrupar
 * así no pide migración. La semana actual llega desplegada.
 */
export default async function PaginaDetalleClase({
  params,
}: {
  params: Promise<{ locale: string; clave: string }>;
}) {
  const { locale, clave } = await params;
  const idioma = locale === "en" ? "en" : "es";

  const leida = leerClaveDeClase(clave);
  if (!leida) notFound();

  const usuario = await requerirRol(["estudiante"]);
  const estudiante = await estudianteDeUsuario(usuario.id);
  const clase = await claseDelEstudiante(estudiante.id, leida.origen, leida.id);
  if (!clase || !estudiante.id) notFound();

  const [t, mensajes, todas, sesiones] = await Promise.all([
    getTranslations({ locale, namespace: "studentClasses" }),
    mensajesCliente(["studentClasses", "moodle"]),
    tareasDelEstudiante(estudiante.id, idioma),
    asistenciaDeClase(estudiante.id, clase),
  ]);

  const claveClase = claveDeClase(clase.origen, clase.id);
  const deLaClase = todas.filter((x) => x.claveClase === claveClase);
  const evaluables = deLaClase.filter((x) => x.tipo === "tarea" || x.tipo === "examen");

  // Contenido: semanas de la más reciente a la más antigua.
  const hoy = diaEnRD();
  const semanaActual = inicioDeSemana(hoy);
  const porSemana = new Map<string, typeof deLaClase>();

  for (const x of deLaClase) {
    const inicio = inicioDeSemana(x.publicadaDia);

    porSemana.set(inicio, [...(porSemana.get(inicio) ?? []), x]);
  }
  const semanas: SeccionTareas[] = [...porSemana.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([inicio, tareas]) => ({
      id: inicio,
      titulo: t("detail.week", { rango: rangoDeSemana(inicio, finDeSemana(inicio), idioma) }),
      tareas: tareas.sort((a, b) => b.publicadaDia.localeCompare(a.publicadaDia)),
      abierta: inicio === semanaActual,
    }));
  // Si ninguna semana es la actual, se abre la más reciente: nunca todo plegado.
  if (semanas.length > 0 && !semanas.some((s) => s.abierta)) semanas[0].abierta = true;

  const grupos: SeccionTareas[] = GRUPOS_TAREA.map((g) => ({
    id: g,
    titulo: t(`tasks.groups.${g}`),
    tareas: evaluables.filter((x) => x.grupo === g).sort((a, b) => (a.vence ?? "9999").localeCompare(b.vence ?? "9999")),
  })).filter((s) => s.tareas.length > 0);

  return (
    <div className="animate-entrada space-y-6">
      <PageHeader
        breadcrumb={[{ etiqueta: t("classes.title"), href: "/portal/estudiante/clases" }, { etiqueta: clase.nombre }]}
        title={clase.nombre}
        subtitle={[clase.docente, clase.periodo].filter(Boolean).join(" · ") || undefined}
      />

      <NextIntlClientProvider messages={mensajes}>
        <Tabs defaultValue="content">
          <TabsList>
            <TabsTrigger value="content">{t("detail.tabs.content")}</TabsTrigger>
            <TabsTrigger value="tasks">{t("detail.tabs.tasks")}</TabsTrigger>
            <TabsTrigger value="grades">{t("detail.tabs.grades")}</TabsTrigger>
            <TabsTrigger value="attendance">{t("detail.tabs.attendance")}</TabsTrigger>
          </TabsList>

          <TabsContent value="content">
            {semanas.length === 0 ? (
              <EmptyState readOnly icon={BookOpen} title={t("detail.emptyTitle")} description={t("detail.emptyHint")} />
            ) : (
              <ListaAgrupada secciones={semanas} colapsable mostrarClase={false} />
            )}
          </TabsContent>

          <TabsContent value="tasks">
            {grupos.length === 0 ? (
              <EmptyState readOnly icon={BookOpen} title={t("tasks.emptyTitle")} description={t("tasks.emptyHint")} />
            ) : (
              <ListaAgrupada secciones={grupos} mostrarClase={false} />
            )}
          </TabsContent>

          <TabsContent value="grades">
            <PestanaCalificaciones tareas={evaluables} />
          </TabsContent>

          <TabsContent value="attendance">
            <PestanaAsistencia sesiones={sesiones} idioma={idioma} />
          </TabsContent>
        </Tabs>
      </NextIntlClientProvider>
    </div>
  );
}
