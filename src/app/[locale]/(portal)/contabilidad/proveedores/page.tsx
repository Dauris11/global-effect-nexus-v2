import type { Metadata } from "next";
import { FileSpreadsheet, Plus, Truck } from "lucide-react";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/app/empty-state";
import { FilterBar, type ChipEstado } from "@/components/app/filter-bar";
import { MenuMasAcciones } from "@/components/app/menu-mas-acciones";
import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { ListaProveedores } from "@/components/contabilidad/proveedores/lista-proveedores";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { requerirPermiso } from "@/lib/auth";
import { usuarioTienePermiso } from "@/lib/rbac";
import { conteosProveedores, listarProveedores } from "@/server/contabilidad/proveedores/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contab.proveedores" });
  return { title: t("titulo") };
}

export default async function PaginaProveedores({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; estado?: string; saldo?: string; tipo?: string }>;
}) {
  const { locale } = await params;
  const crudo = await searchParams;
  const usuario = await requerirPermiso("contabilidad.leer");

  // Un valor desconocido en la URL (enlace viejo) se ignora en vez de romper la lista.
  const texto = crudo.q?.trim() || null;
  const estado = crudo.estado === "activo" || crudo.estado === "inactivo" ? crudo.estado : null;
  const conSaldo = crudo.saldo === "1";
  const tipo = crudo.tipo === "fisica" || crudo.tipo === "juridica" ? crudo.tipo : null;

  const [t, tl, tc, ta, lista, conteos] = await Promise.all([
    getTranslations({ locale, namespace: "contab.proveedores" }),
    getTranslations({ locale, namespace: "listas.proveedores" }),
    getTranslations({ locale, namespace: "contab" }),
    getTranslations({ locale, namespace: "appUi" }),
    listarProveedores({ texto, estado, conSaldo, tipo }),
    conteosProveedores({ texto, tipo }),
  ]);

  const puedeRegistrar = usuarioTienePermiso(usuario, "contabilidad.registrar");
  const hayFiltros = Boolean(texto || estado || conSaldo || tipo);

  const nuevo = puedeRegistrar ? (
    <Button asChild>
      <Link href="/contabilidad/proveedores/nuevo">
        <Plus />
        {t("nuevo")}
      </Link>
    </Button>
  ) : null;

  const chips: ChipEstado[] = [
    { value: "activo", label: tl("activos"), count: conteos.activo, param: "estado" },
    { value: "inactivo", label: tl("inactivos"), count: conteos.inactivo, param: "estado" },
    { value: "1", label: tl("conSaldo"), count: conteos.con_saldo, param: "saldo" },
  ];

  return (
    <PageContainer className="animate-entrada space-y-6">
      <PageHeader
        title={t("titulo")}
        primaryAction={nuevo}
        secondaryActions={
          // El 606 se elige por mes en Impuestos: aquí solo se enlaza.
          <MenuMasAcciones acciones={[{ etiqueta: t("irImpuestos"), icono: <FileSpreadsheet />, href: "/contabilidad/impuestos" }]} />
        }
      />

      <Suspense fallback={null}>
        <FilterBar
          chips={chips}
          totalChips={conteos.total}
          placeholder={t("buscar")}
          selectores={[
            {
              param: "tipo",
              label: tl("tipo"),
              todos: tl("todosTipos"),
              opciones: [
                { value: "juridica", label: tc("tipoProveedor.juridica") },
                { value: "fisica", label: tc("tipoProveedor.fisica") },
              ],
            },
          ]}
        />
      </Suspense>

      {lista.length === 0 ? (
        hayFiltros ? (
          <EmptyState
            icon={Truck}
            title={t("vacioFiltro")}
            action={<Button asChild variant="outline"><Link href="/contabilidad/proveedores">{ta("filterBar.clear")}</Link></Button>}
          />
        ) : nuevo ? (
          <EmptyState icon={Truck} title={t("vacio")} action={nuevo} />
        ) : (
          <EmptyState readOnly icon={Truck} title={t("vacio")} description={tl("vacioSoloLectura")} />
        )
      ) : (
        <ListaProveedores proveedores={lista} puedeRegistrar={puedeRegistrar} />
      )}
    </PageContainer>
  );
}
