import { BookOpen, CalendarCheck, ChevronRight, GraduationCap } from "lucide-react";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import { getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/app/empty-state";
import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { TarjetaClase } from "@/components/estudiante/clases/tarjeta-clase";
import { LateralInicio } from "@/components/inicio/lateral";
import { ListaDePrioridades } from "@/components/prioridades/lista-prioridades";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { claveDeClase } from "@/lib/clases";
import { fechaCorta } from "@/lib/fechas";
import { ACCESOS_RAPIDOS } from "@/lib/prioridades/rapidas";
import type { ListaPrioridades } from "@/lib/prioridades/types";
import { clasesDelEstudiante } from "@/server/estudiantes/clases";
import { estudianteDeUsuario } from "@/server/estudiantes/portal";
import { tareasDelEstudiante } from "@/server/estudiantes/tareas";
import { ventanaVigente } from "@/server/global360/consultas";
import { agendaDeHoy } from "@/server/prioridades/inicio";
import { becaDelMes, clasesDelDocenteHoy, impactoDelAnio } from "@/server/prioridades/inicio-roles";
import type { UsuarioSesion } from "@/lib/auth";

type Props = {
  usuario: UsuarioSesion;
  lista: ListaPrioridades;
  locale: string;
  mensajes: AbstractIntlMessages;
  saludo: string;
  soloLectura: boolean;
  atras?: React.ReactNode;
};

const todos = (lista: ListaPrioridades) => [...Object.values(lista.grupos).flat()];

/** Docente: lo que espera nota (por tarea), las clases de hoy y, a un lado, agenda y accesos. */
export async function InicioDocente({ usuario, lista, locale, mensajes, saludo, soloLectura, atras }: Props) {
  const [t, clases, agenda] = await Promise.all([
    getTranslations({ locale, namespace: "priorities" }),
    clasesDelDocenteHoy(usuario.id),
    agendaDeHoy(usuario),
  ]);
  const entregas = todos(lista).filter((i) => i.tipo === "entrega_por_calificar");
  const n = entregas.reduce((s, i) => s + (i.cantidad ?? 1), 0);
  const m = new Set(entregas.map((i) => i.grupoClave)).size;
  const sinClases = clases.todas.length === 0;

  return (
    <PageContainer className="max-w-[1100px] space-y-6">
      <PageHeader title={saludo} subtitle={n > 0 ? t("teacher.summary", { n, m }) : t("teacher.upToDate")} secondaryActions={atras} />

      {sinClases && lista.total === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={t("teacher.emptyTitle")}
          description={t("teacher.emptyHint")}
          action={
            <Button asChild variant="secondary">
              <Link href="/administrativo/solicitudes?nuevo=1">{t("teacher.writeCoordination")}</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="min-w-0 space-y-8 lg:col-span-2">
            <section aria-labelledby="doc-calificar" className="space-y-3">
              <h2 id="doc-calificar" className="text-section">{t("teacher.toGrade")}</h2>
              <NextIntlClientProvider messages={mensajes}>
                {lista.total === 0 ? <p className="text-meta">{t("teacher.upToDate")}</p> : <ListaDePrioridades lista={{ ...lista, esperando: [] }} soloLectura={soloLectura} />}
              </NextIntlClientProvider>
            </section>

            <section aria-labelledby="doc-hoy" className="space-y-3">
              <h2 id="doc-hoy" className="text-section">{t("teacher.todayClasses")}</h2>
              {clases.hoy.length === 0 ? (
                <p className="text-meta">{t("teacher.noClassesToday")}</p>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {clases.hoy.map((c) => {
                    const clave = claveDeClase(c.origen, c.id);

                    return (
                      <li key={clave}>
                        <Card className="space-y-3 p-4">
                          <div>
                            <p className="text-body font-semibold">{c.nombre}</p>
                            <p className="text-meta">{[c.horario, c.aula].filter(Boolean).join(" · ")}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button asChild size="sm" variant="outline">
                              <Link href={`/portal/profesor/clases/${clave}?tab=attendance`}>
                                <CalendarCheck aria-hidden />
                                {t("teacher.takeAttendance")}
                              </Link>
                            </Button>
                            <Button asChild size="sm" variant="ghost">
                              <Link href={`/portal/profesor/clases/${clave}`}>{t("teacher.openClass")}</Link>
                            </Button>
                          </div>
                        </Card>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
          <LateralInicio agenda={agenda} accesos={ACCESOS_RAPIDOS.docente} locale={locale} />
        </div>
      )}
    </PageContainer>
  );
}

const DIA_SEMANA: Record<string, Intl.DateTimeFormatOptions> = { es: { weekday: "long" }, en: { weekday: "long" } };

/** Estudiante: lo que tiene que hacer, sus clases con avance, su beca del mes y la agenda. */
export async function InicioEstudiante({ usuario, lista, locale, mensajes, saludo, soloLectura, atras }: Props) {
  const idioma = locale === "en" ? "en" : "es";
  const estudiante = await estudianteDeUsuario(usuario.id);
  const [t, tBeca, clases, tareas, ventana, beca, agenda] = await Promise.all([
    getTranslations({ locale, namespace: "priorities" }),
    getTranslations({ locale, namespace: "studentClasses" }),
    clasesDelEstudiante(estudiante.id),
    tareasDelEstudiante(estudiante.id, idioma),
    ventanaVigente(),
    becaDelMes(usuario.id, estudiante.id),
    agendaDeHoy(usuario),
  ]);

  const enSemana = todos(lista).filter((i) => i.tipo === "tarea_por_entregar").length;
  const abierta = ventana?.abierta ?? false;
  const diaCierre = ventana ? new Intl.DateTimeFormat(idioma, { ...DIA_SEMANA[idioma], timeZone: "America/Santo_Domingo" }).format(new Date(`${ventana.cierra.slice(0, 10)}T12:00:00Z`)) : "";
  const resumen = [enSemana > 0 ? t("student.summaryTasks", { n: enSemana }) : t("student.summaryClear"), abierta ? t("student.summaryWindow", { dia: diaCierre }) : null].filter(Boolean).join(" ");
  const bloques: { clave: string; titulo: string; detalle?: string; estado: string }[] = [
    { clave: "idx", titulo: tBeca("scholarship.status"), detalle: beca.indice === null ? t("student.indexNone") : t("student.indexLine", { indice: beca.indice.toFixed(2), minimo: beca.minimo.toFixed(2) }), estado: beca.estadoBeca },
    { clave: "srv", titulo: t("student.service"), estado: beca.servicio },
    { clave: "mtg", titulo: t("student.meeting"), estado: beca.reunion },
  ];

  return (
    <PageContainer className="max-w-[1100px] space-y-6">
      <PageHeader title={saludo} subtitle={resumen} secondaryActions={atras} />

      {abierta && ventana && (
        <Link
          href="/portal/estudiante/prematricula"
          className="text-label inline-flex min-h-9 items-center gap-2 self-start rounded-full border border-status-warning-border bg-status-warning-bg px-3.5 py-1.5 text-status-warning-fg hover:underline"
        >
          {t("student.windowOpen", { fecha: fechaCorta(ventana.cierra.slice(0, 10), idioma) })}
          <ChevronRight aria-hidden className="size-4" />
        </Link>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="min-w-0 space-y-8 lg:col-span-2">
          <section aria-labelledby="est-hacer" className="space-y-3">
            <h2 id="est-hacer" className="text-section">{t("student.todo")}</h2>
            <NextIntlClientProvider messages={mensajes}>
              {lista.total === 0 ? <p className="text-meta">{t("upToDate")}</p> : <ListaDePrioridades lista={{ ...lista, esperando: [] }} soloLectura={soloLectura} />}
            </NextIntlClientProvider>
          </section>

          <section aria-labelledby="est-clases" className="space-y-3">
            <h2 id="est-clases" className="text-section">{t("student.myClasses")}</h2>
            {clases.length === 0 ? (
              <p className="text-meta">{t("student.noClasses")}</p>
            ) : (
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {clases.map((c) => {
                  const clave = claveDeClase(c.origen, c.id);

                  return (
                    <li key={clave} className="min-w-0">
                      <TarjetaClase clase={c} tareas={tareas.filter((x) => x.claveClase === clave)} />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <div className="min-w-0 space-y-8">
          <section aria-labelledby="est-beca">
            <h2 id="est-beca" className="text-section mb-3">{t("student.myScholarship")}</h2>
            <Card className="space-y-3 p-4">
              <ul className="space-y-3">
                {bloques.map((b) => (
                  <li key={b.clave} className="flex items-center justify-between gap-3">
                    <span className="min-w-0">
                      <span className="text-body block truncate font-semibold">{b.titulo}</span>
                      {b.detalle && <span className="text-meta block truncate">{b.detalle}</span>}
                    </span>
                    <StatusBadge status={b.estado} label={tBeca(`scholarship.states.${b.estado}` as never)} />
                  </li>
                ))}
              </ul>
              <Button asChild size="sm" variant="ghost" className="self-start">
                <Link href="/portal/estudiante/beca">
                  <GraduationCap aria-hidden />
                  {t("student.seeDetails")}
                </Link>
              </Button>
            </Card>
          </section>
          <LateralInicio agenda={agenda} accesos={ACCESOS_RAPIDOS.estudiante} locale={locale} />
        </div>
      </div>
    </PageContainer>
  );
}

/** Habitudes (facilitador y dirección): visitas y evidencias, accesos a Recursos y Postular y una línea de impacto. */
export async function InicioHabitudes({ usuario, lista, locale, mensajes, saludo, soloLectura, atras }: Props) {
  const [t, agenda, impacto] = await Promise.all([
    getTranslations({ locale, namespace: "priorities" }),
    agendaDeHoy(usuario),
    impactoDelAnio(),
  ]);
  const items = todos(lista);
  const visitas = items.filter((i) => i.tipo === "visita_hoy" || i.tipo === "visita_semana").length;
  const evidencias = items.filter((i) => i.tipo === "evidencia_faltante").length;
  const acceso = ACCESOS_RAPIDOS[usuario.rol === "dir_habitudes" ? "dir_habitudes" : "habitudes"];

  return (
    <PageContainer className="max-w-[1100px] space-y-6">
      <PageHeader
        title={saludo}
        subtitle={visitas + evidencias > 0 ? t("habitudes.summary", { v: visitas, e: evidencias }) : t("habitudes.summaryClear")}
        secondaryActions={atras}
      />
      <p className="text-meta">{t("habitudes.impact", { n: impacto.estudiantes.toLocaleString(locale === "en" ? "en-US" : "es-DO"), l: impacto.liceos })}</p>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <section aria-labelledby="hab-hacer" className="min-w-0 space-y-3 lg:col-span-2">
          <h2 id="hab-hacer" className="text-section">{t("habitudes.todo")}</h2>
          <NextIntlClientProvider messages={mensajes}>
            {lista.total === 0 ? <p className="text-meta">{t("upToDate")}</p> : <ListaDePrioridades lista={{ ...lista, esperando: [] }} soloLectura={soloLectura} />}
          </NextIntlClientProvider>
        </section>
        <LateralInicio agenda={agenda} accesos={acceso} locale={locale} />
      </div>
    </PageContainer>
  );
}
