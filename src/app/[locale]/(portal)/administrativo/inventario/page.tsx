import { CheckCircle2, Clock, DollarSign, Package, QrCode } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { TablaActivos } from "@/components/inventario/tabla-activos";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { Link } from "@/i18n/navigation";
import { requerirPermiso } from "@/lib/auth";
import { usuarioTienePermiso } from "@/lib/rbac";
import {
  listarActivos,
  obtenerMetricasInventario,
} from "@/server/inventario/consultas";

export default async function PaginaInventario({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const usuario = await requerirPermiso("inventario.leer");

  const [t, metricas, activos, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "admin.inventario" }),
    obtenerMetricasInventario(),
    listarActivos(),
    mensajesCliente(["admin"]),
  ]);

  const puedeEscribir = usuarioTienePermiso(usuario, "inventario.escribir");
  const puedeAuditar = usuarioTienePermiso(usuario, "inventario.auditar");
  const puedeEliminar = usuarioTienePermiso(usuario, "inventario.eliminar");

  const formatoMoneda = (val: number) => {
    return new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency: "DOP",
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="animate-entrada flex flex-col gap-6">
      {/* Cabecera de Página */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-tinta sm:text-3xl">
            {t("titulo")}
          </h1>
        </div>

        {puedeAuditar && (
          <Link
            href="/administrativo/inventario/escanear"
            className="flex items-center justify-center gap-2 rounded-control bg-marca-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition-colors hover:bg-marca-700 sm:w-auto"
          >
            <QrCode className="size-4" />
            <span>{t("escanerMovil")}</span>
          </Link>
        )}
      </div>

      {/* Tarjetas de Métricas / KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="flex flex-col justify-between rounded-card border border-linea bg-card p-4 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-tinta-2">{t("kpiTotal")}</span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-marca-50 text-marca-600">
              <Package className="size-4" />
            </div>
          </div>
          <p className="mt-2 font-mono text-2xl font-extrabold text-tinta">
            {metricas.totalActivos}
          </p>
        </div>

        <div className="flex flex-col justify-between rounded-card border border-linea bg-card p-4 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-tinta-2">{t("kpiOperativos")}</span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-marca-50 text-marca-600">
              <CheckCircle2 className="size-4" />
            </div>
          </div>
          <p className="mt-2 font-mono text-2xl font-extrabold text-tinta">
            {metricas.operativos}
          </p>
        </div>

        <div className="flex flex-col justify-between rounded-card border border-linea bg-card p-4 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-tinta-2">{t("kpiMantenimiento")}</span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-muted text-tinta-2">
              <Clock className="size-4" />
            </div>
          </div>
          <p className="mt-2 font-mono text-2xl font-extrabold text-tinta">
            {metricas.enMantenimiento}
          </p>
        </div>

        <div className="flex flex-col justify-between rounded-card border border-linea bg-card p-4 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-tinta-2">{t("kpiValor")}</span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-marca-50 text-marca-600">
              <DollarSign className="size-4" />
            </div>
          </div>
          <p className="mt-2 font-mono text-xl font-extrabold text-tinta">
            {formatoMoneda(metricas.valorTotalEstimado)}
          </p>
        </div>
      </div>

      {/* Catálogo y Tabla de Activos */}
      <NextIntlClientProvider messages={mensajes}>
        <TablaActivos
          activos={activos}
          puedeEscribir={puedeEscribir}
          puedeAuditar={puedeAuditar}
          puedeEliminar={puedeEliminar}
        />
      </NextIntlClientProvider>
    </div>
  );
}
