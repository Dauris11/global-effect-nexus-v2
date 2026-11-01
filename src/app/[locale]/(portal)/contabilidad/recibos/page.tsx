import type { Metadata } from "next";
import { Download, FileSpreadsheet, Plus, ReceiptText } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Monto } from "@/components/contabilidad/comun";
import { FiltrosRecibos } from "@/components/contabilidad/recibos/filtros-recibos";
import { ListaRecibos } from "@/components/contabilidad/recibos/lista-recibos";
import { Button } from "@/components/ui/button";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { getPathname, Link } from "@/i18n/navigation";
import { requerirPermiso } from "@/lib/auth";
import { usuarioTienePermiso } from "@/lib/rbac";
import {
  hayFiltroRecibos,
  leerFiltroRecibos,
  opcionesRecibo,
  recibos,
  TOPE_RECIBOS,
  totalesRecibos,
} from "@/server/contabilidad/recibos/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contab.recibos" });
  return { title: t("titulo") };
}

/**
 * Consulta de recibos (§4.3). Los totales salen de la base sobre el filtro
 * ENTERO, no de las 200 filas pintadas, y separados por tipo y moneda:
 * sumar pesos con dólares no da ninguna cifra que exista.
 *
 * El enlace de exportar lleva el mismo filtro de la URL; la exportación
 * queda en la bitácora (registrarLectura).
 */
export default async function PaginaRecibos({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const idioma = locale === "en" ? "en" : "es";
  const usuario = await requerirPermiso("contabilidad.leer");
  const crudo = await searchParams;
  const filtro = leerFiltroRecibos(crudo);
  const hayFiltro = hayFiltroRecibos(filtro);

  const [t, tc, filas, totales, opciones] = await Promise.all([
    getTranslations({ locale, namespace: "contab.recibos" }),
    getTranslations({ locale, namespace: "contab" }),
    recibos(filtro),
    totalesRecibos(filtro),
    opcionesRecibo(),
  ]);

  const consulta = new URLSearchParams(
    Object.entries(crudo).flatMap(([k, v]) => (typeof v === "string" && v ? [[k, v]] : [])),
  ).toString();

  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-entrada">
      <EncabezadoPagina
        titulo={t("titulo")}
        acciones={
          <>
            {/* El 607 se elige por mes en Impuestos: aquí solo se enlaza. */}
            <Button asChild variant="secondary">
              <Link href="/contabilidad/impuestos">
                <FileSpreadsheet className="size-4" />
                {tc("modulos.irImpuestos")}
              </Link>
            </Button>
            <Button asChild variant="secondary">
              {/* <a> y no <Link>: es una descarga, no una navegación. */}
              <a
                href={`${getPathname({ href: "/contabilidad/recibos/exportar", locale })}${consulta ? `?${consulta}` : ""}`}
              >
                <Download className="size-4" />
                {t("exportar")}
              </a>
            </Button>
            {usuarioTienePermiso(usuario, "contabilidad.registrar") && (
              <Button asChild>
                <Link href="/contabilidad/recibos/nuevo">
                  <Plus className="size-4" />
                  {t("nuevo")}
                </Link>
              </Button>
            )}
          </>
        }
      />

      <FiltrosRecibos filtro={filtro} opciones={opciones} hayFiltro={hayFiltro} />

      {totales.length > 0 && (
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {totales.map((total) => (
            <div key={`${total.tipo}-${total.moneda}`} className="rounded-card border border-linea bg-card p-4 shadow-card">
              <dt className="texto-meta">
                {t("total", { tipo: tc(`tipoCorto.${total.tipo}`), moneda: total.moneda })}
              </dt>
              <dd className="mt-1 text-xl font-semibold text-tinta">
                <Monto valor={total.total} moneda={total.moneda} />
              </dd>
              <dd className="texto-meta">{t("cantidad", { n: total.cantidad })}</dd>
            </div>
          ))}
        </dl>
      )}

      {filas.length === 0 ? (
        <EstadoVacio
          icono={ReceiptText}
          titulo={hayFiltro ? t("vacioFiltro") : t("vacio")}
         
        />
      ) : (
        <>
          <ListaRecibos filas={filas.slice(0, TOPE_RECIBOS)} idioma={idioma} />
          {filas.length > TOPE_RECIBOS && <p className="texto-meta">{t("tope")}</p>}
        </>
      )}
    </div>
  );
}
