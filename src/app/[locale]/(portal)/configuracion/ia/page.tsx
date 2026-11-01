import type { Metadata } from "next";
import { Activity, Coins, Cpu, ShieldCheck, ShieldAlert, Users } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { EditorAgente, FormularioCuota, FormularioPrecio } from "@/components/ia-admin/formularios-uso";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { StatCard } from "@/components/ui/stat-card";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirPermiso } from "@/lib/auth";
import { fechaConHora } from "@/lib/fechas";
import { TARJETA } from "@/lib/paleta";
import { anularCuota, eliminarCuota } from "@/server/ia/acciones-admin";
import { verificarCadena } from "@/server/ia/cadena";
import {
  accionesRecientes,
  agentes,
  consumoPorAgente,
  consumoPorDia,
  consumoPorModelo,
  cuotas,
  mayoresConsumidores,
  precios,
  resumenDelMes,
} from "@/server/ia/consultas-admin";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "iaAdmin" });

  return { title: t("title") };
}

/**
 * Tablero de Nexus AI: cuánto se usa, quién, con qué modelo y qué hizo el
 * agente. Solo metadatos: el contenido de las conversaciones no se muestra.
 * Aquí también se fijan cuotas, precios y la configuración de cada agente.
 */
export default async function PaginaIA({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const usuario = await requerirPermiso("ia.administrar");

  const [t, tRoles, resumen, porAgente, porModelo, porDia, mayores, listaCuotas, listaPrecios, listaAgentes, acciones, cadena, mensajes] =
    await Promise.all([
      getTranslations({ locale, namespace: "iaAdmin" }),
      getTranslations({ locale, namespace: "roles" }),
      resumenDelMes(),
      consumoPorAgente(),
      consumoPorModelo(),
      consumoPorDia(14),
      mayoresConsumidores(),
      cuotas(),
      precios(),
      agentes(),
      accionesRecientes(),
      verificarCadena(),
      mensajesCliente(["iaAdmin"]),
    ]);

  const numero = new Intl.NumberFormat(locale);
  const dinero = (valor: number | null) =>
    valor === null ? "—" : `US$ ${valor.toFixed(valor < 1 ? 4 : 2)}`;
  const maximoDia = Math.max(1, ...porDia.map((d) => d.tokens));
  const nombreAgente = (clave: string) =>
    t.has(`agentNames.${clave}`) ? t(`agentNames.${clave}`) : clave;

  return (
    <div className="animate-entrada mx-auto max-w-5xl space-y-8 pb-10">
      <EncabezadoPagina titulo={t("title")} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard valor={numero.format(resumen.tokens)} etiqueta={t("stats.tokens")} icono={Cpu} acento />
        <StatCard valor={numero.format(resumen.llamadas)} etiqueta={t("stats.calls")} icono={Activity} />
        <StatCard valor={numero.format(resumen.personas)} etiqueta={t("stats.people")} icono={Users} />
        <StatCard
          valor={dinero(resumen.costo)}
          etiqueta={resumen.costo === null ? t("stats.costUnknown") : t("stats.cost")}
          icono={Coins}
        />
      </div>

      <Card className={TARJETA.contenido}>
        <CardContent className="space-y-3 pt-5">
          <p className="texto-titulo-tarjeta">{t("byDay")}</p>
          <div className="flex h-28 items-end gap-1" role="img" aria-label={t("byDay")}>
            {porDia.map((d) => (
              <div key={d.dia} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${d.dia}: ${numero.format(d.tokens)}`}>
                <div
                  className="bg-marca-500 w-full rounded-t"
                  style={{ height: `${Math.max(2, (d.tokens / maximoDia) * 100)}%` }}
                />
              </div>
            ))}
          </div>
          <div className="texto-meta flex justify-between">
            <span>{porDia[0]?.dia}</span>
            <span>{porDia.at(-1)?.dia}</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <TablaConsumo titulo={t("byAgent")} filas={porAgente} nombre={nombreAgente} t={t} numero={numero} dinero={dinero} />
        <TablaConsumo titulo={t("byModel")} filas={porModelo} nombre={(c) => c} t={t} numero={numero} dinero={dinero} />
      </div>

      <Card className={TARJETA.contenido}>
        <CardContent className="space-y-3 pt-5">
          <p className="texto-titulo-tarjeta">{t("topUsers")}</p>
          {mayores.length === 0 ? (
            <p className="texto-meta">{t("noUsage")}</p>
          ) : (
            <ul className="divide-linea divide-y">
              {mayores.map((m) => (
                <li key={`${m.nombre}-${m.rol}`} className="flex items-center justify-between gap-3 py-2 text-[15px]">
                  <span className="min-w-0 truncate">
                    {m.nombre} <span className="texto-meta">· {tRoles(m.rol as never)}</span>
                  </span>
                  <span className="shrink-0 font-medium">{numero.format(m.tokens)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <NextIntlClientProvider messages={mensajes}>
        <Card className={TARJETA.contenido}>
          <CardContent className="space-y-4 pt-5">
            <div>
              <p className="texto-titulo-tarjeta">{t("quotas.title")}</p>
            </div>

            {listaCuotas.length > 0 && (
              <ul className="divide-linea divide-y">
                {listaCuotas.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[15px]">
                    <span className="min-w-0">
                      {c.alcance === "rol" ? tRoles(c.quien as never) : c.quien}
                      <span className="texto-meta"> · {numero.format(c.tokensMes)} · {t("quotas.warnShort", { pct: c.avisoPct })}</span>
                      {c.anuladaHasta && (
                        <Badge variant="neutra" className="ml-2">
                          {t("quotas.overriddenUntil", { fecha: fechaConHora(c.anuladaHasta, null, usuario.idioma) })}
                        </Badge>
                      )}
                    </span>
                    <span className="flex items-center gap-2">
                      <form action={anularCuota} className="flex items-center gap-1">
                        <input type="hidden" name="id" value={c.id} />
                        <input type="number" name="dias" defaultValue={7} min={1} max={90} aria-label={t("quotas.days")} className="border-linea-fuerte h-9 w-16 rounded-control border px-2 text-sm" />
                        <Button type="submit" variant="outline" size="sm">{t("quotas.override")}</Button>
                      </form>
                      <form action={eliminarCuota}>
                        <input type="hidden" name="id" value={c.id} />
                        <Button type="submit" variant="ghost" size="sm">{t("quotas.remove")}</Button>
                      </form>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <FormularioCuota />
          </CardContent>
        </Card>

        <Card className={TARJETA.contenido}>
          <CardContent className="space-y-4 pt-5">
            <div>
              <p className="texto-titulo-tarjeta">{t("prices.title")}</p>
            </div>

            {listaPrecios.length > 0 && (
              <ul className="divide-linea divide-y">
                {listaPrecios.map((p) => (
                  <li key={p.modelo} className="flex flex-wrap justify-between gap-2 py-2 text-[15px]">
                    <span className="font-medium">{p.modelo}</span>
                    <span className="texto-meta">
                      {t("prices.line", { entrada: p.entrada, salida: p.salida, cache: p.cache })}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <FormularioPrecio />
          </CardContent>
        </Card>

        <div className="space-y-3">
          <div>
            <p className="texto-titulo-tarjeta">{t("agents.title")}</p>
          </div>
          {listaAgentes.map((a) => (
            <EditorAgente
              key={a.clave}
              clave={a.clave}
              nombre={nombreAgente(a.clave)}
              roles={a.roles.map((r) => tRoles(r as never)).join(", ")}
              instrucciones={a.instrucciones ?? ""}
              modelo={a.modelo ?? ""}
              maxTokens={a.maxTokens}
              limiteHora={a.limiteHora}
              activo={a.activo}
            />
          ))}
        </div>
      </NextIntlClientProvider>

      <Card className={TARJETA.contenido}>
        <CardContent className="space-y-3 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="texto-titulo-tarjeta">{t("actions.title")}</p>
            <p className="flex items-center gap-1.5 text-sm font-medium">
              {cadena.ok ? <ShieldCheck className="text-marca-600 size-4" /> : <ShieldAlert className="size-4" />}
              {cadena.ok ? t("actions.chainOk", { n: cadena.filas }) : t("actions.chainBroken")}
            </p>
          </div>

          {acciones.length === 0 ? (
            <p className="texto-meta">{t("actions.empty")}</p>
          ) : (
            <ul className="divide-linea divide-y">
              {acciones.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[15px]">
                  <span className="min-w-0">
                    <span className="font-medium">{a.herramienta}</span>
                    <span className="texto-meta"> · {a.persona} · {nombreAgente(a.agente)}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="texto-meta">{fechaConHora(a.cuando, null, usuario.idioma)}</span>
                    <Badge variant="neutra">{a.deshecha ? t("actions.state.deshecha") : t(`actions.state.${a.estado}`)}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TablaConsumo({
  titulo,
  filas,
  nombre,
  t,
  numero,
  dinero,
}: {
  titulo: string;
  filas: { clave: string; llamadas: number; tokens: number; costo: number | null }[];
  nombre: (clave: string) => string;
  t: Awaited<ReturnType<typeof getTranslations>>;
  numero: Intl.NumberFormat;
  dinero: (valor: number | null) => string;
}) {
  return (
    <Card className={TARJETA.contenido}>
      <CardContent className="space-y-3 pt-5">
        <p className="texto-titulo-tarjeta">{titulo}</p>
        {filas.length === 0 ? (
          <p className="texto-meta">{t("noUsage")}</p>
        ) : (
          <ul className="divide-linea divide-y">
            {filas.map((f) => (
              <li key={f.clave} className="flex items-center justify-between gap-3 py-2 text-[15px]">
                <span className="min-w-0 truncate">
                  {nombre(f.clave)} <span className="texto-meta">· {t("calls", { n: f.llamadas })}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="font-medium">{numero.format(f.tokens)}</span>
                  <span className="texto-meta block">{dinero(f.costo)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
