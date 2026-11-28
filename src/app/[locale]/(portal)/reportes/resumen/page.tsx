import type { Metadata } from "next";
import {
  AlertTriangle,
  CalendarClock,
  Gavel,
  GraduationCap,
  HandCoins,
  HeartHandshake,
  Landmark,
  UserX,
  Users,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { PanelDonantes } from "@/components/ejecutivo/panel-donantes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { GraficoAnillo, GraficoBarras, LeyendaGrafico } from "@/components/ui/grafico";
import { StatCard } from "@/components/ui/stat-card";
import { Link } from "@/i18n/navigation";
import { requerirRol } from "@/lib/auth";
import { formatearMonto } from "@/lib/contabilidad/formato";
import { montoUsd } from "@/lib/finanzas";
import { cargarTableroEjecutivo } from "@/server/ejecutivo/consultas";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "executive" });

  return { title: t("title") };
}

/** La cifra es un enlace a su detalle: el foco y el radio los pone el envoltorio, no la tarjeta. */
const ENLACE = "block rounded-card outline-offset-2 focus-visible:outline-2 focus-visible:outline-marca-500";

/**
 * Resumen ejecutivo (antes «Tablero ejecutivo»): la vista de Dirección Ejecutiva y Junta. Ya NO es
 * la entrada de nadie —el inicio es `/inicio`—: vive dentro de Reportes, sin entrada en el menú, y
 * solo para `owner`. Es de lectura; cada cifra enlaza a la pantalla donde se actúa sobre ella.
 *
 * Saldos en cero tras el reinicio contable: se muestran como 0 y no se oculta
 * la tarjeta, para que la ausencia de movimientos no parezca un error de carga.
 */
export default async function PaginaResumenEjecutivo({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  await requerirRol(["owner"]);

  const t = await getTranslations({ locale, namespace: "executive" });
  const d = await cargarTableroEjecutivo(t("charts.others"));
  const sinDato = (nombre: string) => (nombre === "" ? t("charts.unassigned") : nombre);

  const universidades = d.porUniversidad.map((u) => ({ nombre: sinDato(u.nombre), valor: u.valor }));
  const carreras = d.porCarrera.map((c) => ({ nombre: sinDato(c.nombre), valor: c.valor }));
  const saldo = (moneda: "DOP" | "USD") => d.saldos.find((s) => s.moneda === moneda);
  const cumplimiento = d.cumplimiento;
  const nota = d.indicePromedio === null ? "—" : d.indicePromedio.toFixed(2);

  return (
    <div className="animate-entrada space-y-6 md:space-y-8">
      <EncabezadoPagina titulo={t("title")} />

      <section aria-label={t("sections.scholars")} className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-3">
        <Link href="/expedientes" className={ENLACE}>
          <StatCard etiqueta={t("kpi.activeScholars")} valor={d.becadosActivos} icono={GraduationCap} acento />
        </Link>
        <StatCard etiqueta={t("kpi.avgIndex")} valor={nota} icono={Users} />
        <Link href="/expedientes/riesgo" className={ENLACE}>
          <StatCard etiqueta={t("kpi.atRisk")} valor={d.enRiesgo} icono={AlertTriangle} />
        </Link>
        <Link href="/patrocinadores/becas" className={ENLACE}>
          <StatCard etiqueta={t("kpi.noSponsor")} valor={d.sinPatrocinador} icono={UserX} />
        </Link>
        <Link href="/administrativo/solicitudes" className={ENLACE}>
          <StatCard etiqueta={t("kpi.pendingDirection")} valor={d.solicitudesDireccion} icono={Gavel} />
        </Link>
        <Link href="/patrocinadores" className={ENLACE}>
          <StatCard etiqueta={t("kpi.activeSponsors")} valor={d.patrocinadoresActivos} icono={HeartHandshake} />
        </Link>
      </section>

      {/* Los montos van en tarjetas de ancho completo en el móvil: a media columna «RD$1,234,567.89» se partiría. */}
      <section aria-label={t("sections.money")} className="grid grid-cols-1 gap-3 sm:grid-cols-3 md:gap-4">
        <Link href="/contabilidad/bancos" className={ENLACE}>
          <StatCard etiqueta={t("kpi.bankDop")} valor={formatearMonto(saldo("DOP")?.saldo ?? 0, "DOP")} icono={Landmark} />
        </Link>
        <Link href="/contabilidad/bancos" className={ENLACE}>
          <StatCard etiqueta={t("kpi.bankUsd")} valor={formatearMonto(saldo("USD")?.saldo ?? 0, "USD")} icono={Landmark} />
        </Link>
        <Link href="/patrocinadores" className={ENLACE}>
          <StatCard etiqueta={t("kpi.monthlyPledge")} valor={montoUsd(d.aporteMensualUsd)} icono={HandCoins} />
        </Link>
      </section>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>
              <GraduationCap className="size-4" />
              {t("charts.byUniversity")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <GraficoAnillo
              datos={universidades}
              etiqueta={t("charts.byUniversity")}
              vacio={t("charts.empty")}
              centro={{ valor: d.becadosActivos, etiqueta: t("charts.scholars") }}
            />
            <LeyendaGrafico enLista items={universidades.map((u) => ({ nombre: u.nombre, valor: u.valor }))} className="mt-3" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>
              <GraduationCap className="size-4" />
              {t("charts.byCareer")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <GraficoBarras
              datos={carreras}
              claveX="nombre"
              nombreEjeX={t("charts.career")}
              series={[{ clave: "valor", nombre: t("charts.scholars") }]}
              etiqueta={t("charts.byCareer")}
              vacio={t("charts.empty")}
              orientacion="filas"
              radioEje={150}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>
              <CalendarClock className="size-4" />
              {cumplimiento.mes ? t("charts.compliance", { mes: cumplimiento.mes }) : t("charts.complianceNone")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <GraficoBarras
              datos={[
                { nombre: t("charts.service"), valor: cumplimiento.servicio },
                { nombre: t("charts.meeting"), valor: cumplimiento.reunion },
                { nombre: t("charts.registered"), valor: cumplimiento.total },
              ]}
              claveX="nombre"
              nombreEjeX={t("charts.item")}
              series={[{ clave: "valor", nombre: t("charts.scholars") }]}
              etiqueta={t("charts.complianceNone")}
              vacio={t("charts.empty")}
              orientacion="filas"
              radioEje={110}
            />
            <Link href="/servicios-mensuales" className="mt-3 inline-block text-sm font-medium text-marca-600 hover:underline">
              {t("charts.viewMonthly")}
            </Link>
          </CardContent>
        </Card>
      </div>

      <PanelDonantes cuotas={d.cuotas} />
    </div>
  );
}
