import type { Metadata } from "next";
import {
  BookOpen,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  Library,
  Sparkles,
  Users,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { AccesosPortal, BannerPortal } from "@/components/layout/banner-portal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { requerirDocencia } from "@/lib/auth";
import { usuarioTienePermiso } from "@/lib/rbac";
import { CUADRO, VACIO } from "@/lib/paleta";
import { cn } from "@/lib/utils";
import { iniciarInscripcionesVigentes } from "@/server/global360/consultas";
import {
  cifrasDocente,
  clases360,
  entregasPorRevisar,
  materiasDelDocente,
} from "@/server/profesor/consultas";

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

  const usuario = await requerirDocencia();

  // Sin el permiso (super_admin que supervisa) ve todas las clases.
  const docenteId = usuarioTienePermiso(usuario, "docencia.impartir")
    ? usuario.id
    : null;

  await iniciarInscripcionesVigentes();

  const [t, tAcad, cifras, materias, clases, entregas] =
    await Promise.all([
      getTranslations({ locale, namespace: "teacherPortal" }),
      getTranslations({ locale, namespace: "academic" }),
      cifrasDocente(docenteId),
      materiasDelDocente(docenteId),
      clases360(docenteId),
      entregasPorRevisar(docenteId, ENTREGAS_VISIBLES),
    ]);

  // Las notas puestas no están en `cifrasDocente` y no hace falta otra
  // consulta: cada clase ya trae las suyas y sumarlas aquí es gratis.
  const notas = clases.reduce((total, clase) => total + clase.con_nota, 0);

  const activas = clases.filter((clase) => clase.activa);
  const vacio = materias.length === 0 && clases.length === 0;

  return (
    <div className="animate-entrada space-y-6">
      <BannerPortal
        rol="docente"
        icono={BookOpen}
        titulo={t("greeting", { name: usuario.nombre })}
        insignia={t("eyebrow")}
        kpis={[
          { valor: String(cifras.clases_360), etiqueta: t("stats.classes360") },
          { valor: String(cifras.estudiantes), etiqueta: t("stats.students") },
          { valor: String(notas), etiqueta: t("stats.grades") },
          { valor: String(cifras.por_revisar), etiqueta: t("stats.toReview") },
        ]}
      />

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

              <Button asChild size="sm">
                <Link href="/academico/clases-360">
                  {t("shortcuts.classes360.label")}
                </Link>
              </Button>
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
                  <Button asChild size="sm" variant="ghost" className="shrink-0 text-xs text-marca-600 hover:text-marca-700">
                    <Link href="/academico/clases-360">
                      {t("reviewSubmission")}
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <AccesosPortal
        accesos={[
          {
            href: "/academico/clases-360",
            icono: Sparkles,
            color: CUADRO.marca,
            titulo: t("shortcuts.classes360.label"),
            texto: t("shortcuts.classes360.hint"),
          },
          {
            href: "/academico/materias",
            icono: Library,
            color: CUADRO.marca,
            titulo: t("shortcuts.subjects.label"),
            texto: t("shortcuts.subjects.hint"),
          },
          {
            href: "/calendario",
            icono: CalendarDays,
            color: CUADRO.marca,
            titulo: t("shortcuts.calendar.label"),
            texto: t("shortcuts.calendar.hint"),
          },
        ]}
      />

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

                        <div className="flex shrink-0 items-center gap-1.5 self-center">
                          <Button asChild size="sm" variant="outline" className="h-8 text-xs">
                            <Link href={`/academico/clases-360?clase=${clase.id}&accion=asistencia#clase-${clase.id}`}>
                              <CalendarCheck className="size-3.5" />
                              {t("takeAttendance")}
                            </Link>
                          </Button>
                          <Button asChild size="sm" variant="ghost" className="h-8 text-xs text-marca-600 hover:text-marca-700">
                            <Link href={`/academico/clases-360?clase=${clase.id}&accion=alumnos#clase-${clase.id}`}>
                              {t("manageClass")}
                            </Link>
                          </Button>
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
                          </p>
                        </div>

                        <Button asChild size="sm" variant="ghost" className="h-7 shrink-0 text-xs text-marca-600 hover:text-marca-700">
                          <Link href={`/academico/materias?q=${encodeURIComponent(materia.codigo || materia.nombre)}`}>
                            {t("viewSubject")}
                          </Link>
                        </Button>
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
