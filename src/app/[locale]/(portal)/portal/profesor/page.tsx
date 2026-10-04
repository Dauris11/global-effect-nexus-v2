import type { Metadata } from "next";
import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  Library,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { AccesosPortal, BannerPortal } from "@/components/layout/banner-portal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { requerirRol } from "@/lib/auth";
import { CUADRO, VACIO } from "@/lib/paleta";
import { cn } from "@/lib/utils";
import {
  cifrasDocente,
  clases360,
  cursosGestionados,
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
 * LOS KPIs YA LLEVAN CIFRAS. Iban vacíos a propósito mientras no eran de
 * verdad —un banner con cuatro ceros informa menos que uno sin cifras, y esta
 * es justamente la pantalla donde alguien viene a mirar cuántas notas le
 * faltan—. Ahora salen de `cifrasDocente`, así que el aviso deja de aplicar.
 *
 * ESTE PORTAL NO EDITA NADA, y es deliberado. Registrar una nota, publicar una
 * tarea o revisar una entrega se hace en `/academico/calificaciones` y
 * `/academico/cursos`, que son los módulos donde vive cada formulario con sus
 * comprobaciones. Aquí se responde a "¿qué tengo hoy?" y se enlaza. Duplicar el
 * formulario de revisión en el portal significaría dos sitios que mantener y
 * dos sitios donde equivocarse al cambiar las reglas.
 *
 * QUIÉN VE QUÉ, con el mismo parámetro que el resto del módulo: el `docente` ve
 * lo suyo (`docenteId = usuario.id`) y `super_admin` lo ve todo (`null`), igual
 * que en `/academico/cursos`. Para el super admin las listas dejan de ser
 * "mías" y pasan a ser el programa completo; entra aquí por su rol, no porque
 * dé clases.
 *
 * Las tres listas —cursos técnicos, materias universitarias y clases de Global
 * Effect 360— van SEPARADAS y no en una sola. Son tres programas distintos: la
 * carrera del becado, el curso técnico del estudiante regular y el programa
 * 360. Juntarlas en "mis clases" obligaría a mirar una etiqueta en cada fila
 * para saber de qué se está hablando.
 */
export default async function PortalProfesor({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const usuario = await requerirRol(["docente", "super_admin"]);

  const docenteId = usuario.rol === "docente" ? usuario.id : null;

  const [t, tAcad, cifras, cursos, materias, clases, entregas] =
    await Promise.all([
      getTranslations({ locale, namespace: "teacherPortal" }),
      getTranslations({ locale, namespace: "academic" }),
      cifrasDocente(docenteId),
      cursosGestionados(docenteId),
      materiasDelDocente(docenteId),
      clases360(docenteId),
      entregasPorRevisar(docenteId, ENTREGAS_VISIBLES),
    ]);

  // Las notas registradas no están en `cifrasDocente` y no hace falta otra
  // consulta: cada curso ya trae las suyas y sumarlas aquí es gratis.
  const notas = cursos.reduce((total, curso) => total + curso.notas, 0);

  const activos = cursos.filter((curso) => curso.estado === "activo");
  const vacio =
    cursos.length === 0 && materias.length === 0 && clases.length === 0;

  return (
    <div className="space-y-6">
      <BannerPortal
        rol="docente"
        icono={BookOpen}
        titulo={t("greeting", { name: usuario.nombre })}
        subtitulo={t("summary")}
        insignia={t("eyebrow")}
        kpis={[
          { valor: String(cifras.cursos), etiqueta: t("stats.courses") },
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
        <Card className="border-[#2096BA]/30">
          <CardContent className="pt-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <CardTitle>
                <ClipboardList className="size-4" />
                {tAcad("courses.toReview")}
                <Badge className="ml-1 bg-[#171A1D] text-[10px] text-white">
                  {cifras.por_revisar}
                </Badge>
              </CardTitle>

              <Button asChild size="sm">
                <Link href="/academico/cursos">
                  {t("shortcuts.courses.label")}
                </Link>
              </Button>
            </div>

            <ul className="divide-y">
              {entregas.map((entrega) => (
                <li
                  key={entrega.id}
                  className="flex flex-wrap items-center gap-2 py-2 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {entrega.estudiante}
                  </span>
                  <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
                    {entrega.asignacion} · {entrega.unidad}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <AccesosPortal
        accesos={[
          {
            href: "/academico/cursos",
            icono: BookOpen,
            color: CUADRO.marca,
            titulo: t("shortcuts.courses.label"),
            texto: t("shortcuts.courses.hint"),
          },
          {
            href: "/academico/materias",
            icono: Library,
            color: CUADRO.marca,
            titulo: t("shortcuts.subjects.label"),
            texto: t("shortcuts.subjects.hint"),
          },
          {
            href: "/academico/calificaciones",
            icono: Star,
            color: CUADRO.marca,
            titulo: t("shortcuts.grades.label"),
            texto: t("shortcuts.grades.hint"),
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
            <p className={VACIO.titulo}>{t("coursesEmpty")}</p>
            <p className={VACIO.descripcion}>{t("coursesEmptyHint")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {cursos.length > 0 && (
            <Card className="lg:col-span-2">
              <CardContent className="pt-5">
                <CardTitle className="mb-3">
                  <BookOpen className="size-4" />
                  {t("coursesTitle")}
                  <Badge className="ml-1 bg-[#2096BA]/15 text-[10px] text-[#187a99]">
                    {activos.length}
                  </Badge>
                </CardTitle>

                <ul className="divide-y">
                  {cursos.map((curso) => (
                    <li key={curso.id} className="group py-3">
                      <div className="flex flex-wrap items-start gap-3">
                        <span
                          className={cn(
                            "flex size-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-150 group-hover:scale-110",
                            curso.estado === "activo"
                              ? CUADRO.marca
                              : CUADRO.neutro,
                          )}
                        >
                          <BookOpen className="size-4" />
                        </span>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {curso.nombre}
                          </p>
                          <p className="text-muted-foreground truncate text-xs">
                            {[
                              curso.periodo,
                              curso.horario,
                              t(`courseMode.${curso.modalidad}` as never),
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>

                          <p className="text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
                            <span className="inline-flex items-center gap-1">
                              <Users className="size-3" />
                              {/* La cifra cuenta a quien tiene alguna nota en
                                  el curso, no a los matriculados: `inscritos`
                                  de `curso` es un contador a mano que se queda
                                  viejo. Por eso la etiqueta es "Estudiantes". */}
                              {t("stats.students")}: <b>{curso.estudiantes}</b>
                            </span>
                            <span>
                              {t("gradesCount", { count: curso.notas })}
                            </span>
                            <span>
                              {curso.promedio === null
                                ? t("noGradesYet")
                                : t("averageShort", {
                                    value: curso.promedio.toFixed(1),
                                  })}
                            </span>
                          </p>
                        </div>

                        <Badge
                          className={cn(
                            "shrink-0 text-[10px]",
                            curso.estado === "activo"
                              ? "bg-[#2096BA]/15 text-[#187a99]"
                              : "bg-slate-100 text-slate-600",
                          )}
                        >
                          {t(`courseStatus.${curso.estado}` as never)}
                        </Badge>
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
                  <Badge className="ml-1 bg-[#2096BA]/15 text-[10px] text-[#187a99]">
                    {materias.length}
                  </Badge>
                </CardTitle>

                <ul className="divide-y">
                  {materias.map((materia) => (
                    <li key={materia.id} className="py-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="min-w-0 flex-1 truncate text-sm font-medium">
                          {materia.nombre}
                        </p>
                        {materia.codigo && (
                          <span className="text-muted-foreground bg-muted/60 rounded px-1.5 py-0.5 font-mono text-[10px]">
                            {materia.codigo}
                          </span>
                        )}
                      </div>

                      <p className="text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 text-[11px]">
                        <span>{materia.periodo ?? tAcad("noTerm")}</span>
                        <span>
                          {t("enrolledCount", { count: materia.inscritos })}
                        </span>
                        <span>
                          {tAcad("courses.tasks")}: <b>{materia.tareas}</b>
                        </span>
                      </p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {clases.length > 0 && (
            <Card>
              <CardContent className="pt-5">
                <CardTitle className="mb-3">
                  <Sparkles className="size-4" />
                  {tAcad("courses.my360")}
                  <Badge className="ml-1 bg-[#2096BA]/15 text-[10px] text-[#187a99]">
                    {clases.length}
                  </Badge>
                </CardTitle>

                <ul className="divide-y">
                  {clases.map((clase) => (
                    <li key={clase.id} className="py-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="min-w-0 flex-1 truncate text-sm font-medium">
                          {clase.nombre}
                        </p>
                        {clase.obligatoria && (
                          <Badge className="bg-[#0a6a8a] text-[10px] text-white">
                            <GraduationCap className="size-3" />
                          </Badge>
                        )}
                      </div>

                      <p className="text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 text-[11px]">
                        <span>
                          {tAcad("courses.enrolled")}: <b>{clase.inscritos}</b>
                        </span>
                        <span>
                          {tAcad("courses.tasks")}: <b>{clase.tareas}</b>
                        </span>
                      </p>
                    </li>
                  ))}
                </ul>

                <p className="text-muted-foreground mt-3 text-[11px]">
                  {tAcad("courses.admin360Hint")}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
