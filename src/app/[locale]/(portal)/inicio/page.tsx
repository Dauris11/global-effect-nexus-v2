import type { Metadata } from "next";
import { CalendarDays, CheckCircle2, ChevronRight } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/app/empty-state";
import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { InicioDocente, InicioEstudiante, InicioHabitudes } from "@/components/inicio/inicio-roles";
import { BotonCrear } from "@/components/prioridades/boton-crear";
import { ListaDePrioridades } from "@/components/prioridades/lista-prioridades";
import { variantesBoton } from "@/components/ui/button-variantes";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { Link } from "@/i18n/navigation";
import { requerirUsuario } from "@/lib/auth";
import { formatearMonto } from "@/lib/contabilidad/formato";
import { diaEnRD, fechaCorta } from "@/lib/fechas";
import { ACCESOS_RAPIDOS, botonPrimarioDe } from "@/lib/prioridades/rapidas";
import { cn } from "@/lib/utils";
import {
  agendaDeHoy,
  cifrasContables,
  contextoInstitucional,
  equipoConVencidas,
  proyectosQueLidero,
} from "@/server/prioridades/inicio";
import { prioridadesDe } from "@/server/prioridades/motor";
import { usuarioSesionDe } from "@/server/prioridades/suplantar";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "priorities" });

  return { title: t("title") };
}

type Vista = "mias" | "esperando" | "equipo";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Inicio de TODOS los roles: ni cifras ni gráficos, sino lo que esta persona tiene que hacer, por
 * urgencia y con el botón para hacerlo (motor en `src/server/prioridades`). Una frase resume el día,
 * a la izquierda va la lista y a la derecha la agenda, los accesos y los proyectos que lidero.
 * Contabilidad suma una fila de tres cifras: es la única excepción.
 *
 * `?persona=<id>` (solo dirección, de LECTURA) muestra las prioridades de alguien del equipo, sin
 * botones que actúen: las acciones siempre las ejecuta quien tiene la sesión.
 */
export default async function PaginaInicio({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ vista?: string; persona?: string }>;
}) {
  const [{ locale }, { vista: vistaPedida, persona }] = await Promise.all([params, searchParams]);
  const real = await requerirUsuario();

  const esDireccion = real.rolReal === "super_admin";
  const ajeno = esDireccion && persona && UUID.test(persona) ? await usuarioSesionDe(persona) : null;
  const usuario = ajeno ?? real;
  const vista: Vista = vistaPedida === "esperando" ? "esperando" : vistaPedida === "equipo" && real.rol === "super_admin" && !ajeno ? "equipo" : "mias";

  const rol = usuario.rol;
  const [t, lista, mensajes, agenda, proyectos, contexto, cifras, equipo] = await Promise.all([
    getTranslations({ locale, namespace: "priorities" }),
    prioridadesDe(usuario),
    mensajesCliente(["priorities", "estados"]),
    agendaDeHoy(usuario),
    proyectosQueLidero(usuario.id),
    rol === "admin" || rol === "super_admin" ? contextoInstitucional() : Promise.resolve([]),
    rol === "contabilidad" ? cifrasContables() : Promise.resolve(null),
    vista === "equipo" ? equipoConVencidas() : Promise.resolve([]),
  ]);

  const vencidas = lista.grupos.vencido.length;
  const hoy = lista.grupos.hoy.length;
  const semana = lista.grupos.semana.length;
  const hora = Number(new Intl.DateTimeFormat("es-DO", { hour: "numeric", hourCycle: "h23", timeZone: "America/Santo_Domingo" }).format(new Date()));
  const saludo = hora < 12 ? "morning" : hora < 19 ? "afternoon" : "evening";
  const partes = [vencidas > 0 && t("summary.overdue", { n: vencidas }), hoy > 0 && t("summary.today", { n: hoy })].filter(Boolean).join(t("summary.and"));
  const resumen = partes
    ? t("summary.pending", { partes })
    : semana > 0
      ? t("summary.uptodateWeek", { n: semana })
      : t("summary.uptodate");

  // Docente, estudiante y Habitudes tienen su propia composición (misma lista, otra cabecera y otros bloques).
  const saludoTexto = t(`greeting.${saludo}`, { nombre: usuario.nombre.split(" ")[0] });
  const atras = ajeno ? (
    <Link href="/inicio?vista=equipo" className={variantesBoton({ variant: "secondary" })}>
      {t("team.back")}
    </Link>
  ) : undefined;
  const propsRol = { usuario, lista, locale, mensajes, saludo: saludoTexto, soloLectura: Boolean(ajeno), atras };
  if (rol === "docente") return <InicioDocente {...propsRol} />;
  if (rol === "estudiante") return <InicioEstudiante {...propsRol} />;
  if (rol === "habitudes" || rol === "dir_habitudes") return <InicioHabitudes {...propsRol} />;

  const primario = ajeno ? null : botonPrimarioDe(rol);
  const accesos = ACCESOS_RAPIDOS[rol];
  const aVista = (v: Vista) => `/inicio?${new URLSearchParams({ ...(v === "mias" ? {} : { vista: v }), ...(ajeno ? { persona: ajeno.id } : {}) })}`.replace(/\?$/, "");

  return (
    <PageContainer className="max-w-[1100px] space-y-6">
      <PageHeader
        title={t(`greeting.${saludo}`, { nombre: usuario.nombre.split(" ")[0] })}
        subtitle={ajeno ? t("team.viewing", { nombre: ajeno.nombre }) : resumen}
        primaryAction={
          primario && (
            <NextIntlClientProvider messages={mensajes}>
              {primario.tipo === "menu" ? (
                <BotonCrear etiqueta={primario.etiqueta} opciones={primario.opciones.map(({ clave, href }) => ({ clave, href }))} />
              ) : (
                <Link href={primario.href} className={variantesBoton({ variant: "default" })}>
                  {t(`primary.${primario.etiqueta}`)}
                </Link>
              )}
            </NextIntlClientProvider>
          )
        }
        secondaryActions={
          ajeno ? (
            <Link href="/inicio?vista=equipo" className={variantesBoton({ variant: "secondary" })}>
              {t("team.back")}
            </Link>
          ) : undefined
        }
      />

      {contexto.length > 0 && !ajeno && (
        <div className="flex flex-wrap gap-2">
          {contexto.slice(0, 2).map((c) => (
            <Link
              key={c.clave}
              href="/academico/prematricula"
              className="text-label inline-flex min-h-9 items-center gap-2 rounded-full border border-status-warning-border bg-status-warning-bg px-3.5 py-1.5 text-status-warning-fg hover:underline"
            >
              {t("context.prematricula", { fecha: fechaCorta(c.cierra, locale === "en" ? "en" : "es"), n: c.sinElegir })}
              <ChevronRight aria-hidden className="size-4" />
            </Link>
          ))}
        </div>
      )}

      {cifras && (
        <dl className="grid grid-cols-3 gap-4 border-y border-linea py-3">
          {[
            [t("figures.bank"), cifras.saldoBancos],
            [t("figures.payable"), cifras.porPagar7],
            [t("figures.income"), cifras.ingresosMes],
          ].map(([etiqueta, valor]) => (
            <div key={etiqueta as string}>
              <dt className="text-meta">{etiqueta as string}</dt>
              <dd className={cn("text-section tabular-nums", (valor as number) < 0 && "text-status-danger-fg")}>{formatearMonto(valor as number, "DOP")}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <nav aria-label={t("tabs.label")} className="flex flex-wrap gap-2">
            {(["mias", "esperando", ...(real.rol === "super_admin" && !ajeno ? (["equipo"] as const) : [])] as Vista[]).map((v) => (
              <Link
                key={v}
                href={aVista(v)}
                aria-current={vista === v ? "page" : undefined}
                className={cn(
                  "text-label inline-flex h-8 items-center gap-1.5 rounded-full border px-3 transition-colors",
                  vista === v ? "border-tinta bg-tinta text-background" : "border-linea-fuerte bg-background text-tinta-2 hover:border-tinta hover:text-tinta",
                )}
              >
                {t(`tabs.${v === "mias" ? "forMe" : v === "esperando" ? "waiting" : "team"}`)}
                {v === "esperando" && lista.esperando.length > 0 && <span className="tabular-nums opacity-75">{lista.esperando.length}</span>}
              </Link>
            ))}
          </nav>

          <NextIntlClientProvider messages={mensajes}>
            {vista === "equipo" ? (
              equipo.length === 0 ? (
                <p className="text-meta">{t("team.empty")}</p>
              ) : (
                <ul data-list className="divide-y divide-linea rounded-card border border-linea bg-card">
                  {equipo.map((p) => (
                    <li key={p.id}>
                      <Link href={`/inicio?persona=${p.id}`} className="flex min-h-14 items-center gap-3 px-3.5 py-2 hover:bg-muted/50">
                        <span className="min-w-0 flex-1">
                          <span className="text-body block truncate font-semibold">{p.nombre}</span>
                        </span>
                        <StatusBadge status={p.vencidas > 0 ? "vencida" : "activo"} label={t("team.overdue", { n: p.vencidas })} />
                        <ChevronRight aria-hidden className="size-4 text-tinta-3" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )
            ) : vista === "esperando" ? (
              lista.esperando.length === 0 ? (
                <p className="text-meta">{t("emptyWaiting")}</p>
              ) : (
                <ListaDePrioridades lista={{ grupos: { vencido: [], hoy: [], semana: [], adelante: [] }, esperando: lista.esperando, total: lista.esperando.length }} soloLectura={Boolean(ajeno)} />
              )
            ) : lista.total - lista.esperando.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title={t("upToDate")}
                action={
                  <Link href="/calendario" className={variantesBoton({ variant: "secondary" })}>
                    <CalendarDays aria-hidden />
                    {t("upToDateAction")}
                  </Link>
                }
              />
            ) : (
              <ListaDePrioridades lista={{ ...lista, esperando: [] }} soloLectura={Boolean(ajeno)} />
            )}
          </NextIntlClientProvider>
        </div>

        <aside className="space-y-8">
          <section aria-labelledby="lateral-agenda">
            <h2 id="lateral-agenda" className="text-section mb-3">{t("side.agenda")}</h2>
            {agenda.length === 0 ? (
              <p className="text-meta">{t("side.agendaEmpty")}</p>
            ) : (
              <ul className="space-y-2">
                {agenda.map((e) => (
                  <li key={`${e.tipo}-${e.id}`} className="flex items-baseline gap-3">
                    <span className="text-meta w-20 shrink-0 tabular-nums">
                      {e.fecha === diaEnRD() ? t("side.today") : t("side.tomorrow")}
                      {e.hora ? ` ${e.hora}` : ""}
                    </span>
                    <span className="text-body min-w-0 truncate">{e.titulo}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="lateral-rapido">
            <h2 id="lateral-rapido" className="text-section mb-3">{t("side.quick")}</h2>
            <ul className="space-y-1">
              {accesos.map((a) => (
                <li key={a.clave}>
                  <Link href={a.href} className="text-body flex min-h-11 items-center gap-3 rounded-control px-2 hover:bg-muted">
                    <a.icono aria-hidden className="size-4 text-tinta-2" />
                    {t(`quick.${a.clave}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="lateral-proyectos">
            <h2 id="lateral-proyectos" className="text-section mb-3">{t("side.projects")}</h2>
            {proyectos.length === 0 ? (
              <p className="text-meta">{t("side.projectsEmpty")}</p>
            ) : (
              <ul className="space-y-3">
                {proyectos.map((p) => (
                  <li key={p.id}>
                    <div className="flex items-center justify-between gap-2">
                      <Link href="/administrativo/proyectos" className="text-body min-w-0 truncate font-semibold hover:underline">{p.nombre}</Link>
                      <StatusBadge status={p.estado} />
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-marca-500" style={{ width: `${Math.min(100, p.progreso)}%` }} />
                      </div>
                      <span className="text-meta w-9 text-right tabular-nums">{p.progreso} %</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </PageContainer>
  );
}
