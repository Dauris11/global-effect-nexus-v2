import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar, DollarSign, FileText, ReceiptText } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Dato, Monto } from "@/components/contabilidad/comun";
import { AccionesCxp } from "@/components/contabilidad/cxp/acciones-cxp";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { Link } from "@/i18n/navigation";
import { requerirPermiso } from "@/lib/auth";
import { INSIGNIA_SEMAFORO } from "@/lib/paleta";
import { usuarioTienePermiso } from "@/lib/rbac";
import { cxpPorId, hoyEnLaBase, pagosDeCxp } from "@/server/contabilidad/cxp/consultas";
import { opcionesRecibo } from "@/server/contabilidad/recibos/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const c = await cxpPorId(id);
  return {
    title: c ? `CxP · ${c.tercero}` : "Cuenta por pagar",
  };
}

export default async function PaginaDetalleCxp({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const usuario = await requerirPermiso("contabilidad.leer");

  const [t, tc, cxp, pagos, opciones, hoy] = await Promise.all([
    getTranslations({ locale, namespace: "contab.cxp" }),
    getTranslations({ locale, namespace: "contab" }),
    cxpPorId(id),
    pagosDeCxp(id),
    opcionesRecibo(),
    hoyEnLaBase(),
  ]);

  if (!cxp) notFound();

  const puedeRegistrar = usuarioTienePermiso(usuario, "contabilidad.registrar");
  const puedeAprobar = usuarioTienePermiso(usuario, "contabilidad.aprobar");

  const vencida = cxp.dias_vencida > 0 && cxp.estado !== "pagada" && cxp.estado !== "anulada";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-3 mb-2 text-tinta-2">
          <Link href="/contabilidad/cuentas-por-pagar">
            <ArrowLeft className="size-4" />
            {t("volver")}
          </Link>
        </Button>

        <EncabezadoPagina
          antetitulo={t("titulo")}
          titulo={cxp.tercero}
          subtitulo={`${cxp.concepto} · ${
            cxp.origen === "factura"
              ? t("origenFactura")
              : t("origenSolicitud", { folio: cxp.solicitud_folio ?? "" })
          }`}
          acciones={
            <div className="flex items-center gap-2">
              <Badge
                className={
                  cxp.estado === "pagada"
                    ? INSIGNIA_SEMAFORO.dentro
                    : cxp.estado === "anulada"
                    ? INSIGNIA_SEMAFORO.alerta
                    : vencida
                    ? "bg-alerta-fondo text-alerta border border-alerta-linea"
                    : undefined
                }
                variant={cxp.estado === "pendiente" ? "neutra" : undefined}
              >
                {tc(`estadoCxp.${cxp.estado}` as never)}
              </Badge>
              {vencida && (
                <span className="text-xs text-alerta font-medium">
                  {t("vencida", { n: cxp.dias_vencida })}
                </span>
              )}
            </div>
          }
        />
      </div>

      {/* Tarjeta de datos de la deuda */}
      <section className="rounded-tarjeta border border-linea bg-background p-6 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 bg-superficie/60 p-4 rounded-control text-sm">
          <div>
            <span className="texto-meta block">{t("monto")}</span>
            <Monto valor={cxp.monto} moneda={cxp.moneda} className="text-lg font-semibold" />
          </div>
          <div>
            <span className="texto-meta block">{t("pagado")}</span>
            <Monto valor={cxp.pagado} moneda={cxp.moneda} className="text-lg font-semibold text-marca-700" />
          </div>
          <div>
            <span className="texto-meta block">{t("saldo")}</span>
            <Monto
              valor={cxp.saldo}
              moneda={cxp.moneda}
              className={`text-xl font-bold ${Number(cxp.saldo) > 0 ? "text-tinta" : "text-marca-700"}`}
            />
          </div>
          <div>
            <span className="texto-meta block">{t("col.vencimiento")}</span>
            <span className="text-base font-medium font-mono text-tinta block">{cxp.fecha_vencimiento}</span>
          </div>
        </div>

        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Dato etiqueta={t("col.tercero")}>
            {cxp.proveedor_id ? (
              <Link
                href={`/contabilidad/proveedores/${cxp.proveedor_id}`}
                className="font-medium text-marca-700 hover:underline"
              >
                {cxp.tercero}
              </Link>
            ) : (
              cxp.tercero
            )}
          </Dato>
          <Dato etiqueta="Origen">
            {cxp.factura_id ? (
              <Link
                href={`/contabilidad/facturas/${cxp.factura_id}`}
                className="font-medium text-marca-700 hover:underline flex items-center gap-1.5"
              >
                <FileText className="size-4" />
                {t("origenFactura")}
              </Link>
            ) : (
              t("origenSolicitud", { folio: cxp.solicitud_folio ?? "" })
            )}
          </Dato>
          <Dato etiqueta="Emisión">
            <span className="font-mono text-xs">{cxp.fecha_emision}</span>
          </Dato>
          {cxp.fecha_programada && (
            <Dato etiqueta={t("fechaProgramada")}>
              <span className="font-mono text-xs text-marca-700 font-semibold">
                {cxp.fecha_programada}
              </span>
              {cxp.cuenta_salida && ` (${cxp.cuenta_salida})`}
            </Dato>
          )}
          {cxp.proyecto && (
            <Dato etiqueta={t("proyecto")}>
              {cxp.proyecto}
            </Dato>
          )}
        </dl>
      </section>

      {/* Historial de pagos */}
      <section className="rounded-tarjeta border border-linea bg-background p-6 space-y-4">
        <h2 className="texto-titulo-seccion flex items-center gap-2">
          <DollarSign className="size-5 text-tinta-2" />
          {t("pagos")}
        </h2>

        {pagos.length === 0 ? (
          <p className="text-sm text-tinta-2">{t("pagosVacio")}</p>
        ) : (
          <div className="divide-y divide-linea">
            {pagos.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
              >
                <div>
                  <p className="font-semibold text-tinta">
                    {t("pago", {
                      numero: String(p.numero).padStart(6, "0"),
                      fecha: p.fecha,
                      cuenta: p.cuenta,
                    })}
                  </p>
                  <p className="text-xs text-tinta-2 mt-0.5">
                    Registrado por {p.creado_por}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <Monto valor={p.monto} moneda={cxp.moneda} className="font-bold text-marca-700" />
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/contabilidad/recibos/${p.recibo_id}`}>
                      <ReceiptText className="size-4" />
                      {t("comprobante", { numero: p.recibo_numero })}
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Acciones: programar y pagar */}
      <AccionesCxp
        cxp={cxp}
        cuentasBancarias={opciones.cuentas}
        categorias={opciones.categorias}
        fondos={opciones.fondos}
        proyectos={opciones.proyectos}
        hoy={hoy}
        puedeRegistrar={puedeRegistrar}
        puedeAprobar={puedeAprobar}
      />
    </div>
  );
}
