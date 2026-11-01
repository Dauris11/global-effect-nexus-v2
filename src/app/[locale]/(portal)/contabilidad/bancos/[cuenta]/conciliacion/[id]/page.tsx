import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AlertCircle, ArrowLeft, CheckCircle2, CircleDashed, Link2 } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { AccionesConciliacion, DecisionLinea } from "@/components/contabilidad/bancos/acciones-conciliacion";
import { Monto } from "@/components/contabilidad/comun";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { Link } from "@/i18n/navigation";
import { requerirPermiso } from "@/lib/auth";
import { restarMontos, sumarMontos } from "@/lib/contabilidad/formato";
import { fechaCorta } from "@/lib/fechas";
import { TARJETA } from "@/lib/paleta";
import { usuarioTienePermiso } from "@/lib/rbac";
import { conciliacionPorId } from "@/server/contabilidad/bancos/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contab.conciliacion" });
  return { title: t("titulo") };
}

/**
 * Una conciliación: las líneas del banco con su pareja en libros y el
 * reporte (§4.2): saldo del banco ± partidas en tránsito contra saldo de
 * libros ± partidas del banco sin registrar. Si los dos ajustados son
 * iguales, cuadra.
 */
export default async function PaginaConciliacion({
  params,
}: {
  params: Promise<{ locale: string; cuenta: string; id: string }>;
}) {
  const { locale, id } = await params;
  const idioma = locale === "en" ? "en" : "es";
  const usuario = await requerirPermiso("contabilidad.leer");

  const c = await conciliacionPorId(id);
  if (!c) notFound();

  const [t, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "contab.conciliacion" }),
    mensajesCliente(["contab"]),
  ]);
  const abierta = c.estado === "abierta";
  const puede = usuarioTienePermiso(usuario, "contabilidad.conciliar") && abierta;

  const entradasTransito = sumarMontos(c.transito.filter((p) => !p.importe.startsWith("-")).map((p) => p.importe));
  const salidasTransito = sumarMontos(c.transito.filter((p) => p.importe.startsWith("-")).map((p) => p.importe));
  const sinPareja = c.lineas.filter((l) => !l.movimiento_id);
  const partidasBanco = sumarMontos(sinPareja.map((l) => l.monto));
  const bancoAjustado = sumarMontos([c.saldo_banco, entradasTransito, salidasTransito]);
  const librosAjustado = sumarMontos([c.saldo_libros, partidasBanco]);
  const diferencia = restarMontos(bancoAjustado, librosAjustado);
  const cuadra = /^-?0\.00$/.test(diferencia);

  const filas: [string, string, boolean?][] = [
    [t("saldoBanco"), c.saldo_banco],
    [t("depositosTransito"), entradasTransito],
    [t("chequesTransito"), salidasTransito],
    [t("saldoBancoAjustado"), bancoAjustado, true],
    [t("saldoLibros"), c.saldo_libros],
    [t("partidasBanco"), partidasBanco],
    [t("saldoLibrosAjustado"), librosAjustado, true],
    [t("diferencia"), diferencia, true],
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-entrada">
      <Link href={`/contabilidad/bancos/${c.cuenta_id}/conciliacion`} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-marca-600 hover:underline">
        <ArrowLeft className="size-4" />
        {c.cuenta}
      </Link>

      <EncabezadoPagina
        antetitulo={c.cuenta}
        titulo={t("titulo")}
        subtitulo={t("rango", { desde: fechaCorta(c.desde, idioma), hasta: fechaCorta(c.hasta, idioma) })}
        acciones={<Badge variant={abierta ? "marca" : "neutra"}>{t(c.estado)}</Badge>}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section className="space-y-3">
          <h2 className="texto-titulo-seccion">{t("estadoCuenta")}</h2>
          <ul className={TARJETA.contenido}>
            {c.lineas.map((l) => (
              <li key={l.id} className="flex flex-col gap-3 border-b border-linea p-4 last:border-b-0 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-[15px] text-tinta">{l.descripcion}</p>
                    <Monto valor={l.monto} moneda={c.moneda} conSigno className="font-medium" />
                  </div>
                  <p className="texto-meta">
                    {fechaCorta(l.fecha, idioma)}
                    {l.referencia && ` · ${l.referencia}`}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm">
                    {l.movimiento_id ? (
                      <>
                        {l.confirmada ? <CheckCircle2 className="size-4 text-marca-600" /> : <Link2 className="size-4 text-tinta-3" />}
                        <span className={l.confirmada ? "text-marca-700" : "text-tinta-2"}>
                          {l.confirmada ? t("confirmada") : t("propuesta")}:{" "}
                          {t("movimiento", { numero: (l.movimiento_numero ?? "").padStart(6, "0"), fecha: fechaCorta(l.movimiento_fecha, idioma) })}
                          {" · "}
                          {l.movimiento_concepto}
                        </span>
                      </>
                    ) : (
                      <>
                        <CircleDashed className="size-4 text-tinta-3" />
                        <span className="text-tinta-3">{t("sinPareja")}</span>
                      </>
                    )}
                  </p>
                </div>
                {puede && l.movimiento_id && (
                  <NextIntlClientProvider messages={mensajes}>
                    <DecisionLinea lineaId={l.id} confirmada={l.confirmada} />
                  </NextIntlClientProvider>
                )}
              </li>
            ))}
          </ul>
        </section>

        <aside className="space-y-6">
          <Card className="p-5">
            <h2 className="texto-titulo-tarjeta">{t("reporte")}</h2>
            <dl className="mt-3 space-y-2 text-sm">
              {filas.map(([etiqueta, valor, fuerte]) => (
                <div key={etiqueta} className={`flex justify-between gap-3 ${fuerte ? "border-t border-linea pt-2 font-semibold text-tinta" : "text-tinta-2"}`}>
                  <dt>{etiqueta}</dt>
                  <dd><Monto valor={valor} moneda={c.moneda} /></dd>
                </div>
              ))}
            </dl>
            <p className={`mt-4 flex items-start gap-2 rounded-control px-3 py-2 text-sm ${cuadra ? "bg-marca-50 text-marca-700" : "bg-tinta text-background"}`}>
              {cuadra ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <AlertCircle className="mt-0.5 size-4 shrink-0" />}
              {cuadra ? t("cuadra") : t("noCuadra")}
            </p>
            {c.cerrada_por && c.cerrada_en && (
              <p className="texto-meta mt-3">{t("cerradaPor", { nombre: c.cerrada_por, fecha: fechaCorta(c.cerrada_en.slice(0, 10), idioma) })}</p>
            )}
          </Card>

          <section className="space-y-2">
            <h2 className="texto-titulo-tarjeta">{t("transito")}</h2>
            {c.transito.length === 0 ? (
              <p className="texto-meta">{t("transitoVacio")}</p>
            ) : (
              <ul className="text-sm">
                {c.transito.map((p) => (
                  <li key={p.id} className="flex justify-between gap-3 border-b border-linea py-2 last:border-b-0">
                    <span className="min-w-0 truncate text-tinta-2">
                      {fechaCorta(p.fecha, idioma)} · {p.concepto}
                    </span>
                    <Monto valor={p.importe} moneda={c.moneda} conSigno />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {puede && (
            <NextIntlClientProvider messages={mensajes}>
              <AccionesConciliacion id={c.id} />
            </NextIntlClientProvider>
          )}
        </aside>
      </div>
    </div>
  );
}
