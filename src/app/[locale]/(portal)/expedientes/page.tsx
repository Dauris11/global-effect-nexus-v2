import type { Metadata } from "next";
import { ChevronLeft, ChevronRight, HeartHandshake, Users } from "lucide-react";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

import { SelectorVista } from "@/components/expedientes/filtros-expedientes";
import { EmptyState } from "@/components/app/empty-state";
import { FilterBar } from "@/components/app/filter-bar";
import { MenuMasAcciones } from "@/components/app/menu-mas-acciones";
import { PageHeader } from "@/components/app/page-header";
import { umbralDeIndice } from "@/server/academico/indice";
import { parametros } from "@/server/parametros/consultas";
import { arbolCatalogo } from "@/server/universidades/consultas";
import { NuevoExpediente } from "@/components/expedientes/nuevo-expediente";
import { ListaExpedientes } from "@/components/expedientes/lista-expedientes";
import { TarjetasExpedientes } from "@/components/expedientes/tarjetas-expedientes";
import { MenuExportar } from "@/components/compartido/menu-exportar";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { requerirPermiso } from "@/lib/auth";
import { ESTADOS_ESTUDIANTE } from "@/lib/expedientes";
import {
  ORDENES_EXPEDIENTE,
  SITUACIONES_EXPEDIENTE,
  enlaceExpedientes,
  hayFiltros,
  leerConsultaExpedientes,
} from "@/lib/filtros-expedientes";
import { usuarioTienePermiso } from "@/lib/rbac";
import {
  conteosPorEstado,
  contarExpedientes,
  listaExpedientes,
  universidadesDeExpedientes,
} from "@/server/expedientes/consultas";

/** Filas por página. */
const POR_PAGINA = 20;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "records" });

  return { title: t("title") };
}

/**
 * Expedientes: la lista y el formulario de alta.
 *
 * Filtros, orden, vista (tarjetas o lista) y página viven en la URL
 * (`lib/filtros-expedientes.ts`); la foto de cada estudiante se ve en las dos
 * vistas.
 *
 * Entra quien tenga `expedientes.leer`: administración y `owner`. El
 * permiso se comprueba aquí y no por rol: si otro rol gana la lectura, se le
 * da en la base y aquí no hay que tocar nada.
 */
export default async function PaginaExpedientes({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale } = await params;
  const crudo = await searchParams;
  const consulta = leerConsultaExpedientes(crudo);
  // El expediente recién creado (`?nuevo=<id>`) se resalta un momento en la lista.
  const resaltarId = /^[0-9a-f-]{36}$/i.test(crudo.nuevo ?? "") ? crudo.nuevo : undefined;
  const idioma: Locale = locale === "en" ? "en" : "es";

  const usuario = await requerirPermiso("expedientes.leer");
  const puedeEscribir = usuarioTienePermiso(usuario, "expedientes.escribir");
  const t = await getTranslations({ locale, namespace: "records" });
  const te = await getTranslations({ locale, namespace: "export" });
  const tr = await getTranslations({ locale, namespace: "risk" });

  const filtros = {
    busqueda: consulta.busqueda,
    estado: consulta.estado,
    universidad: consulta.universidad,
    situacion: consulta.situacion,
  };

  const [conteos, enRiesgo, filas, total, universidades, arbol, tc, umbral, valoresParametros] = await Promise.all([
    conteosPorEstado(),
    contarExpedientes({ situacion: "en_riesgo" }),
    listaExpedientes({
      ...filtros,
      orden: consulta.orden,
      pagina: consulta.pagina,
      porPagina: POR_PAGINA,
    }),
    contarExpedientes(filtros),
    universidadesDeExpedientes(),
    puedeEscribir ? arbolCatalogo() : Promise.resolve(null),
    getTranslations({ locale, namespace: "catalog" }),
    umbralDeIndice(),
    parametros(),
  ]);
  const minimoSecundaria = Number(valoresParametros["becas.promedio_liceo_minimo"]) || 89;

  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  // El alta es la ÚNICA acción primaria de la página; se arma una vez y también sirve en el vacío.
  const nuevo = puedeEscribir ? <NuevoExpediente universidades={arbol?.universidades ?? []} /> : null;

  // Los chips reemplazan a las tarjetas de cifras: el conteo vive dentro del filtro.
  const chips = [
    ...ESTADOS_ESTUDIANTE.filter((e) => (conteos[e] ?? 0) > 0 || consulta.estado === e).map((e) => ({
      param: "estado",
      value: e,
      label: t(`status.${e}`),
      count: conteos[e] ?? 0,
    })),
    { param: "situacion", value: "en_riesgo", label: t("filters.situations.en_riesgo"), count: enRiesgo },
  ];
  const totalExpedientes = Object.values(conteos).reduce((n, c) => n + c, 0);

  return (
    <div className="animate-entrada space-y-6">
      <PageHeader
        title={t("title")}
        primaryAction={nuevo}
        secondaryActions={
          <>
            <MenuExportar
              documentos={[
                { tipo: "expedientes", etiqueta: te("docs.expedientes"), params: Object.fromEntries(new URLSearchParams(enlaceExpedientes(consulta, {}).split("?")[1] ?? "")) },
                { tipo: "riesgo", etiqueta: te("docs.riesgo") },
              ]}
            />
            <MenuMasAcciones acciones={[{ etiqueta: tr("title"), icono: <HeartHandshake />, href: "/expedientes/riesgo" }]} />
          </>
        }
      />

      <Suspense fallback={null}>
        <FilterBar
          chips={chips}
          totalChips={totalExpedientes}
          placeholder={t("filters.searchPlaceholder")}
          selectores={[
            { param: "universidad", label: t("filters.university"), todos: t("filters.allUniversities"), opciones: universidades.map((u) => ({ value: u, label: u })) },
            {
              param: "situacion",
              label: t("filters.situation"),
              todos: t("filters.anySituation"),
              opciones: SITUACIONES_EXPEDIENTE.filter((x) => x !== "en_riesgo").map((x) => ({ value: x, label: t(`filters.situations.${x}`) })),
            },
            { param: "orden", label: t("filters.order"), todos: t(`filters.orders.nombre`), opciones: ORDENES_EXPEDIENTE.filter((o) => o !== "nombre").map((o) => ({ value: o, label: t(`filters.orders.${o}`) })) },
          ]}
        />
      </Suspense>

      {filas.length === 0 ? (
        hayFiltros(consulta) ? (
          <EmptyState
            icon={Users}
            title={t("noMatches")}
            action={<Button asChild variant="outline"><Link href="/expedientes">{t("filters.clear")}</Link></Button>}
          />
        ) : nuevo ? (
          <EmptyState icon={Users} title={t("empty")} description={t("emptyHint")} action={nuevo} />
        ) : (
          <EmptyState readOnly icon={Users} title={t("empty")} description={t("emptyHint")} />
        )
      ) : (
        <>
          {/* Vista y paginación van arriba, no al final: es lo primero que se
              quiere cambiar al llegar, no lo último que se ve tras desplazar
              toda la lista. */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="texto-meta">{t("count", { count: total })}</p>

            <div className="flex flex-wrap items-center gap-3">
              <SelectorVista consulta={consulta} />

              {totalPaginas > 1 && (
                <div className="flex items-center gap-2">
                  <PaginaBoton
                    href={enlaceExpedientes(consulta, { pagina: consulta.pagina - 1 })}
                    deshabilitado={consulta.pagina <= 1}
                    icono={ChevronLeft}
                    etiqueta={t("pagination.previous")}
                  />
                  <span className="texto-meta whitespace-nowrap">
                    {t("pagination.page", { current: consulta.pagina, total: totalPaginas })}
                  </span>
                  <PaginaBoton
                    href={enlaceExpedientes(consulta, { pagina: consulta.pagina + 1 })}
                    deshabilitado={consulta.pagina >= totalPaginas}
                    icono={ChevronRight}
                    etiqueta={t("pagination.next")}
                  />
                </div>
              )}
            </div>
          </div>

          {consulta.vista === "tarjetas" ? (
            <TarjetasExpedientes resaltarId={resaltarId} filas={filas} idioma={idioma} puedeEscribir={puedeEscribir} umbral={umbral} minimoSecundaria={minimoSecundaria} />
          ) : (
            <ListaExpedientes resaltarId={resaltarId} filas={filas} idioma={idioma} puedeEscribir={puedeEscribir} umbral={umbral} minimoSecundaria={minimoSecundaria} />
          )}
        </>
      )}
    </div>
  );
}

/** Flecha de paginación. Sin JavaScript: si está deshabilitada, ni siquiera es un enlace. */
function PaginaBoton({
  href,
  deshabilitado,
  icono: Icono,
  etiqueta,
}: {
  href: string;
  deshabilitado: boolean;
  icono: React.ComponentType<{ className?: string }>;
  etiqueta: string;
}) {
  if (deshabilitado) {
    return (
      <span className="flex size-11 items-center justify-center rounded-control border border-linea text-tinta-3/50">
        <Icono className="size-4" />
        <span className="sr-only">{etiqueta}</span>
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-label={etiqueta}
      className="flex size-11 items-center justify-center rounded-control border border-linea transition-colors hover:bg-muted"
    >
      <Icono className="size-4" />
    </Link>
  );
}
