import type { Metadata } from "next";
import { ChevronLeft, ChevronRight, UtensilsCrossed } from "lucide-react";
import { Suspense } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/app/empty-state";
import { FilterBar } from "@/components/app/filter-bar";
import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { BotonImprimir } from "@/components/comida/boton-imprimir";
import { CompartirEnlace } from "@/components/comida/compartir-enlace";
import { ListaComedor } from "@/components/comida/lista-comedor";
import { Button } from "@/components/ui/button";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { requerirPermiso } from "@/lib/auth";
import { fechaLarga } from "@/lib/fechas";
import { usuarioTienePermiso } from "@/lib/rbac";
import { comensalesDelDia, resumenDelComedor } from "@/server/comida/consultas";

/** `YYYY-MM-DD`, que es lo que la URL puede traer y `date` acepta. */
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "comida" });

  return { title: t("adminTitle") };
}

/**
 * Lista de comida (patrón de tarea): la fecha con ‹ › y «Hoy», la lista de inscritos con un check de
 * «servido» y «Imprimir» como acción secundaria. Los conteos van en chips (Sin servir · Servidos) y, sin
 * nadie inscrito, el vacío ofrece compartir el enlace de inscripción. La hoja impresa se compone con clases
 * `print:` sobre la misma pantalla.
 */
export default async function PaginaListaComida({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ fecha?: string; estado?: string; q?: string }>;
}) {
  const [{ locale }, { fecha, estado, q }] = await Promise.all([params, searchParams]);
  const idioma: Locale = locale === "en" ? "en" : "es";
  const usuario = await requerirPermiso("operaciones.leer");

  const pedida = FECHA.test(fecha ?? "") ? fecha! : null;
  const [t, comensales, resumen, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "comida" }),
    comensalesDelDia(pedida),
    resumenDelComedor(pedida),
    mensajesCliente(["comida"]),
  ]);
  const dia = pedida ?? resumen.hoy;
  const mover = (dias: number) => {
    const base = new Date(`${dia}T12:00:00Z`);
    base.setUTCDate(base.getUTCDate() + dias);

    return `/inscripcion-comida?fecha=${base.toISOString().slice(0, 10)}`;
  };

  const sinServir = comensales.filter((c) => !c.servido).length;
  const texto = (q ?? "").trim().toLowerCase();
  const visibles = comensales.filter((c) => !texto || c.nombre.toLowerCase().includes(texto)).filter((c) => (estado === "sin_servir" ? !c.servido : estado === "servidos" ? c.servido : true));

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title={t("adminTitle")}
        subtitle={fechaLarga(dia, idioma)}
        secondaryActions={
          <>
            {dia === resumen.hoy && <StatusBadge status={resumen.abierto ? "activo" : "inactivo"} label={resumen.abierto ? t("open") : t("closed")} />}
            <NextIntlClientProvider messages={mensajes}>
              <BotonImprimir />
            </NextIntlClientProvider>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Button asChild variant="outline" size="sm" aria-label={t("prevDay")}>
          <Link href={mover(-1)}>
            <ChevronLeft aria-hidden />
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" aria-label={t("nextDay")}>
          <Link href={mover(1)}>
            <ChevronRight aria-hidden />
          </Link>
        </Button>
        {dia !== resumen.hoy && (
          <Button asChild variant="ghost" size="sm">
            <Link href="/inscripcion-comida">{t("today")}</Link>
          </Button>
        )}
      </div>

      {comensales.length > 0 && (
        <Suspense fallback={null}>
          <FilterBar
            chips={[
              { value: "sin_servir", label: t("onlyUnserved"), count: sinServir },
              { value: "servidos", label: t("onlyServed"), count: comensales.length - sinServir },
            ]}
            totalChips={comensales.length}
          />
        </Suspense>
      )}

      {comensales.length === 0 ? (
        <EmptyState
          icon={UtensilsCrossed}
          title={t("nobody")}
          action={
            <NextIntlClientProvider messages={mensajes}>
              <CompartirEnlace />
            </NextIntlClientProvider>
          }
        />
      ) : (
        <NextIntlClientProvider messages={mensajes}>
          <ListaComedor comensales={visibles} puedeMarcar={usuarioTienePermiso(usuario, "operaciones.escribir")} />
        </NextIntlClientProvider>
      )}
    </PageContainer>
  );
}
