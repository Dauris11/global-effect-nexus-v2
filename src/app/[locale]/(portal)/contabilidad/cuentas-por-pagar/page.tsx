import type { Metadata } from "next";
import { Download, GanttChartSquare, HandCoins, Plus } from "lucide-react";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/app/empty-state";
import { FilterBar, type ChipEstado } from "@/components/app/filter-bar";
import { MenuMasAcciones } from "@/components/app/menu-mas-acciones";
import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { ListaCxp } from "@/components/contabilidad/cxp/lista-cxp";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { requerirPermiso } from "@/lib/auth";
import { esUuid } from "@/lib/contabilidad/formato";
import { usuarioTienePermiso } from "@/lib/rbac";
import {
  conteosCxp,
  cuentasPorPagar,
  FILTROS_ESTADO_CXP,
  proveedoresConCxp,
  VENCIMIENTOS_CXP,
  type FiltroEstadoCxp,
  type VencimientoCxp,
} from "@/server/contabilidad/cxp/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contab.cxp" });
  return { title: t("titulo") };
}

export default async function PaginaCxp({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; estado?: string; proveedor?: string; vence?: string }>;
}) {
  const { locale } = await params;
  const crudo = await searchParams;
  const usuario = await requerirPermiso("contabilidad.leer");

  // Un valor desconocido en la URL (enlace viejo) se ignora en vez de romper la lista.
  const estado = (FILTROS_ESTADO_CXP as readonly string[]).includes(crudo.estado ?? "")
    ? (crudo.estado as FiltroEstadoCxp)
    : null;
  const filtro = {
    texto: crudo.q?.trim() || null,
    proveedorId: crudo.proveedor && esUuid(crudo.proveedor) ? crudo.proveedor : null,
    vencimiento: (VENCIMIENTOS_CXP as readonly string[]).includes(crudo.vence ?? "")
      ? (crudo.vence as VencimientoCxp)
      : null,
  };

  const [t, tl, te, tc, ta, lista, conteos, proveedores] = await Promise.all([
    getTranslations({ locale, namespace: "contab.cxp" }),
    getTranslations({ locale, namespace: "listas.cxp" }),
    getTranslations({ locale, namespace: "estados" }),
    getTranslations({ locale, namespace: "contab" }),
    getTranslations({ locale, namespace: "appUi" }),
    cuentasPorPagar(estado, filtro),
    conteosCxp(filtro),
    proveedoresConCxp(),
  ]);

  const puedeRegistrar = usuarioTienePermiso(usuario, "contabilidad.registrar");
  const hayFiltros = Boolean(estado || filtro.texto || filtro.proveedorId || filtro.vencimiento);

  const nueva = puedeRegistrar ? (
    <Button asChild>
      <Link href="/contabilidad/facturas/nueva">
        <Plus />
        {tl("registrarFactura")}
      </Link>
    </Button>
  ) : null;

  const chips: ChipEstado[] = [
    { value: "abiertas", label: tc("estadoCxp.abiertas"), count: conteos.abiertas },
    { value: "vencida", label: te("vencida"), count: conteos.vencida },
    { value: "por_vencer", label: te("por_vencer"), count: conteos.por_vencer },
    { value: "pendiente", label: te("pendiente"), count: conteos.pendiente },
    { value: "programada", label: te("programada"), count: conteos.programada },
    { value: "pagada_parcial", label: te("pagada_parcial"), count: conteos.pagada_parcial },
    { value: "pagada", label: te("pagada"), count: conteos.pagada },
    { value: "anulada", label: te("anulada"), count: conteos.anulada },
  ];

  return (
    <PageContainer className="animate-entrada space-y-6">
      <PageHeader
        title={t("titulo")}
        primaryAction={nueva}
        secondaryActions={
          <>
            <Button asChild variant="outline">
              <a href="/api/contabilidad/exportar/cxp" download>
                <Download />
                {t("exportarExcel")}
              </a>
            </Button>
            <MenuMasAcciones acciones={[{ etiqueta: t("gantt"), icono: <GanttChartSquare />, href: "/contabilidad/cuentas-por-pagar/gantt" }]} />
          </>
        }
      />

      <Suspense fallback={null}>
        <FilterBar
          chips={chips}
          totalChips={conteos.total}
          placeholder={tl("buscar")}
          selectores={[
            {
              param: "proveedor",
              label: tl("proveedor"),
              todos: tl("todosProveedores"),
              opciones: proveedores.map((p) => ({ value: p.id, label: p.nombre })),
            },
            {
              param: "vence",
              label: t("col.vencimiento"),
              todos: tl("cualquierFecha"),
              opciones: VENCIMIENTOS_CXP.map((v) => ({ value: v, label: tl(`vence.${v}`) })),
            },
          ]}
        />
      </Suspense>

      {lista.length === 0 ? (
        hayFiltros ? (
          <EmptyState
            icon={HandCoins}
            title={tl("sinResultados")}
            action={<Button asChild variant="outline"><Link href="/contabilidad/cuentas-por-pagar">{ta("filterBar.clear")}</Link></Button>}
          />
        ) : nueva ? (
          <EmptyState icon={HandCoins} title={t("vacio")} action={nueva} />
        ) : (
          <EmptyState readOnly icon={HandCoins} title={t("vacio")} description={tl("vacioSoloLectura")} />
        )
      ) : (
        <ListaCxp cuentas={lista} puedeRegistrar={puedeRegistrar} />
      )}
    </PageContainer>
  );
}
