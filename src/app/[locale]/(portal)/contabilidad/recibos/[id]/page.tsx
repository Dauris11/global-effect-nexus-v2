import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Paperclip, Pencil, Printer } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { Dato, InsigniaEstadoRecibo, Monto } from "@/components/contabilidad/comun";
import {
  BotonContabilizar,
  DialogoAnular,
  FormularioAdjunto,
} from "@/components/contabilidad/recibos/acciones-recibo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { getPathname, Link } from "@/i18n/navigation";
import { requerirPermiso } from "@/lib/auth";
import { numeroDocumento } from "@/lib/contabilidad/formato";
import { fechaConHora, fechaLarga } from "@/lib/fechas";
import { TARJETA } from "@/lib/paleta";
import { usuarioTienePermiso } from "@/lib/rbac";
import { adjuntosDeRecibo, reciboPorId } from "@/server/contabilidad/recibos/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const recibo = await reciboPorId(id);
  return { title: recibo ? numeroDocumento(recibo.serie, recibo.numero) : undefined };
}

/**
 * Ficha de un recibo: sus datos, quién hizo qué y cuándo, sus adjuntos y
 * las acciones que su estado admite. Las acciones solo se pintan si la
 * persona tiene el permiso, pero eso es comodidad: cada server action lo
 * vuelve a comprobar.
 *
 * También es el destino del QR del recibo impreso: quien lo escanea con
 * sesión ve aquí si el papel coincide con lo registrado.
 */
export default async function PaginaRecibo({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const idioma = locale === "en" ? "en" : "es";
  const usuario = await requerirPermiso("contabilidad.leer");

  const recibo = await reciboPorId(id);
  if (!recibo) notFound();

  const [t, tc, adjuntos, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "contab.detalle" }),
    getTranslations({ locale, namespace: "contab" }),
    adjuntosDeRecibo(id),
    mensajesCliente(["contab"]),
  ]);

  const numero = numeroDocumento(recibo.serie, recibo.numero);
  // "YYYY-MM-DD HH:MI" en hora de La Vega, tal como lo da la consulta.
  const cuando = (valor: string) => fechaConHora(valor.slice(0, 10), valor.slice(11, 16), idioma);
  const registra = usuarioTienePermiso(usuario, "contabilidad.registrar");
  const aprueba = usuarioTienePermiso(usuario, "contabilidad.aprobar");
  const tercero = recibo.tipo === "ingreso" ? recibo.tercero : recibo.beneficiario;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/contabilidad/recibos"
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-marca-600 hover:underline"
      >
        <ArrowLeft className="size-4" />
        {t("volver")}
      </Link>

      <EncabezadoPagina
        antetitulo={tc(`tipo.${recibo.tipo}`)}
        titulo={numero}
        subtitulo={recibo.concepto}
        acciones={
          <>
            <InsigniaEstadoRecibo estado={recibo.estado} etiqueta={tc(`estado.${recibo.estado}`)} />
            <Button asChild variant="secondary">
              {/* Fuera del armazón del portal, para que imprima solo el recibo. */}
              <a href={getPathname({ href: `/comprobante/recibo/${recibo.id}`, locale })} target="_blank" rel="noopener">
                <Printer className="size-4" />
                {t("imprimir")}
              </a>
            </Button>
          </>
        }
      />

      <Card className="p-5 md:p-6">
        <p className="text-3xl font-semibold text-tinta">
          <Monto valor={recibo.monto} moneda={recibo.moneda} />
        </p>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Dato etiqueta={tc("recibos.col.fecha")}>{fechaLarga(recibo.fecha, idioma)}</Dato>
          <Dato etiqueta={tc("recibos.cuenta")}>{recibo.cuenta}</Dato>
          <Dato etiqueta={tc("formulario.formaPago")}>
            {tc(`formaPago.${recibo.forma_pago}`)}
            {recibo.cheque_numero && ` · ${t("cheque")} ${recibo.cheque_numero}`}
          </Dato>
          <Dato etiqueta={tc("formulario.categoria")}>{recibo.categoria}</Dato>
          <Dato etiqueta={tc("formulario.fondo")}>{recibo.fondo}</Dato>
          {recibo.proyecto && <Dato etiqueta={tc("formulario.proyecto")}>{recibo.proyecto}</Dato>}
          {tercero && (
            <Dato etiqueta={recibo.tipo === "ingreso" ? tc("formulario.patrocinador") : tc("formulario.beneficiario")}>
              {tercero}
            </Dato>
          )}
          {recibo.referencia && <Dato etiqueta={tc("formulario.referencia")}>{recibo.referencia}</Dato>}
          {recibo.tasa && <Dato etiqueta={t("tasa")}>{recibo.tasa}</Dato>}
          {recibo.monto_dop && recibo.moneda === "USD" && (
            <Dato etiqueta={t("montoDop")}>
              <Monto valor={recibo.monto_dop} moneda="DOP" />
            </Dato>
          )}
          {recibo.asiento_numero && (
            <Dato etiqueta={t("asiento")}>{numeroDocumento("AS", recibo.asiento_numero)}</Dato>
          )}
        </dl>
        {recibo.notas && <p className="mt-5 whitespace-pre-line text-[15px] text-tinta-2">{recibo.notas}</p>}
        {recibo.migrado && <p className="texto-meta mt-3">{t("migrado")}</p>}
      </Card>

      <ol className="space-y-1 text-sm text-tinta-2">
        <li>{t("registradoPor", { nombre: recibo.creado_por, fecha: cuando(recibo.creado_en) })}</li>
        {recibo.aprobado_por && recibo.contabilizado_en && (
          <li>{t("contabilizadoPor", { nombre: recibo.aprobado_por, fecha: cuando(recibo.contabilizado_en) })}</li>
        )}
        {recibo.anulado_por && recibo.anulado_en && (
          <li>
            {t("anuladoPor", { nombre: recibo.anulado_por, fecha: cuando(recibo.anulado_en) })}
            {" "}
            {t("motivo", { motivo: recibo.motivo_anulacion ?? "" })}
          </li>
        )}
      </ol>

      <NextIntlClientProvider messages={mensajes}>
        {recibo.estado !== "anulado" && (aprueba || (registra && recibo.estado === "borrador")) && (
          <section className="flex flex-wrap items-start gap-3 border-t border-linea pt-6">
            {recibo.estado === "borrador" && registra && (
              <Button asChild variant="secondary">
                <Link href={`/contabilidad/recibos/${recibo.id}/editar`}>
                  <Pencil className="size-4" />
                  {t("editar")}
                </Link>
              </Button>
            )}
            {recibo.estado === "borrador" && aprueba && <BotonContabilizar id={recibo.id} />}
            {aprueba && <DialogoAnular id={recibo.id} numero={numero} />}
          </section>
        )}

        <section className="space-y-4 border-t border-linea pt-6">
          <h2 className="texto-titulo-seccion flex items-center gap-2">
            <Paperclip className="size-5" />
            {t("adjuntos")}
          </h2>
          {adjuntos.length === 0 ? (
            <p className="texto-meta">{t("adjuntosVacio")}</p>
          ) : (
            <ul className={TARJETA.contenido}>
              {adjuntos.map((adjunto) => (
                <li key={adjunto.id} className="border-b border-linea px-4 last:border-b-0">
                  <a
                    href={getPathname({ href: `/contabilidad/adjuntos/${adjunto.id}`, locale })}
                    className="flex min-h-11 items-center gap-3 py-2 text-[15px] text-marca-600 hover:underline"
                    aria-label={t("descargar", { nombre: adjunto.nombre })}
                  >
                    <FileText className="size-5 shrink-0" />
                    <span className="truncate">{adjunto.nombre}</span>
                    <span className="texto-meta ml-auto shrink-0">{adjunto.subido_por}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
          {registra && recibo.estado !== "anulado" && <FormularioAdjunto id={recibo.id} />}
        </section>
      </NextIntlClientProvider>
    </div>
  );
}
