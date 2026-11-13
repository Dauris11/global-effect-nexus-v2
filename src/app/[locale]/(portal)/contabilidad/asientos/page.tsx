import type { Metadata } from "next";
import { NotebookPen, Plus, Repeat } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { FormularioProcesar } from "@/components/contabilidad/asientos/acciones";
import { FiltrosAsientos } from "@/components/contabilidad/asientos/filtros-asientos";
import { ListaAsientos } from "@/components/contabilidad/asientos/lista-asientos";
import { Button } from "@/components/ui/button";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { NextIntlClientProvider } from "next-intl";
import { Link } from "@/i18n/navigation";
import { requerirPermiso } from "@/lib/auth";
import { usuarioTienePermiso } from "@/lib/rbac";
import {
  asientos,
  hayFiltroAsientos,
  leerFiltroAsientos,
  periodos,
  TOPE_ASIENTOS,
} from "@/server/contabilidad/asientos/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contab.asientos" });
  return { title: t("titulo") };
}

/**
 * Libro diario: todos los asientos, también los que escriben los recibos y
 * las facturas. Leer pide `contabilidad.leer`; escribir a mano pide
 * `contabilidad.asiento_manual`, y el botón solo es comodidad: la server
 * action lo vuelve a comprobar.
 */
export default async function PaginaAsientos({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const idioma = locale === "en" ? "en" : "es";
  const usuario = await requerirPermiso("contabilidad.leer");
  const filtro = leerFiltroAsientos(await searchParams);
  const hayFiltro = hayFiltroAsientos(filtro);

  const [t, tc, filas, listaPeriodos, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "contab.asientos" }),
    getTranslations({ locale, namespace: "contab" }),
    asientos(filtro),
    periodos(),
    mensajesCliente(["contab"]),
  ]);
  const escribe = usuarioTienePermiso(usuario, "contabilidad.asiento_manual");
  const procesa =
    usuarioTienePermiso(usuario, "contabilidad.aprobar") &&
    filas.some((f) => !f.procesado && f.estado !== "anulado");

  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-entrada">
      <EncabezadoPagina
        titulo={t("titulo")}
        acciones={
          <>
            <Button asChild variant="secondary">
              <Link href="/contabilidad/asientos/recurrentes">
                <Repeat className="size-4" />
                {t("recurrentes")}
              </Link>
            </Button>
            {escribe && (
              <Button asChild>
                <Link href="/contabilidad/asientos/nuevo">
                  <Plus className="size-4" />
                  {t("nuevo")}
                </Link>
              </Button>
            )}
          </>
        }
      />

      <FiltrosAsientos filtro={filtro} periodos={listaPeriodos} hayFiltro={hayFiltro} idioma={idioma} />

      {filas.length === 0 ? (
        <EstadoVacio
          icono={NotebookPen}
          titulo={hayFiltro ? t("vacioFiltro") : t("vacio")}
         
        />
      ) : (
        <>
          {procesa ? (
            <NextIntlClientProvider messages={mensajes}>
              <FormularioProcesar>
                <ListaAsientos filas={filas.slice(0, TOPE_ASIENTOS)} idioma={idioma} elegible />
              </FormularioProcesar>
            </NextIntlClientProvider>
          ) : (
            <ListaAsientos filas={filas.slice(0, TOPE_ASIENTOS)} idioma={idioma} />
          )}
          {filas.length > TOPE_ASIENTOS && <p className="texto-meta">{t("tope", { n: TOPE_ASIENTOS })}</p>}
        </>
      )}
    </div>
  );
}
