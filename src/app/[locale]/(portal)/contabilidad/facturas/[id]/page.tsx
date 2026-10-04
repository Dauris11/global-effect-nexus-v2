import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Calendar,
  DollarSign,
  Download,
  FileCheck,
  FileText,
  User,
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
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-3 mb-2 text-tinta-2">
          <Link href={`/contabilidad/proveedores/${factura.proveedor_id}`}>
            <ArrowLeft className="size-4" />
            {t("volverProveedor")}
          </Link>
        </Button>

        <EncabezadoPagina
          antetitulo={t("titulo")}
          titulo={numFormateado}
          subtitulo={`${factura.proveedor} ${factura.ncf ? `· ${factura.ncf}` : ""}`}
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
                    <ArrowRight className="size-4" />
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

        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Dato etiqueta="Proveedor">
            <Link
              href={`/contabilidad/proveedores/${factura.proveedor_id}`}
              className="font-medium text-marca-700 hover:underline flex items-center gap-1.5"
            >
              <Building2 className="size-4 shrink-0 text-tinta-2" />
              {factura.proveedor}
            </Link>
          </Dato>
          <Dato etiqueta="NCF / e-CF">
            <span className="font-mono">{factura.ncf ?? "Sin comprobante"}</span>
          </Dato>
          <Dato etiqueta="Concepto">
            {factura.concepto}
          </Dato>
          <Dato etiqueta="Fecha de emisión">
            {factura.fecha_emision}
          </Dato>
          <Dato etiqueta="Fecha de vencimiento">
            {factura.fecha_vencimiento}
          </Dato>
          <Dato etiqueta="Moneda">
            {factura.moneda} {factura.tasa ? `(Tasa: RD$${factura.tasa})` : ""}
          </Dato>
          <Dato etiqueta="Categoría contable">
            {factura.categoria}
          </Dato>
          {factura.proyecto && (
            <Dato etiqueta="Proyecto">
              {factura.proyecto}
            </Dato>
          )}
          {factura.asiento_numero && (
            <Dato etiqueta="Asiento contable">
              <span className="font-mono font-medium text-tinta">
                AS-{String(factura.asiento_numero).padStart(6, "0")}
              </span>
            </Dato>
          )}
        </dl>

        {/* Desglose de montos */}
        <div className="border-t border-linea pt-5">
          <h3 className="text-xs uppercase font-semibold text-tinta-2 mb-3">Desglose de montos</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 bg-superficie/60 p-4 rounded-control text-sm">
            <div>
              <span className="texto-meta block">Subtotal</span>
              <Monto valor={factura.subtotal} moneda={factura.moneda} className="text-base font-medium" />
            </div>
            <div>
              <span className="texto-meta block">ITBIS</span>
              <Monto valor={factura.itbis} moneda={factura.moneda} className="text-base font-medium" />
            </div>
            <div>
              <span className="texto-meta block">Retenciones (ISR + ITBIS)</span>
              <span className="text-base font-medium text-tinta">
                −{Number(factura.retencion_isr) + Number(factura.retencion_itbis) > 0 ? (
                  factura.moneda === "USD"
                    ? `$${(Number(factura.retencion_isr) + Number(factura.retencion_itbis)).toFixed(2)}`
                    : `RD$${(Number(factura.retencion_isr) + Number(factura.retencion_itbis)).toFixed(2)}`
                ) : "0.00"}
              </span>
            </div>
            <div>
              <span className="texto-meta block">Monto Neto a Pagar</span>
              <Monto valor={factura.neto} moneda={factura.moneda} className="text-lg font-bold text-marca-700" />
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
