import type { Metadata } from "next";
import { GraduationCap, HandCoins, Search, UserCheck, UserX, X } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { CifraAcademica } from "@/components/academico/cifra";
import { GestionBecas } from "@/components/patrocinadores/gestion-becas";
import { Button } from "@/components/ui/button";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirPermiso } from "@/lib/auth";
import {
  usuarioTienePermiso,
} from "@/lib/rbac";
import {
  becadosConPatrocinio,
  patrocinadoresActivos,
  resumenDeBecas,
} from "@/server/patrocinadores/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "sponsors" });

  return { title: t("grants.title") };
}

/**
 * Becas: qué patrocinador sostiene a cada becado.
 *
 * La fuente de verdad es `asignacion_beca` —con monto, fechas y estado
 * propios—, no `estudiante.patrocinador_id`, que se mantiene como espejo. El
 * porqué está en la cabecera de la sección de becas de
 * `@/server/patrocinadores/consultas`.
 *
 * Mismos permisos que el directorio: `patrocinadores.leer` para entrar y
 * `patrocinadores.escribir` para vincular. Contabilidad ve a quién sostiene
 * quién —lo necesita para cuadrar los aportes— sin poder cambiarlo.
 */
export default async function PaginaBecas({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  const { q } = await searchParams;

  const usuario = await requerirPermiso("patrocinadores.leer");
  const puedeEscribir = usuarioTienePermiso(usuario, "patrocinadores.escribir");

  const busqueda = (q ?? "").trim().slice(0, 80);

  const [t, becados, resumen, patrocinadores, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "sponsors" }),
    becadosConPatrocinio(busqueda),
    resumenDeBecas(),
    // El selector solo se llena para quien puede vincular.
    puedeEscribir ? patrocinadoresActivos() : Promise.resolve([]),
    mensajesCliente(["sponsors"]),
  ]);

  return (
    <div className="animate-entrada mx-auto max-w-5xl space-y-6">
      <EncabezadoPagina titulo={t("grants.title")} />

      {/* Las cifras NO respetan la búsqueda, a propósito: son el estado del
          programa de becas entero. Un "sin asignar: 0" que en realidad
          significa "ninguno de los que buscaste" sería el peor sitio para
          equivocarse. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CifraAcademica
          valor={resumen.becados}
          etiqueta={t("grants.stats.scholars")}
          icono={GraduationCap}
        />
        <CifraAcademica
          valor={resumen.asignados}
          etiqueta={t("grants.stats.assigned")}
          icono={UserCheck}
        />
        <CifraAcademica
          valor={resumen.sin_asignar}
          etiqueta={t("grants.stats.pending")}
          icono={UserX}
          acento
        />
        <CifraAcademica
          valor={new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 0,
          }).format(resumen.comprometido)}
          etiqueta={t("grants.stats.committed")}
          icono={HandCoins}
        />
      </div>

      <form method="get" className="flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1 space-y-1.5">
          <label
            htmlFor="q"
            className="text-muted-foreground text-xs font-medium"
          >
            {t("search")}
          </label>
          <Input
            id="q"
            name="q"
            type="search"
            defaultValue={busqueda}
            placeholder={t("grants.searchPlaceholder")}
            maxLength={80}
          />
        </div>

        <Button
          type="submit"
          className="transition-transform duration-150 active:scale-95"
        >
          <Search className="size-4" />
          {t("apply")}
        </Button>

        {busqueda && (
          <Button asChild variant="ghost">
            <Link href="/patrocinadores/becas">
              <X className="size-4" />
              {t("clear")}
            </Link>
          </Button>
        )}
      </form>

      <NextIntlClientProvider messages={mensajes}>
        <GestionBecas
          becados={becados}
          patrocinadores={patrocinadores}
          puedeEscribir={puedeEscribir}
          hayFiltro={Boolean(busqueda)}
        />
      </NextIntlClientProvider>
    </div>
  );
}
