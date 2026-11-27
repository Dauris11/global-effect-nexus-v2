import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { FilterBar, type ChipEstado } from "@/components/app/filter-bar";
import { MenuMasAcciones } from "@/components/app/menu-mas-acciones";
import { PageHeader } from "@/components/app/page-header";
import { ListaPatrocinadores } from "@/components/patrocinadores/lista-patrocinadores";
import { BotonNuevoPatrocinador } from "@/components/patrocinadores/panel-patrocinador";
import { TIPOS_PATROCINADOR } from "@/lib/patrocinadores";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirPermiso } from "@/lib/auth";
import { usuarioTienePermiso } from "@/lib/rbac";
import {
  conteosPatrocinadoresPorEstado,
  directorioPatrocinadores,
  hayMasPatrocinadores,
  paisesDePatrocinadores,
  recortarPatrocinadores,
} from "@/server/patrocinadores/consultas";

const ESTADOS = ["activo", "pausado", "inactivo"] as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "sponsors" });

  return { title: t("title") };
}

/**
 * Directorio de patrocinadores (patrón Lista: encabezado, barra de filtros con
 * conteos y tabla densa).
 *
 * `patrocinadores.leer` para entrar, `patrocinadores.escribir` para tocar.
 * `contabilidad` tiene el primero y no el segundo: ve el directorio y los aportes
 * comprometidos —los necesita para cuadrar— pero no cambia con quién tiene la
 * Fundación un acuerdo.
 *
 * Los filtros viven en la URL y se recortan en SQL. Los conteos de los chips salen
 * de una consulta agregada aparte (no de contar las filas visibles: la lista está
 * topada en 200) y respetan búsqueda, tipo y país pero no el estado.
 */
export default async function PaginaPatrocinadores({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; tipo?: string; estado?: string; pais?: string }>;
}) {
  const { locale } = await params;
  const { q, tipo, estado, pais } = await searchParams;

  const usuario = await requerirPermiso("patrocinadores.leer");
  const puedeEscribir = usuarioTienePermiso(usuario, "patrocinadores.escribir");

  const busqueda = (q ?? "").trim().slice(0, 80);
  // Los parámetros se pueden manipular en la URL: lo que no esté en la lista se
  // ignora en vez de llegar al SQL.
  const tipoOk = TIPOS_PATROCINADOR.includes(tipo as (typeof TIPOS_PATROCINADOR)[number]) ? tipo! : null;
  const estadoOk = ESTADOS.includes(estado as (typeof ESTADOS)[number]) ? estado! : null;
  const paisOk = (pais ?? "").trim().slice(0, 80) || null;

  const [t, tCartas, filas, conteos, paises, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "sponsors" }),
    getTranslations({ locale, namespace: "sponsorMail" }),
    directorioPatrocinadores({ busqueda, tipo: tipoOk, estado: estadoOk, pais: paisOk }),
    conteosPatrocinadoresPorEstado({ busqueda, tipo: tipoOk, pais: paisOk }),
    paisesDePatrocinadores(),
    mensajesCliente(["sponsors", "sponsorMail"]),
  ]);
  const tl = await getTranslations({ locale, namespace: "listas" });

  const total = Object.values(conteos).reduce((n, c) => n + c, 0);
  // «Pausado» solo aparece si hay alguno (o si es el filtro puesto): un chip en 0 es ruido.
  const chips: ChipEstado[] = ESTADOS.filter((e) => (conteos[e] ?? 0) > 0 || e === estadoOk).map((e) => ({
    value: e,
    label: t(`state.${e}`),
    count: conteos[e] ?? 0,
  }));

  return (
    <div className="animate-entrada space-y-6">
      <PageHeader
        title={t("title")}
        primaryAction={puedeEscribir ? (
          <NextIntlClientProvider messages={mensajes}>
            <BotonNuevoPatrocinador />
          </NextIntlClientProvider>
        ) : undefined}
        secondaryActions={
          puedeEscribir ? (
            <MenuMasAcciones acciones={[{ etiqueta: tCartas("viewMail"), icono: <Mail />, href: "/patrocinadores/correos" }]} />
          ) : undefined
        }
      />

      <Suspense fallback={null}>
        <FilterBar
          chips={chips}
          totalChips={total}
          placeholder={t("searchPlaceholder")}
          selectores={[
            {
              param: "tipo",
              label: t("field.type"),
              todos: t("allTypes"),
              opciones: TIPOS_PATROCINADOR.map((v) => ({ value: v, label: t(`type.${v}`) })),
            },
            {
              param: "pais",
              label: t("field.country"),
              todos: tl("patrocinadores.todosPaises"),
              opciones: paises.map((p) => ({ value: p, label: p })),
            },
          ]}
        />
      </Suspense>

      <NextIntlClientProvider messages={mensajes}>
        <ListaPatrocinadores
          patrocinadores={recortarPatrocinadores(filas)}
          puedeEscribir={puedeEscribir}
          hayMas={hayMasPatrocinadores(filas)}
          hayFiltro={Boolean(busqueda || tipoOk || estadoOk || paisOk)}
        />
      </NextIntlClientProvider>
    </div>
  );
}
