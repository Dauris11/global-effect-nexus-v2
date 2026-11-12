import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Edit,
  History,
  MapPin,
  Package,
  QrCode,
  ShieldCheck,
  Tag,
  User,
  Wrench,
  XCircle,
} from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { EtiquetaQrImprimible } from "@/components/inventario/etiqueta-qr-imprimible";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { Link } from "@/i18n/navigation";
import { requerirPermiso } from "@/lib/auth";
import type { EstadoActivo } from "@/lib/inventario";
import { usuarioTienePermiso } from "@/lib/rbac";
import {
  obtenerActivoPorId,
  obtenerHistorialActivo,
} from "@/server/inventario/consultas";

interface PaginaDetalleActivoProps {
  params: Promise<{ locale: string; id: string }>;
}

export default async function PaginaDetalleActivo({ params }: PaginaDetalleActivoProps) {
  const usuario = await requerirPermiso("inventario.leer");
  const { locale, id } = await params;

  const [t, tForm, activo, historial, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "admin.inventario" }),
    getTranslations({ locale, namespace: "admin.activoFormulario" }),
    obtenerActivoPorId(id),
    obtenerHistorialActivo(id),
    mensajesCliente(["admin"]),
  ]);

  if (!activo) {
    notFound();
  }

  const puedeEscribir = usuarioTienePermiso(usuario, "inventario.escribir");

  const formatoMoneda = (val: number | null) => {
    if (val === null || val === undefined) return "—";
    return new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency: "DOP",
    }).format(val);
  };

  const formatearFecha = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("es-DO", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  const renderEstadoBadge = (estado: EstadoActivo) => {
    switch (estado) {
      case "operativo":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-transparent bg-[#1E9E6A]/10 px-3 py-1 text-xs font-bold text-[#1E9E6A]">
            <CheckCircle2 className="size-4" />
            <span>{t("estados.operativo")}</span>
          </span>
        );
      case "mantenimiento":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-marca-50 px-3 py-1 text-xs font-bold text-marca-700">
            <Clock className="size-4" />
            <span>{t("estados.mantenimiento")}</span>
          </span>
        );
      case "prestado":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-bold text-tinta-2">
            <Package className="size-4" />
            <span>{t("estados.prestado")}</span>
          </span>
        );
      case "baja":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-transparent bg-[#B4342B]/10 px-3 py-1 text-xs font-bold text-[#B4342B]">
            <XCircle className="size-4" />
            <span>{t("estados.baja")}</span>
          </span>
        );
    }
  };

  return (
    <div className="animate-entrada flex flex-col gap-6">
      {/* Navegación y Encabezado */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <Link
            href="/administrativo/inventario"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-tinta-2 transition-colors hover:text-tinta"
          >
            <ArrowLeft className="size-4" />
            <span>{t("volverCatalogo")}</span>
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-2xl font-extrabold text-tinta sm:text-3xl">
              {activo.codigo}
            </h1>
            {renderEstadoBadge(activo.estado)}
          </div>
          <p className="text-sm font-semibold text-tinta-2">{activo.nombre}</p>
        </div>

        {puedeEscribir && (
          <Link
            href={`/administrativo/inventario/${activo.id}/editar`}
            className="inline-flex items-center gap-2 rounded-xl border border-linea bg-background px-4 py-2 text-xs font-bold text-tinta transition-colors hover:bg-muted"
          >
            <Edit className="size-4" />
            <span>{t("editarFichaTitulo")}</span>
          </Link>
        )}
      </div>

      {/* Contenido en dos columnas */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Columna Izquierda: Ficha Técnica e Historial */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* Ficha Técnica del Activo */}
          <div className="rounded-2xl border border-linea bg-card p-5 shadow-xs">
            <div className="flex items-center gap-2 border-b border-linea pb-3">
              <Tag className="size-4 text-marca-600" />
              <h2 className="text-sm font-bold text-tinta">{t("fichaTecnica")}</h2>
            </div>

            {/* Foto si está disponible */}
            {activo.fotoUrl && (
              <div className="mt-4 overflow-hidden rounded-xl border border-linea">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activo.fotoUrl}
                  alt={activo.nombre}
                  className="max-h-72 w-full object-cover"
                />
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-[11px] font-semibold text-tinta-3 uppercase">{t("colCategoria")}</p>
                <p className="text-xs font-bold text-tinta">{t(`categorias.${activo.categoria}`)}</p>
              </div>

              <div>
                <p className="text-[11px] font-semibold text-tinta-3 uppercase">{t("colUbicacion")}</p>
                <div className="flex items-center gap-1.5 text-xs font-bold text-tinta">
                  <MapPin className="size-3.5 text-marca-600" />
                  <span>{activo.ubicacion}</span>
                </div>
              </div>

              <div>
                <p className="text-[11px] font-semibold text-tinta-3 uppercase">{t("colCustodio")}</p>
                <div className="flex items-center gap-1.5 text-xs font-bold text-tinta">
                  <User className="size-3.5 text-marca-600" />
                  <span>{activo.responsableNombre ?? t("sinCustodio")}</span>
                </div>
                {activo.responsableEmail && (
                  <p className="text-[11px] text-tinta-2">{activo.responsableEmail}</p>
                )}
              </div>

              <div>
                <p className="text-[11px] font-semibold text-tinta-3 uppercase">{t("valorLibros")}</p>
                <p className="font-mono text-sm font-bold text-tinta">
                  {formatoMoneda(activo.valorEstimado)}
                </p>
              </div>

              {activo.marcaModelo && (
                <div>
                  <p className="text-[11px] font-semibold text-tinta-3 uppercase">{tForm("marcaLabel")}</p>
                  <p className="text-xs font-medium text-tinta">{activo.marcaModelo}</p>
                </div>
              )}

              {activo.numeroSerie && (
                <div>
                  <p className="text-[11px] font-semibold text-tinta-3 uppercase">{tForm("serieLabel")}</p>
                  <p className="font-mono text-xs font-bold text-tinta">{activo.numeroSerie}</p>
                </div>
              )}
            </div>

            {activo.notas && (
              <div className="mt-4 rounded-xl border border-linea bg-muted/40 p-3 text-xs">
                <p className="font-semibold text-tinta">{t("notasObservaciones")}</p>
                <p className="mt-0.5 text-tinta-2">{activo.notas}</p>
              </div>
            )}
          </div>

          {/* Historial de Trazabilidad y Auditorías QR */}
          <div className="rounded-2xl border border-linea bg-card p-5 shadow-xs">
            <div className="flex items-center gap-2 border-b border-linea pb-3">
              <History className="size-4 text-marca-600" />
              <h2 className="text-sm font-bold text-tinta">{t("bitacoraTitulo")}</h2>
            </div>

            <div className="mt-4 flex flex-col divide-y divide-linea">
              {historial.length === 0 ? (
                <p className="py-6 text-center text-xs text-tinta-3">
                  {t("sinMovimientos")}
                </p>
              ) : (
                historial.map((mov) => (
                  <div key={mov.id} className="flex items-start gap-3 py-3 text-xs">
                    <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-marca-50 text-marca-600">
                      {mov.accion === "auditoria_qr" ? (
                        <ShieldCheck className="size-4" />
                      ) : mov.accion === "mantenimiento" ? (
                        <Wrench className="size-4" />
                      ) : (
                        <MapPin className="size-4" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <span className="font-bold text-tinta capitalize">
                          {mov.accion.replace("_", " ")}
                        </span>
                        <span className="text-[11px] text-tinta-3">{formatearFecha(mov.createdAt)}</span>
                      </div>
                      <p className="text-tinta-2">{mov.notas}</p>
                      {mov.ubicacionNueva && mov.ubicacionAnterior && mov.ubicacionNueva !== mov.ubicacionAnterior && (
                        <p className="mt-0.5 text-[11px] text-tinta-3">
                          {t("traslado")} <span className="line-through">{mov.ubicacionAnterior}</span> →{" "}
                          <span className="font-semibold text-tinta">{mov.ubicacionNueva}</span>
                        </p>
                      )}
                      {mov.usuarioNombre && (
                        <p className="mt-0.5 text-[10px] text-tinta-3">
                          {t("registradoPor", { name: mov.usuarioNombre })}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Columna Derecha: Etiqueta QR Imprimible */}
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-linea bg-card p-5 shadow-xs">
            <div className="mb-4 flex items-center gap-2 border-b border-linea pb-3">
              <QrCode className="size-4 text-marca-600" />
              <h2 className="text-sm font-bold text-tinta">{t("etiquetaTitulo")}</h2>
            </div>

            <NextIntlClientProvider messages={mensajes}>
              <EtiquetaQrImprimible
                codigo={activo.codigo}
                nombre={activo.nombre}
                categoria={t(`categorias.${activo.categoria}`)}
                numeroSerie={activo.numeroSerie}
                ubicacion={activo.ubicacion}
              />
            </NextIntlClientProvider>
          </div>
        </div>
      </div>
    </div>
  );
}
