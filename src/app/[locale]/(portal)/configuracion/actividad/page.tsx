import type { Metadata } from "next";
import {
  Activity,
  ArrowLeft,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  LogIn,
  ShieldAlert,
  Users,
  X,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import {
  GraficaHorizontal,
  GraficaPorDia,
  GraficaPorHora,
} from "@/components/auditoria/graficas-actividad";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChipFiltro } from "@/components/ui/chip-filtro";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { FilaChips } from "@/components/ui/fila-chips";
import { StatCard } from "@/components/ui/stat-card";
import { Link } from "@/i18n/navigation";
import { requerirRol } from "@/lib/auth";
import { claveI18n, partirAccion } from "@/lib/actividad";
import { TARJETA } from "@/lib/paleta";
import {
  actividadPorDia,
  actividadPorHora,
  actividadPorModulo,
  actividadPorPersona,
  conectadosRecientes,
  lineaDeTiempo,
  personasConActividad,
  POR_PAGINA_LINEA,
  rangoValido,
  resumenDeActividad,
} from "@/server/auditoria/actividad";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "actividad" });

  return { title: t("title") };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ORIGENES = ["sistema", "contabilidad", "asistente", "inventario"] as const;
const SELECT =
  "border-linea-fuerte bg-background h-11 w-full rounded-control border px-3 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Actividad del equipo: quién hizo qué y a qué hora. Solo `super_admin`.
 *
 * Junta el rastro de todos los módulos en una línea de tiempo y lo resume en
 * cuatro gráficas. No enseña el detalle de cada evento (para eso está el
 * registro de auditoría, que además tapa lo clínico): enseña quién, qué, sobre
 * qué y cuándo.
 */
export default async function PaginaActividad({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ dias?: string; usuario?: string; modulo?: string; origen?: string; pagina?: string }>;
}) {
  const { locale } = await params;
  const consulta = await searchParams;

  await requerirRol(["super_admin"]);

  const dias = rangoValido(consulta.dias);
  const usuarioId = consulta.usuario && UUID.test(consulta.usuario) ? consulta.usuario : null;
  const modulo = consulta.modulo && /^[a-z0-9_]{1,40}$/.test(consulta.modulo) ? consulta.modulo : null;
  const origen = (ORIGENES as readonly string[]).includes(consulta.origen ?? "") ? (consulta.origen as string) : null;
  const pagina = Math.max(1, Number(consulta.pagina) || 1);

  const [t, tRoles, resumen, porHora, porDia, porPersona, porModulo, conectados, personas, linea] =
    await Promise.all([
      getTranslations({ locale, namespace: "actividad" }),
      getTranslations({ locale, namespace: "roles" }),
      resumenDeActividad(dias),
      actividadPorHora(dias),
      actividadPorDia(dias),
      actividadPorPersona(dias),
      actividadPorModulo(dias),
      conectadosRecientes(),
      personasConActividad(dias),
      lineaDeTiempo({ dias, usuarioId, modulo, origen, pagina }),
    ]);

  const hora = new Intl.DateTimeFormat(locale, { timeZone: "America/Santo_Domingo", hour: "2-digit", minute: "2-digit" });
  const fechaHora = new Intl.DateTimeFormat(locale, {
    timeZone: "America/Santo_Domingo",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  const nombreModulo = (m: string) => (t.has(`modulos.${claveI18n(m)}`) ? t(`modulos.${claveI18n(m)}`) : m);
  // Un verbo compuesto (`crear_tarea.ejecutada`) se traduce por partes: las que
  // no tengan traducción se enseñan tal cual, sin guiones bajos.
  const nombreVerbo = (v: string) =>
    v
      .split(".")
      .map((parte) => (t.has(`verbos.${claveI18n(parte)}`) ? t(`verbos.${claveI18n(parte)}`) : parte.replace(/_/g, " ")))
      .join(" · ");
  const rol = (r: string | null) => (r ? tRoles(r as never) : "");

  const ultima = Math.max(1, Math.ceil(linea.total / POR_PAGINA_LINEA));
  const url = (cambios: Record<string, string | number | null>) => {
    const p = new URLSearchParams();
    const actual: Record<string, string | number | null> = { dias, usuario: usuarioId, modulo, origen, pagina: null, ...cambios };

    for (const [k, v] of Object.entries(actual)) if (v !== null && v !== "" && !(k === "dias" && v === 7)) p.set(k, String(v));

    const s = p.toString();

    return s ? `/configuracion/actividad?${s}` : "/configuracion/actividad";
  };

  const hayFiltro = Boolean(usuarioId || modulo || origen);

  return (
    <div className="animate-entrada mx-auto max-w-5xl space-y-8 pb-10">
      <Button asChild variant="outline" size="sm">
        <Link href="/configuracion">
          <ArrowLeft className="size-4" />
          {t("back")}
        </Link>
      </Button>

      <EncabezadoPagina
        titulo={t("title")}
        acciones={
          <Button asChild variant="outline">
            {/* Un enlace normal y no `Link`: es una descarga, no una navegación. */}
            <a href={url({ pagina: null }).replace("/configuracion/actividad", "/api/actividad/exportar")}>
              <Download className="size-4" />
              {t("export")}
            </a>
          </Button>
        }
      />

      <FilaChips etiqueta={t("range.label")}>
        <ChipFiltro icono={Clock} etiqueta={t("range.today")} href={url({ dias: 1 })} activo={dias === 1} />
        <ChipFiltro icono={CalendarDays} etiqueta={t("range.week")} href={url({ dias: 7 })} activo={dias === 7} />
        <ChipFiltro icono={CalendarRange} etiqueta={t("range.month")} href={url({ dias: 30 })} activo={dias === 30} />
        <ChipFiltro icono={CalendarRange} etiqueta={t("range.quarter")} href={url({ dias: 90 })} activo={dias === 90} />
      </FilaChips>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard valor={resumen.eventos} etiqueta={t("stats.events")} icono={Activity} acento />
        <StatCard valor={resumen.personas} etiqueta={t("stats.people")} icono={Users} />
        <StatCard valor={resumen.sesiones} etiqueta={t("stats.logins")} icono={LogIn} />
        <StatCard
          valor={resumen.activasAhora}
          etiqueta={t("stats.activeNow")}
          icono={Clock}
        />
      </div>

      {resumen.fallidas > 0 && (
        <p role="status" className="bg-tinta text-background flex items-start gap-2 rounded-control px-4 py-3 text-sm">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          {t("failedLogins", { n: resumen.fallidas })}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta titulo={t("charts.byHour")}>
          <GraficaPorHora datos={porHora} etiqueta={t("charts.events")} />
        </Tarjeta>
        <Tarjeta titulo={t("charts.byDay")}>
          <GraficaPorDia datos={porDia} etiqueta={t("charts.events")} />
        </Tarjeta>
        <Tarjeta titulo={t("charts.byPerson")}>
          {porPersona.length === 0 ? (
            <p className="texto-meta">{t("noData")}</p>
          ) : (
            <GraficaHorizontal
              datos={porPersona.map((p) => ({ nombre: p.nombre, eventos: p.eventos }))}
              etiqueta={t("charts.events")}
            />
          )}
        </Tarjeta>
        <Tarjeta titulo={t("charts.byModule")}>
          {porModulo.length === 0 ? (
            <p className="texto-meta">{t("noData")}</p>
          ) : (
            <GraficaHorizontal
              datos={porModulo.map((m) => ({ nombre: nombreModulo(m.modulo), eventos: m.eventos }))}
              etiqueta={t("charts.events")}
            />
          )}
        </Tarjeta>
      </div>

      <Card className={TARJETA.contenido}>
        <CardContent className="space-y-3 pt-5">
          <div>
            <p className="texto-titulo-tarjeta">{t("recent.title")}</p>
          </div>

          {conectados.length === 0 ? (
            <p className="texto-meta">{t("recent.none")}</p>
          ) : (
            <ul className="divide-linea divide-y">
              {conectados.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[15px]">
                  <Link href={url({ usuario: c.id })} className="min-w-0 hover:underline">
                    {c.nombre} <span className="texto-meta">· {rol(c.rol)}</span>
                  </Link>
                  <span className="texto-meta flex items-center gap-2">
                    {c.minutos < 10 && <Badge variant="marca">{t("recent.now")}</Badge>}
                    {c.minutos < 60 ? t("recent.minutesAgo", { n: Math.max(1, c.minutos) }) : fechaHora.format(c.ultimoAcceso)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <p className="texto-titulo-seccion">{t("timeline.title")}</p>

        <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
          <input type="hidden" name="dias" value={dias} />
          <label className="text-sm font-medium">
            {t("timeline.person")}
            <select name="usuario" defaultValue={usuarioId ?? ""} className={SELECT}>
              <option value="">{t("timeline.allPeople")}</option>
              {personas.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            {t("timeline.module")}
            <select name="modulo" defaultValue={modulo ?? ""} className={SELECT}>
              <option value="">{t("timeline.allModules")}</option>
              {porModulo.map((m) => (
                <option key={m.modulo} value={m.modulo}>{nombreModulo(m.modulo)}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            {t("timeline.source")}
            <select name="origen" defaultValue={origen ?? ""} className={SELECT}>
              <option value="">{t("timeline.allSources")}</option>
              {ORIGENES.map((o) => (
                <option key={o} value={o}>{t(`sources.${o}`)}</option>
              ))}
            </select>
          </label>
          <Button type="submit">{t("timeline.filter")}</Button>
          {hayFiltro && (
            <Button asChild variant="ghost">
              <Link href={url({ usuario: null, modulo: null, origen: null })}>
                <X className="size-4" />
                {t("timeline.clear")}
              </Link>
            </Button>
          )}
        </form>

        <Card className={TARJETA.contenido}>
          <CardContent className="pt-5">
            {linea.eventos.length === 0 ? (
              <EstadoVacio icono={Activity} titulo={t("timeline.emptyTitle")} />
            ) : (
              <ul className="divide-linea divide-y">
                {linea.eventos.map((e) => {
                  const { modulo: m, verbo } = partirAccion(e.accion);

                  return (
                    <li key={`${e.origen}-${e.id}`} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-3">
                      <div className="min-w-0">
                        <p className="text-[15px]">
                          <span className="font-semibold">{e.persona ?? t("timeline.unknownPerson")}</span>
                          <span className="texto-meta">{e.rol ? ` · ${rol(e.rol)}` : ""}</span>
                        </p>
                        <p className="text-tinta-2 text-sm">
                          {nombreModulo(m)} · {nombreVerbo(verbo)}
                          {e.objeto && e.objeto !== m ? <span className="texto-meta"> · {e.objeto}</span> : null}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-[15px] font-medium tabular-nums">{hora.format(e.cuando)}</span>
                        <span className="texto-meta">{fechaHora.format(e.cuando)} · {t(`sources.${e.origen}`)}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {ultima > 1 && (
          <div className="flex items-center justify-between gap-2">
            {pagina > 1 ? (
              <Button asChild variant="outline" size="sm">
                <Link href={url({ pagina: pagina - 1 })}>
                  <ChevronLeft className="size-4" />
                  {t("timeline.previous")}
                </Link>
              </Button>
            ) : (
              <span />
            )}
            <p className="texto-meta">{t("timeline.page", { current: pagina, last: ultima })}</p>
            {pagina < ultima ? (
              <Button asChild variant="outline" size="sm">
                <Link href={url({ pagina: pagina + 1 })}>
                  {t("timeline.next")}
                  <ChevronRight className="size-4" />
                </Link>
              </Button>
            ) : (
              <span />
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function Tarjeta({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={TARJETA.contenido}>
      <CardContent className="space-y-2 pt-5">
        <div>
          <p className="texto-titulo-tarjeta">{titulo}</p>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}
