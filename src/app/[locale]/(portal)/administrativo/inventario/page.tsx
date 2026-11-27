import { Package, Plus, QrCode } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { EmptyState } from "@/components/app/empty-state";
import { FilterBar } from "@/components/app/filter-bar";
import { PageHeader } from "@/components/app/page-header";
import { ListaActivos } from "@/components/inventario/lista-activos";
import { Button } from "@/components/ui/button";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { Link } from "@/i18n/navigation";
import { requerirPermiso } from "@/lib/auth";
import { CATEGORIAS_ACTIVO, ESTADOS_ACTIVO } from "@/lib/inventario";
import { usuarioTienePermiso } from "@/lib/rbac";
import {
  listarActivos,
  listarUbicacionesUnicas,
  obtenerMetricasInventario,
} from "@/server/inventario/consultas";

/** Un parámetro de la URL solo vale si está en la lista; lo demás se ignora en vez de llegar a la consulta. */
function deLista<T extends string>(valor: string | undefined, validos: readonly T[]): T | undefined {
  return validos.find((v) => v === valor);
}

/**
 * Inventario de activos (patrón Lista): chips de estado con conteo, búsqueda y filtros
 * en la URL, y la tabla justo debajo. Entra quien tenga `inventario.leer`; cada acción
 * (crear, editar, eliminar, auditar) se vuelve a comprobar en su acción de servidor.
 */
export default async function PaginaInventario({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale } = await params;
  const consulta = await searchParams;
  const usuario = await requerirPermiso("inventario.leer");

  const estado = deLista(consulta.estado, ESTADOS_ACTIVO);
  const categoria = deLista(consulta.categoria, CATEGORIAS_ACTIVO);
  const busqueda = consulta.q?.trim() || undefined;
  const ubicacion = consulta.ubicacion?.trim() || undefined;
  const hayFiltros = Boolean(estado || categoria || busqueda || ubicacion);

  const [t, tl, te, metricas, activos, ubicaciones, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "admin.inventario" }),
    getTranslations({ locale, namespace: "listas" }),
    getTranslations({ locale, namespace: "estados" }),
    obtenerMetricasInventario(),
    listarActivos({ busqueda, categoria, estado, ubicacion }),
    listarUbicacionesUnicas(),
    mensajesCliente(["admin"]),
  ]);

  const puedeEscribir = usuarioTienePermiso(usuario, "inventario.escribir");
  const puedeAuditar = usuarioTienePermiso(usuario, "inventario.auditar");
  const puedeEliminar = usuarioTienePermiso(usuario, "inventario.eliminar");

  // Una sola acción primaria: registrar. Quien solo audita tiene el escáner como primaria.
  const escaner = puedeAuditar ? (
    <Button asChild variant={puedeEscribir ? "outline" : "default"}>
      <Link href="/administrativo/inventario/escanear">
        <QrCode className="size-4" />
        {t("escanearQr")}
      </Link>
    </Button>
  ) : null;
  const nuevo = puedeEscribir ? (
    <Button asChild>
      <Link href="/administrativo/inventario/nuevo">
        <Plus className="size-4" />
        {t("nuevoActivo")}
      </Link>
    </Button>
  ) : null;

  const conteos: Record<(typeof ESTADOS_ACTIVO)[number], number> = {
    operativo: metricas.operativos,
    mantenimiento: metricas.enMantenimiento,
    prestado: metricas.enPrestamo,
    baja: metricas.deBaja,
  };
  const chips = ESTADOS_ACTIVO.filter((e) => conteos[e] > 0 || estado === e).map((e) => ({
    value: e,
    label: te(e),
    count: conteos[e],
  }));

  return (
    <div className="animate-entrada space-y-6">
      <PageHeader
        title={t("titulo")}
        primaryAction={nuevo ?? escaner}
        secondaryActions={nuevo ? escaner : undefined}
      />

      <Suspense fallback={null}>
        <FilterBar
          chips={chips}
          totalChips={metricas.totalActivos}
          placeholder={t("buscarPlaceholder")}
          selectores={[
            {
              param: "categoria",
              label: t("colCategoria"),
              todos: tl("inventario.todasCategorias"),
              opciones: CATEGORIAS_ACTIVO.map((c) => ({ value: c, label: t(`categorias.${c}`) })),
            },
            {
              param: "ubicacion",
              label: t("colUbicacion"),
              todos: tl("inventario.todasUbicaciones"),
              opciones: ubicaciones.map((u) => ({ value: u, label: u })),
            },
          ]}
        />
      </Suspense>

      {activos.length === 0 ? (
        hayFiltros ? (
          <EmptyState
            icon={Package}
            title={tl("inventario.sinResultados")}
            action={<Button asChild variant="outline"><Link href="/administrativo/inventario">{tl("inventario.quitarFiltros")}</Link></Button>}
          />
        ) : nuevo ? (
          <EmptyState icon={Package} title={tl("inventario.vacio")} description={tl("inventario.vacioAyuda")} action={nuevo} />
        ) : (
          <EmptyState readOnly icon={Package} title={tl("inventario.vacio")} description={tl("inventario.vacioSoloLectura")} />
        )
      ) : (
        <>
          <p className="texto-meta">{tl("inventario.cuenta", { count: activos.length })}</p>
          <NextIntlClientProvider messages={mensajes}>
            <ListaActivos activos={activos} puedeEscribir={puedeEscribir} puedeEliminar={puedeEliminar} />
          </NextIntlClientProvider>
        </>
      )}
    </div>
  );
}
