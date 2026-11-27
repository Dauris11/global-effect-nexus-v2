import type { Metadata } from "next";
import { Download, FileSpreadsheet, Plus, ReceiptText } from "lucide-react";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/app/empty-state";
import { FilterBar } from "@/components/app/filter-bar";
import { MenuMasAcciones } from "@/components/app/menu-mas-acciones";
import { PageHeader } from "@/components/app/page-header";
import { CamposUrl } from "@/components/contabilidad/filtros-url";
import { ListaRecibos } from "@/components/contabilidad/recibos/lista-recibos";
import { Button } from "@/components/ui/button";
import { getPathname, Link } from "@/i18n/navigation";
import { requerirPermiso } from "@/lib/auth";
import { ESTADOS_RECIBO, MONEDAS, TIPOS_RECIBO } from "@/lib/contabilidad/formato";
import { usuarioTienePermiso } from "@/lib/rbac";
import {
  conteosRecibos,
  hayFiltroRecibos,
  leerFiltroRecibos,
  opcionesRecibo,
  recibos,
  TOPE_RECIBOS,
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
 * Consulta de recibos (§4.3) con el patrón Lista. Los conteos de los chips
 * salen de la base sobre el filtro ENTERO, no de las 200 filas pintadas. Los
 * totales por tipo y moneda ya no se pintan en tarjetas: sumar pesos con
 * dólares no da ninguna cifra que exista, y el CSV los trae.
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

  const [t, tl, tc, filas, conteos, opciones] = await Promise.all([
    getTranslations({ locale, namespace: "contab.recibos" }),
    getTranslations({ locale, namespace: "listas.recibos" }),
    getTranslations({ locale, namespace: "contab" }),
    recibos(filtro),
    conteosRecibos(filtro),
    opcionesRecibo(),
  ]);
  const registra = usuarioTienePermiso(usuario, "contabilidad.registrar");
  const puedeAprobar = usuarioTienePermiso(usuario, "contabilidad.aprobar");

  const consulta = new URLSearchParams(
    Object.entries(crudo).flatMap(([k, v]) => (typeof v === "string" && v ? [[k, v]] : [])),
  ).toString();

  const nuevo = registra ? (
    <Button asChild>
      <Link href="/contabilidad/recibos/nuevo">
        <Plus className="size-4" />
        {t("nuevo")}
      </Link>
    </Button>
  ) : null;

  const chips = [
    ...ESTADOS_RECIBO.map((estado) => ({
      param: "estado",
      value: estado,
      label: tc(`estado.${estado}`),
      count: conteos.porEstado[estado] ?? 0,
    })),
    ...TIPOS_RECIBO.map((tipo) => ({
      param: "tipo",
      value: tipo,
      label: tc(`tipoCorto.${tipo}`),
      count: conteos.porTipo[tipo] ?? 0,
    })),
  ];

  const aOpciones = (lista: { id: string; nombre: string }[]) => lista.map((o) => ({ value: o.id, label: o.nombre }));

  return (
    <div className="animate-entrada space-y-6">
      <PageHeader
        title={t("titulo")}
        primaryAction={nuevo}
        secondaryActions={
          <>
            <Button asChild variant="outline">
              {/* <a> y no <Link>: es una descarga, no una navegación. */}
              <a
                href={`${getPathname({ href: "/contabilidad/recibos/exportar", locale })}${consulta ? `?${consulta}` : ""}`}
              >
                <Download className="size-4" />
                {t("exportar")}
              </a>
            </Button>
            {/* El 607 se elige por mes en Impuestos: aquí solo se enlaza. */}
            <MenuMasAcciones
              acciones={[{ etiqueta: tc("modulos.irImpuestos"), icono: <FileSpreadsheet />, href: "/contabilidad/impuestos" }]}
            />
          </>
        }
      />

      <Suspense fallback={null}>
        <FilterBar
          chips={chips}
          totalChips={conteos.total}
          placeholder={tl("buscar")}
          selectores={[
            { param: "cuenta", label: t("cuenta"), todos: t("todas"), opciones: aOpciones(opciones.cuentas) },
            { param: "moneda", label: t("moneda"), todos: t("todas"), opciones: MONEDAS.map((m) => ({ value: m, label: m })) },
            { param: "categoria", label: t("categoria"), todos: t("todas"), opciones: aOpciones(opciones.categorias) },
            { param: "proyecto", label: t("proyecto"), todos: t("todos"), opciones: aOpciones(opciones.proyectos) },
            { param: "creado", label: t("creadoPor"), todos: t("todos"), opciones: aOpciones(opciones.personas) },
            { param: "aprobado", label: t("aprobadoPor"), todos: t("todos"), opciones: aOpciones(opciones.personas) },
          ]}
          moreFilters={
            <CamposUrl
              campos={[
                { param: "desde", label: t("desde"), tipo: "date" },
                { param: "hasta", label: t("hasta"), tipo: "date" },
                { param: "numero", label: t("numero"), tipo: "number" },
                { param: "tercero", label: t("tercero"), tipo: "text" },
                { param: "min", label: t("montoMin"), tipo: "number" },
                { param: "max", label: t("montoMax"), tipo: "number" },
              ]}
            />
          }
        />
      </Suspense>

      {filas.length === 0 ? (
        hayFiltro ? (
          <EmptyState
            icon={ReceiptText}
            title={t("vacioFiltro")}
            action={
              <Button asChild variant="outline">
                <Link href="/contabilidad/recibos">{tl("quitarFiltros")}</Link>
              </Button>
            }
          />
        ) : nuevo ? (
          <EmptyState icon={ReceiptText} title={t("vacio")} description={t("vacioTexto")} action={nuevo} />
        ) : (
          <EmptyState readOnly icon={ReceiptText} title={t("vacio")} description={t("vacioTexto")} />
        )
      ) : (
        <>
          <ListaRecibos filas={filas.slice(0, TOPE_RECIBOS)} idioma={idioma} puedeAprobar={puedeAprobar} />
          {filas.length > TOPE_RECIBOS && <p className="text-meta">{t("tope")}</p>}
        </>
      )}
    </div>
  );
}
