import type { Metadata } from "next";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Inbox,
  Landmark,
  Repeat,
  Undo2,
} from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { ListaPorRevisar } from "@/components/contabilidad/mi-dia/lista-por-revisar";
import { ReglaAutonomia } from "@/components/contabilidad/mi-dia/regla-autonomia";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { StatCard } from "@/components/ui/stat-card";
import { Link } from "@/i18n/navigation";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirPermiso } from "@/lib/auth";
import { TARJETA } from "@/lib/paleta";
import { usuarioTienePermiso } from "@/lib/rbac";
import { devolverALaCola } from "@/server/contabilidad/automatizacion/acciones";
import {
  anomalias,
  aprobadosRecientes,
  colaMiDia,
  comprobantesPorRevisar,
  esAprobable,
  metricasMiDia,
  reglaClasificacion,
} from "@/server/contabilidad/automatizacion/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "miDia" });

  return { title: t("title") };
}

/**
 * «Mi día» de la contadora: una cola priorizada con lo que necesita SU decisión.
 * El sistema prepara (clasifica, detecta duplicados, avisa de vencimientos); ella
 * decide, en lote y con teclado. Y la pantalla mide si de verdad ahorra tiempo.
 */
export default async function PaginaMiDia({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const usuario = await requerirPermiso("contabilidad.leer");

  const [t, mensajes, cola, items, regla, metricas, senales, recientes] = await Promise.all([
    getTranslations({ locale, namespace: "miDia" }),
    mensajesCliente(["miDia"]),
    colaMiDia(),
    comprobantesPorRevisar(),
    reglaClasificacion(),
    metricasMiDia(),
    anomalias(30),
    aprobadosRecientes(),
  ]);

  const dinero = new Intl.NumberFormat(locale, { style: "currency", currency: "DOP", maximumFractionDigits: 0 });
  const monto = (valor: number) => dinero.format(valor);
  const aprobables = items.filter(esAprobable).map((i) => i.id);
  const formatoMonto = Object.fromEntries(
    items.map((i) => [i.id, i.moneda === "DOP" ? monto(i.monto) : `${i.moneda} ${i.monto.toLocaleString(locale)}`]),
  );

  const duracion = (segundos: number | null) => {
    if (segundos === null) return t("metrics.noData");

    const horas = segundos / 3600;

    return horas >= 1 ? t("metrics.hours", { n: horas.toFixed(1) }) : t("metrics.minutes", { n: Math.max(1, Math.round(segundos / 60)) });
  };

  const linea = (a: (typeof senales)[number]) => {
    const [n, umbral] = a.detalle.split("|");
    const base = { proveedor: a.proveedor ?? "—", monto: monto(a.monto) };

    switch (a.tipo) {
      case "compra_fraccionada":
        return t("anomalies.compra_fraccionada", { ...base, n: n ?? "", umbral: monto(Number(umbral)) });
      case "monto_atipico":
        return t("anomalies.monto_atipico", { ...base, media: monto(Number(a.detalle)) });
      case "fin_de_semana":
        return t("anomalies.fin_de_semana", { ...base, fecha: a.fecha });
      default:
        return t("anomalies.proveedor_nuevo_monto_alto", { ...base, umbral: monto(Number(a.detalle)) });
    }
  };

  const agenda = [
    cola.cxpVencidas.cantidad > 0 && {
      clave: "vencidas",
      icono: AlertTriangle,
      texto: t("agenda.cxpOverdue", { n: cola.cxpVencidas.cantidad, monto: monto(cola.cxpVencidas.saldo) }),
      href: "/contabilidad/cuentas-por-pagar",
    },
    cola.cxpPorVencer.cantidad > 0 && {
      clave: "por-vencer",
      icono: Clock,
      texto: t("agenda.cxpSoon", { n: cola.cxpPorVencer.cantidad, monto: monto(cola.cxpPorVencer.saldo) }),
      href: "/contabilidad/cuentas-por-pagar",
    },
    cola.ordenesPendientes > 0 && {
      clave: "ordenes",
      icono: Inbox,
      texto: t("agenda.orders", { n: cola.ordenesPendientes }),
      href: "/contabilidad/ordenes-compra",
    },
    cola.conciliacionesAbiertas > 0 && {
      clave: "conciliaciones",
      icono: Landmark,
      texto: t("agenda.reconciliations", { n: cola.conciliacionesAbiertas }),
      href: "/contabilidad/bancos",
    },
    ...cola.recurrentes.map((r) => ({
      clave: `rec-${r.id}`,
      icono: Repeat,
      texto: t("agenda.recurring", { nombre: r.nombre, dia: r.dia }),
      href: "/contabilidad/asientos",
    })),
    ...cola.obligaciones.map((o) => ({
      clave: `fiscal-${o.codigo}`,
      icono: CalendarClock,
      texto: o.dias === 0 ? t("agenda.fiscalToday", { codigo: o.codigo }) : t("agenda.fiscal", { codigo: o.codigo, dias: o.dias, fecha: o.fecha }),
      href: "/contabilidad/impuestos",
    })),
  ].filter((fila): fila is Exclude<typeof fila, false> => fila !== false);

  const pctAceptadas =
    metricas.conSugerencia > 0 ? Math.round((metricas.aceptadasSinCorregir / metricas.conSugerencia) * 100) : null;

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-10 animate-entrada">
      <EncabezadoPagina titulo={t("title")} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard valor={items.length} etiqueta={t("stats.toReview")} icono={Inbox} acento />
        <StatCard valor={cola.cxpVencidas.cantidad} etiqueta={t("stats.overdue")} icono={AlertTriangle} />
        <StatCard valor={cola.cxpPorVencer.cantidad} etiqueta={t("stats.dueSoon")} icono={Clock} />
        <StatCard valor={cola.ordenesPendientes} etiqueta={t("stats.pendingOrders")} icono={CheckCircle2} />
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="texto-titulo-seccion">{t("queue.title")}</p>
          <Link href="/contabilidad/comprobantes-recibidos" className="text-marca-700 text-sm font-medium hover:underline">
            {t("queue.openAll")}
          </Link>
        </div>

        <Card className={TARJETA.contenido}>
          <CardContent className="pt-5">
            {items.length === 0 ? (
              <EstadoVacio icono={Inbox} titulo={t("queue.emptyTitle")} />
            ) : (
              <NextIntlClientProvider messages={mensajes}>
                <ListaPorRevisar items={items} aprobables={aprobables} nivel={regla.nivel} formatoMonto={formatoMonto} />
              </NextIntlClientProvider>
            )}
          </CardContent>
        </Card>
      </section>

      {recientes.length > 0 && (
        <section className="space-y-3">
          <p className="texto-titulo-seccion">{t("recent.title")}</p>
          <Card className={TARJETA.contenido}>
            <CardContent className="pt-5">
              <p className="texto-meta mb-2">{t("recent.hint")}</p>
              <ul className="divide-linea divide-y">
                {recientes.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[15px]">
                    <span className="min-w-0">
                      #{r.folio} · {r.proveedor ?? "—"} · {monto(r.monto)}
                      {r.automatico && <span className="texto-meta"> · {t("recent.auto")}</span>}
                    </span>
                    <form action={devolverALaCola}>
                      <input type="hidden" name="id" value={r.id} />
                      <Button type="submit" variant="ghost" size="sm">
                        <Undo2 className="size-4" />
                        {t("recent.undo")}
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      )}

      <section className="space-y-3">
        <p className="texto-titulo-seccion">{t("agenda.title")}</p>
        <Card className={TARJETA.contenido}>
          <CardContent className="pt-5">
            {agenda.length === 0 ? (
              <p className="texto-meta">{t("agenda.allClear")}</p>
            ) : (
              <ul className="divide-linea divide-y">
                {agenda.map((fila) => (
                  <li key={fila.clave}>
                    <Link href={fila.href} className="hover:bg-muted flex min-h-11 items-center gap-3 rounded-control px-2 py-2 text-[15px]">
                      <fila.icono className="text-tinta-2 size-4 shrink-0" />
                      {fila.texto}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <div>
          <p className="texto-titulo-seccion">{t("anomalies.title")}</p>
          <p className="texto-meta">{t("anomalies.hint")}</p>
        </div>
        <Card className={TARJETA.contenido}>
          <CardContent className="pt-5">
            {senales.length === 0 ? (
              <p className="texto-meta">{t("anomalies.none")}</p>
            ) : (
              <ul className="divide-linea divide-y">
                {senales.map((a) => (
                  <li key={`${a.tipo}-${a.id}`} className="flex items-start gap-3 py-2 text-[15px]">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    {linea(a)}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <p className="texto-titulo-seccion">{t("metrics.title")}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard valor={metricas.revisados} etiqueta={t("metrics.reviewed")} icono={CheckCircle2} variant="centrada" />
          <StatCard valor={duracion(metricas.segundosPorComprobante)} etiqueta={t("metrics.time")} icono={Clock} variant="centrada" />
          <StatCard valor={pctAceptadas === null ? "—" : `${pctAceptadas} %`} etiqueta={t("metrics.accepted")} icono={CheckCircle2} variant="centrada" />
        </div>
        <p className="texto-meta">{t("metrics.clicksNote")}</p>
      </section>

      <section className="space-y-3">
        <p className="texto-titulo-seccion">{t("rule.title")}</p>
        <Card className={TARJETA.contenido}>
          <CardContent className="pt-5">
            <NextIntlClientProvider messages={mensajes}>
              <ReglaAutonomia
                nivel={regla.nivel}
                umbralConfianza={regla.umbralConfianza}
                umbralMonto={regla.umbralMonto}
                puedeConfigurar={usuarioTienePermiso(usuario, "contabilidad.configurar")}
              />
            </NextIntlClientProvider>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
