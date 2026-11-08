import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirRol } from "@/lib/auth";
import { programasParaRendicion } from "@/server/colaborador/consultas";
import { listarComprobantesRecibidos } from "@/server/contabilidad/comprobantes/recibidos-consultas";
import { PanelRevisionComprobante } from "@/components/contabilidad/comprobantes/panel-revision-comprobante";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contab.comprobantesRecibidos" });
  return { title: t("titulo") };
}

export default async function ComprobantesRecibidosPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ estado?: string; q?: string }>;
}) {
  await requerirRol(["contabilidad", "super_admin", "admin"]);
  const { locale } = await params;
  const filtros = await searchParams;

  const [t, comprobantes, proyectos, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "contab.comprobantesRecibidos" }),
    listarComprobantesRecibidos({
      estado: filtros.estado,
      busqueda: filtros.q,
      limite: 100,
    }),
    programasParaRendicion(),
    mensajesCliente(["contab"]),
  ]);

  const conteoPorEstado = {
    recibido: comprobantes.filter((c) => c.estado === "recibido").length,
    validado: comprobantes.filter((c) => c.estado === "validado").length,
    observado: comprobantes.filter((c) => c.estado === "observado").length,
    rechazado: comprobantes.filter((c) => c.estado === "rechazado").length,
    contabilizado: comprobantes.filter((c) => c.estado === "contabilizado").length,
  };

  return (
    <div className="space-y-6 animate-entrada">
      <EncabezadoPagina
        antetitulo={t("eyebrow")}
        titulo={t("titulo")}
      />

      {/* Métricas rápidas de la bandeja */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-control border border-linea bg-card p-4 shadow-card">
          <p className="texto-meta text-xs">{t("stats.pending")}</p>
          <p className="text-2xl font-bold text-tinta">{conteoPorEstado.recibido}</p>
        </div>
        <div className="rounded-control border border-linea bg-card p-4 shadow-card">
          <p className="texto-meta text-xs">{t("stats.validated")}</p>
          <p className="text-2xl font-bold text-marca-600">{conteoPorEstado.validado}</p>
        </div>
        <div className="rounded-control border border-linea bg-card p-4 shadow-card">
          <p className="texto-meta text-xs">{t("stats.observed")}</p>
          <p className="text-2xl font-bold text-tinta-2">{conteoPorEstado.observado}</p>
        </div>
        <div className="rounded-control border border-linea bg-card p-4 shadow-card">
          <p className="texto-meta text-xs">{t("stats.posted")}</p>
          <p className="text-2xl font-bold text-marca-700">{conteoPorEstado.contabilizado}</p>
        </div>
      </div>

      {/* Lista interactiva de comprobantes con panel de revisión */}
      <NextIntlClientProvider messages={mensajes}>
        <PanelRevisionComprobante comprobantes={comprobantes} proyectos={proyectos} />
      </NextIntlClientProvider>
    </div>
  );
}
