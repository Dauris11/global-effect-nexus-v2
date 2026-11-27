import type { Metadata } from "next";
import { Landmark, ScanSearch } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { EmptyState } from "@/components/app/empty-state";
import { FilterBar } from "@/components/app/filter-bar";
import { PageHeader } from "@/components/app/page-header";
import { ListaUniversidades } from "@/components/universidades/lista-universidades";
import { NuevaUniversidad } from "@/components/universidades/nueva-universidad";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirPermiso } from "@/lib/auth";
import { usuarioTienePermiso } from "@/lib/rbac";
import { universidadesCatalogo } from "@/server/universidades/consultas";

const REGIMENES = ["cuatrimestre", "trimestre", "semestre"] as const;
const ESTADOS = ["activa", "inactiva"] as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "catalog" });

  return { title: t("title") };
}

/**
 * Catálogo de universidades (patrón Lista). Entra quien lee lo académico; crea quien
 * tiene `catalogo.escribir`. Es la raíz de universidad → carrera → pénsum.
 *
 * El catálogo es corto (decenas de filas), así que se trae completo y se filtra aquí
 * en el servidor: los conteos de los chips salen del total, no de lo ya filtrado.
 */
export default async function PaginaUniversidades({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale } = await params;
  const consulta = await searchParams;
  const usuario = await requerirPermiso("catalogo.leer");
  const [t, tl, te, todas, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "catalog" }),
    getTranslations({ locale, namespace: "listas" }),
    getTranslations({ locale, namespace: "estados" }),
    universidadesCatalogo(),
    mensajesCliente(["catalog"]),
  ]);
  const puedeEscribir = usuarioTienePermiso(usuario, "catalogo.escribir");
  const puedeCargarNotas = usuarioTienePermiso(usuario, "expedientes.escribir");

  const estado = ESTADOS.find((e) => e === consulta.estado);
  const regimen = REGIMENES.find((r) => r === consulta.regimen);
  const busqueda = consulta.q?.trim().toLowerCase() ?? "";
  const hayFiltros = Boolean(estado || regimen || busqueda);

  const universidades = todas.filter(
    (u) =>
      (!estado || u.activa === (estado === "activa")) &&
      (!regimen || u.regimen === regimen) &&
      (!busqueda || u.siglas.toLowerCase().includes(busqueda) || u.nombre.toLowerCase().includes(busqueda)),
  );

  const conteos = { activa: todas.filter((u) => u.activa).length, inactiva: todas.filter((u) => !u.activa).length };
  const chips = ESTADOS.filter((e) => conteos[e] > 0 || estado === e).map((e) => ({ value: e, label: te(e), count: conteos[e] }));

  const nueva = puedeEscribir ? <NuevaUniversidad /> : null;

  return (
    <div className="animate-entrada space-y-6">
      <NextIntlClientProvider messages={mensajes}>
        <PageHeader
          title={t("title")}
          primaryAction={nueva}
          secondaryActions={
            puedeCargarNotas ? (
              <Button asChild variant="outline">
                <Link href="/academico/universidades/calificaciones">
                  <ScanSearch className="size-4" />
                  {t("upload.open")}
                </Link>
              </Button>
            ) : undefined
          }
        />
      </NextIntlClientProvider>

      <Suspense fallback={null}>
        <FilterBar
          chips={chips}
          totalChips={todas.length}
          selectores={[
            {
              param: "regimen",
              label: t("university.regime"),
              todos: tl("universidades.todosRegimenes"),
              opciones: REGIMENES.map((r) => ({ value: r, label: t(`regime.${r}`) })),
            },
          ]}
        />
      </Suspense>

      {universidades.length === 0 ? (
        hayFiltros ? (
          <EmptyState
            icon={Landmark}
            title={tl("universidades.sinResultados")}
            action={<Button asChild variant="outline"><Link href="/academico/universidades">{tl("universidades.quitarFiltros")}</Link></Button>}
          />
        ) : nueva ? (
          <EmptyState
            icon={Landmark}
            title={t("university.empty")}
            description={tl("universidades.vacioAyuda")}
            action={<NextIntlClientProvider messages={mensajes}>{nueva}</NextIntlClientProvider>}
          />
        ) : (
          <EmptyState readOnly icon={Landmark} title={t("university.empty")} description={tl("universidades.vacioSoloLectura")} />
        )
      ) : (
        <>
          <p className="texto-meta">{tl("universidades.cuenta", { count: universidades.length })}</p>
          <NextIntlClientProvider messages={mensajes}>
            <ListaUniversidades universidades={universidades} />
          </NextIntlClientProvider>
        </>
      )}
    </div>
  );
}
