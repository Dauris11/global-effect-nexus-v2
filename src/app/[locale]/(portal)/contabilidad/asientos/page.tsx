import type { Metadata } from "next";
import { NotebookPen, Plus, Repeat } from "lucide-react";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/app/empty-state";
import { FilterBar } from "@/components/app/filter-bar";
import { MenuMasAcciones } from "@/components/app/menu-mas-acciones";
import { PageHeader } from "@/components/app/page-header";
import { FormularioProcesar } from "@/components/contabilidad/asientos/acciones";
import { ListaAsientos } from "@/components/contabilidad/asientos/lista-asientos";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { requerirPermiso } from "@/lib/auth";
import { TIPOS_ASIENTO } from "@/lib/contabilidad/asientos";
import { mesLargo } from "@/lib/fechas";
import { usuarioTienePermiso } from "@/lib/rbac";
import {
  asientos,
  conteosAsientos,
  FILTRO_ANULADOS,
  FILTRO_PROCESO,
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
 *
 * Patrón Lista: los filtros viven en la URL y se leen aquí; los conteos de
 * los chips salen de la base sobre el mismo filtro.
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

  const [t, tl, filas, conteos, listaPeriodos] = await Promise.all([
    getTranslations({ locale, namespace: "contab.asientos" }),
    getTranslations({ locale, namespace: "listas.asientos" }),
    asientos(filtro),
    conteosAsientos(filtro),
    periodos(),
  ]);
  const escribe = usuarioTienePermiso(usuario, "contabilidad.asiento_manual");
  const puedeProcesar = usuarioTienePermiso(usuario, "contabilidad.aprobar");
  const procesaVarios = puedeProcesar && filas.some((f) => !f.procesado && f.estado !== "anulado");
  const visibles = filas.slice(0, TOPE_ASIENTOS);

  const nuevo = escribe ? (
    <Button asChild>
      <Link href="/contabilidad/asientos/nuevo">
        <Plus className="size-4" />
        {t("nuevo")}
      </Link>
    </Button>
  ) : null;

  const chips = [
    ...TIPOS_ASIENTO.map((tipo) => ({
      param: "tipo",
      value: tipo,
      label: t(`tipo.${tipo}`),
      count: conteos.porTipo[tipo] ?? 0,
    })),
    ...FILTRO_PROCESO.map((proceso) => ({
      param: "proceso",
      value: proceso,
      label: t(`estado.${proceso === "pendiente" ? "pendiente" : "procesado"}`),
      count: conteos.porProceso[proceso],
    })),
  ];

  const lista = (
    <ListaAsientos
      filas={visibles}
      idioma={idioma}
      elegible={procesaVarios}
      puedeProcesar={puedeProcesar}
      puedeRevertir={escribe}
    />
  );

  return (
    <div className="animate-entrada space-y-6">
      <PageHeader
        title={t("titulo")}
        primaryAction={nuevo}
        secondaryActions={
          <MenuMasAcciones
            acciones={[{ etiqueta: t("recurrentes"), icono: <Repeat />, href: "/contabilidad/asientos/recurrentes" }]}
          />
        }
      />

      <Suspense fallback={null}>
        <FilterBar
          chips={chips}
          totalChips={conteos.total}
          placeholder={tl("buscar")}
          selectores={[
            {
              param: "periodo",
              label: t("filtros.periodo"),
              todos: t("filtros.todosPeriodos"),
              opciones: listaPeriodos.map((p) => ({
                value: p.clave,
                label: p.cerrado
                  ? t("filtros.periodoCerrado", { mes: mesLargo(p.clave, idioma) })
                  : mesLargo(p.clave, idioma),
              })),
            },
            {
              param: "anulados",
              label: t("filtros.anulados"),
              todos: t("filtros.anuladosTodos"),
              opciones: FILTRO_ANULADOS.map((v) => ({ value: v, label: t(`filtros.anulados_${v}`) })),
            },
          ]}
        />
      </Suspense>

      {filas.length === 0 ? (
        hayFiltro ? (
          <EmptyState
            icon={NotebookPen}
            title={t("vacioFiltro")}
            action={
              <Button asChild variant="outline">
                <Link href="/contabilidad/asientos">{tl("quitarFiltros")}</Link>
              </Button>
            }
          />
        ) : nuevo ? (
          <EmptyState icon={NotebookPen} title={t("vacio")} description={t("vacioTexto")} action={nuevo} />
        ) : (
          <EmptyState readOnly icon={NotebookPen} title={t("vacio")} description={t("vacioTexto")} />
        )
      ) : (
        <>
          {procesaVarios ? <FormularioProcesar>{lista}</FormularioProcesar> : lista}
          {filas.length > TOPE_ASIENTOS && <p className="text-meta">{t("tope", { n: TOPE_ASIENTOS })}</p>}
        </>
      )}
    </div>
  );
}
