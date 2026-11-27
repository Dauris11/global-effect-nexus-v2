import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Building2,
  Download,
  FileText,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Dato, Monto } from "@/components/contabilidad/comun";
import { AccionesFactura } from "@/components/contabilidad/proveedores/acciones-factura";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { Link } from "@/i18n/navigation";
import { requerirPermiso } from "@/lib/auth";
import { consultar } from "@/lib/db";
import { INSIGNIA_SEMAFORO } from "@/lib/paleta";
import { usuarioTienePermiso } from "@/lib/rbac";
import { nombrePrograma } from "@/lib/contabilidad/programas";
import { retencionPorCodigo } from "@/lib/contabilidad/retenciones-dgii";
import { facturaPorId } from "@/server/contabilidad/proveedores/consultas";


export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const f = await facturaPorId(id);
  return {
    title: f ? `Factura FP-${String(f.numero).padStart(6, "0")}` : "Factura",
  };
}

export default async function PaginaDetalleFactura({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const usuario = await requerirPermiso("contabilidad.leer");

  const [t, tc, factura, adjuntos] = await Promise.all([
    getTranslations({ locale, namespace: "contab.factura" }),
    getTranslations({ locale, namespace: "contab" }),
    facturaPorId(id),
    consultar<{ id: string; ruta: string; nombre: string; tamano: number }>(
      `SELECT id, ruta, nombre, tamano FROM contabilidad.factura_adjunto WHERE factura_id = $1 ORDER BY creado_en DESC`,
      [id],
    ),
  ]);

  if (!factura) notFound();

  const puedeAprobar = usuarioTienePermiso(usuario, "contabilidad.aprobar");
  const puedeRegistrar = usuarioTienePermiso(usuario, "contabilidad.registrar");

  const numFormateado = `FP-${String(factura.numero).padStart(6, "0")}`;

  return (
    <div className="space-y-6 animate-entrada">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-3 mb-2 text-tinta-2">
          <Link href={`/contabilidad/proveedores/${factura.proveedor_id}`}>
            <ChevronLeft className="size-4" />
            {t("volverProveedor")}
          </Link>
        </Button>

        <EncabezadoPagina
          titulo={numFormateado}
          acciones={
            <div className="flex items-center gap-2">
              <Badge
                className={
                  factura.estado === "aprobada"
                    ? INSIGNIA_SEMAFORO.dentro
                    : factura.estado === "anulada"
                    ? INSIGNIA_SEMAFORO.alerta
                    : undefined
                }
                variant={factura.estado === "borrador" ? "neutra" : undefined}
              >
                {tc(`estadoFactura.${factura.estado}` as never)}
              </Badge>
              {factura.cxp_id && (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/contabilidad/cuentas-por-pagar/${factura.cxp_id}`}>
                    {t("verCxp")}
                    <ChevronRight className="size-4" />
                  </Link>
                </Button>
              )}
            </div>
          }
        />
      </div>

      {factura.motivo_anulacion && (
        <div className="rounded-control bg-tinta text-background p-4 text-sm">
          <p className="font-semibold">{t("anular")}:</p>
          <p className="mt-1 opacity-90">{factura.motivo_anulacion}</p>
        </div>
      )}

      {/* Datos principales */}
      <section className="rounded-tarjeta border border-linea bg-background p-6 space-y-6">
        <h2 className="texto-titulo-seccion">{t("datos")}</h2>

        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <Dato etiqueta={tc("facturaForm.proveedor")}>
            <Link
              href={`/contabilidad/proveedores/${factura.proveedor_id}`}
              className="inline-flex items-center gap-1.5 font-medium text-marca-700 hover:underline"
            >
              <Building2 className="size-4 shrink-0 text-tinta-2" />
              {factura.proveedor}
            </Link>
          </Dato>
          <Dato etiqueta={tc("facturaForm.ncf")}>
            <span className="font-mono font-medium">{factura.ncf ?? t("sinComprobante")}</span>
          </Dato>
          <Dato etiqueta={tc("facturaForm.concepto")}>
            <span className="font-medium">{factura.concepto}</span>
          </Dato>
          <Dato etiqueta={tc("facturaForm.emision")}>
            <span className="font-mono font-medium tabular-nums">{factura.fecha_emision}</span>
          </Dato>
          <Dato etiqueta={tc("facturaForm.vencimiento")}>
            <span className="font-mono font-medium tabular-nums">{factura.fecha_vencimiento}</span>
          </Dato>
          <Dato etiqueta={tc("facturaForm.moneda")}>
            <span className="font-medium">
              {factura.moneda} {factura.tasa ? `(${t("tasaValor", { tasa: factura.tasa })})` : ""}
            </span>
          </Dato>
          <Dato etiqueta={tc("facturaForm.tipoGasto")}>
            <span className="font-medium">{factura.tipo_gasto}</span>
          </Dato>
          {factura.solicitante_nombre && (
            <Dato etiqueta={tc("facturaForm.solicitante")}>
              <span className="font-medium text-tinta">{factura.solicitante_nombre}</span>
            </Dato>
          )}
          {factura.programa_codigo && (
            <Dato etiqueta={tc("facturaForm.programa")}>
              <span className="font-medium text-marca-700">{nombrePrograma(factura.programa_codigo)}</span>
            </Dato>
          )}
          {factura.proyecto && (
            <Dato etiqueta={tc("facturaForm.proyecto")}>
              <span className="font-medium">{factura.proyecto}</span>
            </Dato>
          )}
          {factura.asiento_numero && (
            <Dato etiqueta={t("asientoContable")}>
              <span className="font-mono font-medium text-tinta">
                AS-{String(factura.asiento_numero).padStart(6, "0")}
              </span>
            </Dato>
          )}
        </dl>

        {/* Desglose de montos */}
        <div className="border-t border-linea pt-5">
          <h3 className="text-xs uppercase font-semibold text-tinta-2 mb-3">{tc("facturaForm.pasos.montos")}</h3>
          <div className="grid grid-cols-1 gap-4 rounded-control border border-linea bg-superficie/60 p-4 text-sm sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1">
              <span className="texto-meta block">{tc("facturaForm.monto")}</span>
              <Monto valor={factura.subtotal} moneda={factura.moneda} className="block text-base font-semibold leading-tight text-tinta" />
            </div>
            <div className="space-y-1">
              <span className="texto-meta block">{tc("facturaForm.itbis")}</span>
              <Monto valor={factura.itbis} moneda={factura.moneda} className="block text-base font-semibold leading-tight text-tinta" />
            </div>
            <div className="space-y-1">
              <span className="texto-meta block">{tc("facturaForm.retencionIsr")}</span>
              <span className="block text-base font-semibold leading-tight text-tinta">
                −<Monto valor={factura.retencion_isr} moneda={factura.moneda} />
              </span>
              {retencionPorCodigo(factura.tipo_retencion_isr) && (
                <span className="texto-meta block text-xs">
                  {retencionPorCodigo(factura.tipo_retencion_isr)!.etiquetaTasa} ·{" "}
                  {locale === "en"
                    ? retencionPorCodigo(factura.tipo_retencion_isr)!.nombre.en
                    : retencionPorCodigo(factura.tipo_retencion_isr)!.nombre.es}
                </span>
              )}
            </div>
            <div className="space-y-1">
              <span className="texto-meta block">{tc("facturaForm.retencionItbis")}</span>
              <span className="block text-base font-semibold leading-tight text-tinta">
                −<Monto valor={factura.retencion_itbis} moneda={factura.moneda} />
              </span>
              {retencionPorCodigo(factura.tipo_retencion_itbis) && (
                <span className="texto-meta block text-xs">
                  {retencionPorCodigo(factura.tipo_retencion_itbis)!.etiquetaTasa} ·{" "}
                  {locale === "en"
                    ? retencionPorCodigo(factura.tipo_retencion_itbis)!.nombre.en
                    : retencionPorCodigo(factura.tipo_retencion_itbis)!.nombre.es}
                </span>
              )}
            </div>
            <div className="space-y-1">
              <span className="texto-meta block">{tc("facturaForm.neto")}</span>
              <Monto valor={factura.neto} moneda={factura.moneda} className="block text-base font-bold leading-tight text-marca-700" />
            </div>
          </div>
        </div>

        <div className="border-t border-linea pt-3 text-xs text-tinta-2 flex flex-wrap gap-4">
          <span>{t("registradaPor", { nombre: factura.creado_por })}</span>
          {factura.aprobado_por && (
            <span>{t("aprobadaPor", { nombre: factura.aprobado_por })}</span>
          )}
        </div>
      </section>

      {/* Adjuntos */}
      {adjuntos.length > 0 && (
        <section className="rounded-tarjeta border border-linea bg-background p-6 space-y-3">
          <h2 className="texto-titulo-seccion flex items-center gap-2">
            <FileText className="size-5 text-tinta-2" />
            {t("adjuntos")}
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {adjuntos.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-control border border-linea p-3 text-sm"
              >
                <div className="truncate min-w-0 pr-2">
                  <p className="truncate font-medium text-tinta">{a.nombre}</p>
                  <p className="text-xs text-tinta-2">{(a.tamano / 1024).toFixed(1)} KB</p>
                </div>
                <Button asChild size="sm" variant="ghost">
                  <a href={`/contabilidad/adjuntos/${a.id}`} target="_blank" rel="noopener noreferrer">
                    <Download className="size-4" />
                  </a>
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Acciones: aprobar, anular, adjuntar */}
      <AccionesFactura
        factura={factura}
        usuarioId={usuario.id}
        puedeAprobar={puedeAprobar}
        puedeRegistrar={puedeRegistrar}
      />
    </div>
  );
}
