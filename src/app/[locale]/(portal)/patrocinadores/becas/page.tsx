import type { Metadata } from "next";
import { HandCoins } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { FilterBar, type ChipEstado } from "@/components/app/filter-bar";
import { PageHeader } from "@/components/app/page-header";
import { ListaBecas } from "@/components/patrocinadores/lista-becas";
import { variantesBoton } from "@/components/ui/button-variantes";
import { Link } from "@/i18n/navigation";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirPermiso } from "@/lib/auth";
import { usuarioTienePermiso } from "@/lib/rbac";
import { becadosConPatrocinio, patrocinadoresActivos } from "@/server/patrocinadores/consultas";

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
 * Becas: qué patrocinador sostiene a cada becado (patrón Lista).
 *
 * La fuente de verdad es `asignacion_beca` —con monto, fechas y estado propios—, no
 * `estudiante.patrocinador_id`, que se mantiene como espejo (ver la cabecera de la
 * sección de becas de `@/server/patrocinadores/consultas`).
 *
 * Mismos permisos que el directorio: `patrocinadores.leer` para entrar y
 * `patrocinadores.escribir` para vincular. Contabilidad ve a quién sostiene quién
 * sin poder cambiarlo.
 *
 * Los becados caben en memoria (son los de un solo programa), así que universidad,
 * país y chip se aplican aquí sobre el resultado de la búsqueda en SQL. Los conteos
 * de los chips respetan búsqueda, universidad y país pero no el propio chip.
 */
export default async function PaginaBecas({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; patrocinio?: string; universidad?: string; pais?: string }>;
}) {
  const { locale } = await params;
  const { q, patrocinio, universidad, pais } = await searchParams;

  const usuario = await requerirPermiso("patrocinadores.leer");
  const puedeEscribir = usuarioTienePermiso(usuario, "patrocinadores.escribir");

  const busqueda = (q ?? "").trim().slice(0, 80);
  const patrocinioOk = patrocinio === "sin" || patrocinio === "con" ? patrocinio : null;

  const [t, tl, todos, patrocinadores, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "sponsors" }),
    getTranslations({ locale, namespace: "listas" }),
    becadosConPatrocinio(busqueda),
    // El selector solo se llena para quien puede vincular.
    puedeEscribir ? patrocinadoresActivos() : Promise.resolve([]),
    mensajesCliente(["sponsors"]),
  ]);

  const universidades = [...new Set(todos.map((b) => b.universidad).filter((u): u is string => Boolean(u)))].sort();
  const paises = [...new Set(todos.map((b) => b.pais).filter((p): p is string => Boolean(p)))].sort();
  const universidadOk = universidad && universidades.includes(universidad) ? universidad : null;
  const paisOk = pais && paises.includes(pais) ? pais : null;

  const base = todos.filter((b) => (!universidadOk || b.universidad === universidadOk) && (!paisOk || b.pais === paisOk));
  const sin = base.filter((b) => !b.asignacion_id).length;
  const visibles = base.filter((b) => (patrocinioOk === "sin" ? !b.asignacion_id : patrocinioOk === "con" ? Boolean(b.asignacion_id) : true));

  const chips: ChipEstado[] = [
    { value: "sin", label: t("grants.filterUnsponsored"), count: sin },
    { value: "con", label: t("grants.filterSponsored"), count: base.length - sin },
  ];

  return (
    <div className="animate-entrada space-y-6">
      <PageHeader
        title={t("grants.title")}
        secondaryActions={
          <Link href="/patrocinadores" className={variantesBoton({ variant: "outline" })}>
            <HandCoins className="size-4" />
            {t("title")}
          </Link>
        }
      />

      <Suspense fallback={null}>
        <FilterBar
          chips={chips}
          chipParam="patrocinio"
          totalChips={base.length}
          placeholder={t("grants.searchPlaceholder")}
          selectores={[
            {
              param: "universidad",
              label: tl("becas.universidad"),
              todos: tl("becas.todasUniversidades"),
              opciones: universidades.map((u) => ({ value: u, label: u })),
            },
            {
              param: "pais",
              label: t("field.country"),
              todos: tl("becas.todosPaises"),
              opciones: paises.map((p) => ({ value: p, label: p })),
            },
          ]}
        />
      </Suspense>

      <NextIntlClientProvider messages={mensajes}>
        <ListaBecas
          becados={visibles}
          patrocinadores={patrocinadores}
          puedeEscribir={puedeEscribir}
          hayFiltro={Boolean(busqueda || patrocinioOk || universidadOk || paisOk)}
        />
      </NextIntlClientProvider>
    </div>
  );
}
