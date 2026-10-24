import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, Info } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { DialogoRevertir } from "@/components/contabilidad/asientos/acciones";
import { ICONO_TIPO, InsigniaEstadoAsiento } from "@/components/contabilidad/asientos/insignias";
import { LineasAsiento } from "@/components/contabilidad/asientos/lineas-asiento";
import { Dato } from "@/components/contabilidad/comun";
import { Card } from "@/components/ui/card";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { Link } from "@/i18n/navigation";
import { requerirPermiso } from "@/lib/auth";
import { claveDeOrigen, esRevertible, rutaDeOrigen } from "@/lib/contabilidad/asientos";
import { numeroDocumento } from "@/lib/contabilidad/formato";
import { fechaConHora, fechaLarga, mesLargo } from "@/lib/fechas";
import { usuarioTienePermiso } from "@/lib/rbac";
import { asientoPorId, lineasDeAsiento } from "@/server/contabilidad/asientos/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const asiento = await asientoPorId(id);
  return { title: asiento ? numeroDocumento("AS", asiento.numero) : undefined };
}

/**
 * Ficha de un asiento: cabecera, líneas con sus totales, quién lo hizo y,
 * si se revirtió, el enlace en los dos sentidos entre el original y su
 * reverso. Revertir solo se ofrece a los asientos que escribió una persona
 * o una plantilla; un automático se revierte anulando su documento.
 */
export default async function PaginaAsiento({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const idioma = locale === "en" ? "en" : "es";
  const usuario = await requerirPermiso("contabilidad.leer");

  const asiento = await asientoPorId(id);
  if (!asiento) notFound();

  const [t, ta, lineas, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "contab.asientos.detalle" }),
    getTranslations({ locale, namespace: "contab.asientos" }),
    lineasDeAsiento(id),
    mensajesCliente(["contab"]),
  ]);

  const numero = numeroDocumento("AS", asiento.numero);
  const cuando = (valor: string) => fechaConHora(valor.slice(0, 10), valor.slice(11, 16), idioma);
  const claveOrigen = claveDeOrigen(asiento.origen_tabla);
  const rutaOrigen = rutaDeOrigen(asiento.origen_tabla, asiento.origen_id);
  const IconoTipo = ICONO_TIPO[asiento.tipo];
  const puedeRevertir =
    usuarioTienePermiso(usuario, "contabilidad.asiento_manual") &&
    esRevertible(asiento.tipo, asiento.origen_tabla, asiento.estado);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/contabilidad/asientos"
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-marca-600 hover:underline"
      >
        <ArrowLeft className="size-4" />
        {t("volver")}
      </Link>

      <EncabezadoPagina
        antetitulo={ta(`tipo.${asiento.tipo}`)}
        titulo={<span className="tabular-nums">{numero}</span>}
        subtitulo={asiento.concepto}
        acciones={<InsigniaEstadoAsiento estado={asiento.estado} etiqueta={ta(`estado.${asiento.estado}`)} />}
      />

      <Card className="p-5 md:p-6">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Dato etiqueta={t("fecha")}>{fechaLarga(asiento.fecha, idioma)}</Dato>
          <Dato etiqueta={t("periodo")}>
            {mesLargo(asiento.fecha.slice(0, 7), idioma)}
            {asiento.periodo_cerrado && ` · ${t("periodoCerrado")}`}
          </Dato>
          <Dato etiqueta={t("tipo")}>
            <span className="inline-flex items-center gap-1.5">
              <IconoTipo className="size-4 text-tinta-2" />
              {ta(`tipo.${asiento.tipo}`)}
            </span>
          </Dato>
          <Dato etiqueta={t("origen")}>
            {!claveOrigen ? (
              "—"
            ) : rutaOrigen ? (
              <Link href={rutaOrigen} className="text-marca-600 hover:underline">
                {ta(`origen.${claveOrigen}`)}
              </Link>
            ) : (
              ta(`origen.${claveOrigen}`)
            )}
          </Dato>
        </dl>
      </Card>

      <section className="space-y-3">
        <h2 className="texto-titulo-seccion">{t("lineas")}</h2>
        <LineasAsiento lineas={lineas} totalDebe={asiento.total_debe} totalHaber={asiento.total_haber} />
      </section>

      <ol className="space-y-1 text-sm text-tinta-2">
        <li>{t("creadoPor", { nombre: asiento.creado_por, fecha: cuando(asiento.creado_en) })}</li>
        {asiento.anulado_por && asiento.anulado_en && (
          <li>
            {t("anuladoPor", { nombre: asiento.anulado_por, fecha: cuando(asiento.anulado_en) })}{" "}
            {t("motivo", { motivo: asiento.motivo_anulacion ?? "" })}
          </li>
        )}
        {asiento.reverso_id && asiento.reverso_numero && (
          <li>
            {t("revertidoCon")}{" "}
            <Link href={`/contabilidad/asientos/${asiento.reverso_id}`} className="font-medium text-marca-600 hover:underline">
              {numeroDocumento("AS", asiento.reverso_numero)}
            </Link>
            {/* Sin marca en el original: su período estaba cerrado (ver revertirAsiento). */}
            {!asiento.anulado && asiento.periodo_cerrado && ` · ${t("sinMarca")}`}
          </li>
        )}
        {asiento.original_id && asiento.original_numero && (
          <li>
            {t("revierteA")}{" "}
            <Link href={`/contabilidad/asientos/${asiento.original_id}`} className="font-medium text-marca-600 hover:underline">
              {numeroDocumento("AS", asiento.original_numero)}
            </Link>
          </li>
        )}
      </ol>

      {asiento.tipo === "automatico" && asiento.estado === "vigente" && (
        <p className="flex items-start gap-2 rounded-control bg-marca-50 px-3 py-2.5 text-sm text-marca-700">
          <Info className="mt-0.5 size-4 shrink-0" />
          <span>{t("automaticoAyuda")}</span>
        </p>
      )}

      {puedeRevertir && (
        <section className="border-t border-linea pt-6">
          <NextIntlClientProvider messages={mensajes}>
            <DialogoRevertir id={asiento.id} numero={numero} periodoCerrado={asiento.periodo_cerrado} />
          </NextIntlClientProvider>
        </section>
      )}
    </div>
  );
}
