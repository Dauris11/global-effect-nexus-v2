import type { Metadata } from "next";
import {
  BookOpen,
  CalendarCheck,
  ClipboardList,
  Library,
  Sparkles,
  Users,
} from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import {
  DashboardGraficoDocente,
  KpisAnimadosDocente,
} from "@/components/profesor/dashboard-inicio-docente";
import { BannerLlamadasActivas } from "@/components/reuniones/banner-llamadas-activas";
import { Badge } from "@/components/ui/badge";
import { variantesBoton } from "@/components/ui/button-variantes";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { requerirDocencia } from "@/lib/auth";
import { claveDia } from "@/lib/fechas";
import { usuarioTienePermiso } from "@/lib/rbac";
import { CUADRO, VACIO } from "@/lib/paleta";
import { cn } from "@/lib/utils";
import { iniciarInscripcionesVigentes } from "@/server/global360/consultas";
import {
  agendaDocente,
  cifrasDocente,
  clases360,
  entregasCalificadasDocente,
  entregasPorRevisar,
  materiasDelDocente,
} from "@/server/profesor/consultas";
import { reunionesActivasParaUsuario } from "@/server/reuniones/consultas";

/** Cuántas entregas pendientes se enumeran antes de mandar al módulo. */
const ENTREGAS_VISIBLES = 5;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "teacherPortal" });

  return { title: t("eyebrow") };
}

/**
 * Portal del docente, ya con datos reales.
 *
 * ESTE PORTAL NO EDITA NADA, y es deliberado. Poner una nota, publicar una
 * tarea o revisar una entrega se hace en `/academico/clases-360`, que es el
 * módulo donde vive cada formulario con sus comprobaciones. Aquí se responde a "¿qué tengo hoy?" y se enlaza. Duplicar el
 * formulario de revisión en el portal significaría dos sitios que mantener y
 * dos sitios donde equivocarse al cambiar las reglas.
 *
 * QUIÉN VE QUÉ, con el mismo parámetro que el resto del módulo: el `docente` ve
 * lo suyo (`docenteId = usuario.id`) y `super_admin` lo ve todo (`null`), igual
 * que en `/academico/clases-360`. Para el super admin las listas dejan de ser
 * "mías" y pasan a ser el programa completo; entra aquí por su rol, no porque
 * dé clases.
 *
 * Las dos listas —clases de Global Effect 360 y materias universitarias— van
 * SEPARADAS y no en una sola. Son dos programas distintos: el de la Fundación,
 * donde el docente pone la nota, y la carrera del becado, que solo mira.
 * Juntarlas en "mis clases" obligaría a mirar una etiqueta en cada fila para
 * saber de qué se está hablando.
 */
export default async function PortalProfesor({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const idioma: Locale = locale === "en" ? "en" : "es";

  const usuario = await requerirDocencia();

  // Sin el permiso (super_admin que supervisa) ve todas las clases.
  const docenteId = usuarioTienePermiso(usuario, "docencia.impartir")
    ? usuario.id
    : null;

  await iniciarInscripcionesVigentes();

  const [
    t,
    tAcad,
    mensajes,
    cifras,
    materias,
    clases,
    entregas,
    calificadas,
    actividadesAgenda,
    llamadasActivas,
  ] = await Promise.all([
    getTranslations({ locale, namespace: "teacherPortal" }),
    getTranslations({ locale, namespace: "academic" }),
    mensajesCliente(["teacherPortal"]),
    cifrasDocente(docenteId),
    materiasDelDocente(docenteId),
    clases360(docenteId),
    entregasPorRevisar(docenteId, ENTREGAS_VISIBLES),
    entregasCalificadasDocente(docenteId),
    agendaDocente(docenteId, usuario.id),
    reunionesActivasParaUsuario({ usuarioId: usuario.id, rol: usuario.rol }),
  ]);

  const hoyIso = claveDia();
  const resumenClasesGrafico = [
    ...clases.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      inscritos: c.inscritos,
      con_nota: c.con_nota,
    })),
    ...materias.map((m) => ({
      id: m.id,
      nombre: m.nombre,
      inscritos: m.inscritos,
      con_nota: m.con_nota,
    })),
  ];

  // Las notas puestas no están en `cifrasDocente` y no hace falta otra
  // consulta: cada clase 360 y materia asignada ya trae las suyas.
  const notas =
    clases.reduce((total, clase) => total + clase.con_nota, 0) +
    materias.reduce((total, materia) => total + materia.con_nota, 0);

  const activas = clases.filter((clase) => clase.activa);
  const vacio = materias.length === 0 && clases.length === 0;

  const enlaceRevision = (entrega: (typeof entregas)[number]) =>
    entrega.materia_id
      ? `/portal/profesor/materias?materia=${entrega.materia_id}&accion=publicaciones#materia-${entrega.materia_id}`
      : entrega.materia_360_id
        ? `/academico/clases-360?clase=${entrega.materia_360_id}&accion=publicaciones#clase-${entrega.materia_360_id}`
        : "/academico/clases-360";

  return (
    <div className="animate-entrada space-y-6">
      <div className="space-y-6">
        <EncabezadoPagina
          titulo={t("greeting", { name: usuario.nombre })}
          subtitulo={t("summary")}
          acciones={
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/academico/clases-360"
                className={variantesBoton({ size: "sm" })}
              >
                <Sparkles className="size-4" />
                {t("assignTask")} (360)
              </Link>
              <Link
                href="/portal/profesor/materias"
                className={variantesBoton({ variant: "outline", size: "sm" })}
              >
                <Library className="size-4" />
                {t("shortcuts.assignedSubjects.label")}
              </Link>
            </div>
          }
        />

        <NextIntlClientProvider messages={mensajes}>
          <KpisAnimadosDocente
            totalClases={cifras.clases_360 + materias.length}
            estudiantes={cifras.estudiantes}
            notas={notas}
            porRevisar={cifras.por_revisar}
          />
        </NextIntlClientProvider>
      </div>

      <BannerLlamadasActivas activas={llamadasActivas} />

      <NextIntlClientProvider messages={mensajes}>
        <DashboardGraficoDocente
          resumenClases={resumenClasesGrafico}
          porRevisar={cifras.por_revisar}
          calificadas={calificadas}
          actividades={actividadesAgenda}
          hoyIso={hoyIso}
          locale={idioma}
        />
      </NextIntlClientProvider>

      {/* Va antes que nada más cuando hay algo: es lo único de esta pantalla
          con alguien esperando al otro lado. Con cero no se dibuja — el KPI ya
          lo dice, y una tarjeta que solo sirve para anunciar que no hay trabajo
          ocupa el sitio del que sí lo hay. */}
      {entregas.length > 0 && (
        <Card className="border-marca-500/30">
          <CardContent className="pt-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <CardTitle>
                <ClipboardList className="size-4" />
                {tAcad("classes360.toReview")}
                <Badge className="bg-tinta text-background ml-1 text-[10px]">
                  {cifras.por_revisar}
                </Badge>
              </CardTitle>

              <Link
                href="/academico/clases-360"
                className={variantesBoton({ size: "sm" })}
              >
                {t("shortcuts.classes360.label")}
              </Link>
            </div>

            <ul className="divide-linea divide-y">
              {entregas.map((entrega) => (
                <li
                  key={entrega.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {entrega.estudiante}
                    </span>
                    <span className="text-tinta-3 block truncate text-xs">
                      {entrega.asignacion} · {entrega.unidad}
                    </span>
                  </div>
                  <Link
                    href={enlaceRevision(entrega)}
                    className={variantesBoton({
                      size: "sm",
                      variant: "ghost",
                      className: "shrink-0 text-xs text-marca-600 hover:text-marca-700",
                    })}
                  >
                    {t("reviewSubmission")}
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {vacio ? (
        <Card>
          <CardContent className={VACIO.contenedor}>
            <span className={VACIO.icono}>
              <BookOpen className="size-6" />
            </span>
            <p className={VACIO.titulo}>{t("classesEmpty")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {clases.length > 0 && (
            <Card className="lg:col-span-2">
              <CardContent className="pt-5">
                <CardTitle className="mb-3">
                  <Sparkles className="size-4" />
                  {t("classesTitle")}
                  <Badge className="bg-marca-500/15 text-marca-600 ml-1 text-[10px]">
                    {activas.length}
                  </Badge>
                </CardTitle>

                <ul className="divide-linea divide-y">
                  {clases.map((clase) => (
                    <li key={clase.id} className="group py-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <span
                            className={cn(
                              "rounded-control flex size-9 shrink-0 items-center justify-center transition-transform duration-150 group-hover:scale-110",
                              clase.activa ? CUADRO.marca : CUADRO.neutro,
                            )}
                          >
                            <Sparkles className="size-4" />
                          </span>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {clase.nombre}
                            </p>
                            <p className="text-tinta-3 truncate text-xs">
                              {[clase.codigo, clase.horario, clase.aula]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>

                            <p className="text-tinta-3 mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
                              <span className="inline-flex items-center gap-1">
                                <Users className="size-3" />
                                {t("enrolledCount", { count: clase.inscritos })}
                              </span>
                              <span>
                                {tAcad("classes360.tasks")}: <b>{clase.tareas}</b>
                              </span>
                              <span>
                                {t("gradesCount", { count: clase.con_nota })}
                              </span>
                              <span>
                                {clase.promedio === null
                                  ? t("noGradesYet")
                                  : t("averageShort", {
                                      value: clase.promedio.toFixed(1),
                                    })}
                              </span>
                            </p>
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-wrap items-center gap-1.5 self-center">
                          <Link
                            href={`/academico/clases-360?clase=${clase.id}&accion=asistencia#clase-${clase.id}`}
                            className={variantesBoton({ size: "sm", variant: "outline", className: "h-8 text-xs" })}
                          >
                            <CalendarCheck className="size-3.5" />
                            {t("takeAttendance")}
                          </Link>
                          <Link
                            href={`/academico/clases-360?clase=${clase.id}&accion=tarea#clase-${clase.id}`}
                            className={variantesBoton({ size: "sm", variant: "outline", className: "h-8 text-xs" })}
                          >
                            <ClipboardList className="size-3.5" />
                            {t("assignTask")}
                          </Link>
                          {clase.tareas > 0 && (
                            <Link
                              href={`/academico/clases-360?clase=${clase.id}&accion=publicaciones#clase-${clase.id}`}
                              className={variantesBoton({ size: "sm", variant: "outline", className: "h-8 text-xs" })}
                            >
                              <ClipboardList className="size-3.5" />
                              {t("viewPosts")} ({clase.tareas})
                            </Link>
                          )}
                          <Link
                            href={`/academico/clases-360?clase=${clase.id}&accion=alumnos#clase-${clase.id}`}
                            className={variantesBoton({
                              size: "sm",
                              variant: "ghost",
                              className: "h-8 text-xs text-marca-600 hover:text-marca-700",
                            })}
                          >
                            {t("manageClass")}
                          </Link>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {materias.length > 0 && (
            <Card>
              <CardContent className="pt-5">
                <CardTitle className="mb-3">
                  <Library className="size-4" />
                  {t("subjectsTitle")}
                  <Badge className="bg-marca-500/15 text-marca-600 ml-1 text-[10px]">
                    {materias.length}
                  </Badge>
                </CardTitle>

                <ul className="divide-linea divide-y">
                  {materias.map((materia) => (
                    <li key={materia.id} className="py-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="min-w-0 truncate text-sm font-medium">
                              {materia.nombre}
                            </p>
                            {materia.codigo && (
                              <span className="text-tinta-3 bg-muted/60 rounded-full px-1.5 py-0.5 font-mono text-[10px]">
                                {materia.codigo}
                              </span>
                            )}
                          </div>

                          <p className="text-tinta-3 mt-0.5 flex flex-wrap gap-x-3 text-[11px]">
                            <span>{materia.periodo ?? tAcad("noTerm")}</span>
                            <span>
                              {t("enrolledCount", { count: materia.inscritos })}
                            </span>
                            <span>
                              {tAcad("subjects.tasks")}: <b>{materia.tareas}</b>
                            </span>
                            <span>
                              {t("gradesCount", { count: materia.con_nota })}
                            </span>
                            <span>
                              {materia.promedio === null
                                ? t("noGradesYet")
                                : t("averageShort", {
                                    value: materia.promedio.toFixed(1),
                                  })}
                            </span>
                          </p>
                        </div>

                        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                          <Link
                            href={`/portal/profesor/materias?materia=${materia.id}&accion=asistencia#materia-${materia.id}`}
                            className={variantesBoton({ size: "sm", variant: "outline", className: "h-8 text-xs" })}
                          >
                            <CalendarCheck className="size-3.5" />
                            {t("takeAttendance")}
                          </Link>
                          <Link
                            href={`/portal/profesor/materias?materia=${materia.id}&accion=tarea#materia-${materia.id}`}
                            className={variantesBoton({ size: "sm", variant: "outline", className: "h-8 text-xs" })}
                          >
                            <ClipboardList className="size-3.5" />
                            {t("assignTask")}
                          </Link>
                          {materia.tareas > 0 && (
                            <Link
                              href={`/portal/profesor/materias?materia=${materia.id}&accion=publicaciones#materia-${materia.id}`}
                              className={variantesBoton({ size: "sm", variant: "outline", className: "h-8 text-xs" })}
                            >
                              <ClipboardList className="size-3.5" />
                              {t("viewPosts")} ({materia.tareas})
                            </Link>
                          )}
                          <Link
                            href={`/portal/profesor/materias?materia=${materia.id}&accion=alumnos#materia-${materia.id}`}
                            className={variantesBoton({
                              size: "sm",
                              variant: "ghost",
                              className: "h-8 text-xs text-marca-600 hover:text-marca-700",
                            })}
                          >
                            {t("manageClass")}
                          </Link>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
