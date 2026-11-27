"use client";

import { useState } from "react";
import {
  AlertCircle,
  Armchair,
  Car,
  Eye,
  Laptop,
  Loader2,
  Package,
  PencilLine,
  Refrigerator,
  Trash2,
  Wrench,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Link, useRouter } from "@/i18n/navigation";
import type { ActivoInventario, CategoriaActivo } from "@/lib/inventario";
import { eliminarActivoAction } from "@/server/inventario/acciones";

const ICONO_CATEGORIA: Record<CategoriaActivo, React.ComponentType<{ className?: string }>> = {
  herramientas: Wrench,
  tecnologia: Laptop,
  mobiliario: Armchair,
  electrodomesticos: Refrigerator,
  vehiculos: Car,
  otros: Package,
};

const moneda = new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", maximumFractionDigits: 0 });

/**
 * Lista de activos del patrón Lista: tabla densa en ≥ md, filas compactas en el móvil y
 * un panel lateral con el resumen y las acciones. Los filtros viven en la URL
 * (`FilterBar`), así que aquí solo se pinta lo que el servidor ya filtró.
 *
 * Los permisos llegan como booleanos calculados en el servidor para mostrar u ocultar
 * botones; la autorización real sigue en cada acción (`inventario.escribir/eliminar`).
 */
export function ListaActivos({
  activos,
  puedeEscribir,
  puedeEliminar,
}: {
  activos: ActivoInventario[];
  puedeEscribir: boolean;
  puedeEliminar: boolean;
}) {
  const t = useTranslations("admin.inventario");
  const tl = useTranslations("listas");
  const router = useRouter();
  const [seleccionado, setSeleccionado] = useState<ActivoInventario | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dinero = (v: number | null) => (v === null ? "—" : moneda.format(v));

  const abrir = (a: ActivoInventario) => {
    setError(null);
    setSeleccionado(a);
  };

  const eliminar = async (a: ActivoInventario) => {
    if (!window.confirm(t("confirmarEliminar", { code: a.codigo, name: a.nombre }))) return;

    try {
      setError(null);
      setEliminando(true);
      await eliminarActivoAction(a.id);
      setSeleccionado(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errorEliminar"));
    } finally {
      setEliminando(false);
    }
  };

  return (
    <>
      <div className="overflow-hidden rounded-card border border-linea bg-card shadow-card">
        {/* ≥ md: tabla densa */}
        <table className="hidden w-full text-sm md:table">
          <thead className="border-b border-linea text-left texto-meta">
            <tr>
              <th className="px-4 py-3 font-medium">{t("colCodigoActivo")}</th>
              <th className="px-4 py-3 font-medium">{t("colEstado")}</th>
              <th className="px-4 py-3 font-medium">{t("colCategoria")}</th>
              <th className="px-4 py-3 font-medium">{t("colUbicacion")}</th>
              <th className="px-4 py-3 font-medium">{t("colCustodio")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("colValor")}</th>
              <th className="px-4 py-3">
                <span className="sr-only">{t("colAcciones")}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-linea">
            {activos.map((a) => {
              const Icono = ICONO_CATEGORIA[a.categoria] ?? Package;

              return (
                <tr key={a.id} className="group relative h-[52px] transition-colors hover:bg-muted/50">
                  <td className="px-4 py-1.5">
                    <button
                      type="button"
                      onClick={() => abrir(a)}
                      title={tl("inventario.abrir")}
                      aria-label={`${tl("inventario.abrir")}: ${a.codigo} ${a.nombre}`}
                      className="flex min-w-0 items-center gap-3 text-left outline-none after:absolute after:inset-0 after:content-[''] focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Miniatura activo={a} className="size-9 rounded-control" />
                      <span className="min-w-0">
                        <span className="block font-mono text-sm font-semibold">{a.codigo}</span>
                        <span className="text-meta block max-w-64 truncate">{a.nombre}</span>
                      </span>
                    </button>
                  </td>
                  <td className="px-4 py-1.5">
                    <StatusBadge status={a.estado} />
                  </td>
                  <td className="px-4 py-1.5">
                    <span className="text-meta inline-flex items-center gap-1.5">
                      <Icono aria-hidden className="size-4" />
                      {t(`categorias.${a.categoria}`)}
                    </span>
                  </td>
                  <td className="text-meta max-w-48 truncate px-4 py-1.5">{a.ubicacion}</td>
                  <td className="text-meta max-w-48 truncate px-4 py-1.5">{a.responsableNombre ?? t("sinCustodio")}</td>
                  <td className="px-4 py-1.5 text-right font-mono text-sm tabular-nums">{dinero(a.valorEstimado)}</td>
                  {/* Acciones al pasar el ratón (o con el foco), por encima del botón que cubre la fila. */}
                  <td className="relative z-10 w-24 px-2 py-1.5 text-right">
                    <span className="inline-flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                      <Button asChild variant="ghost" size="icon" aria-label={t("verFichaTitulo")}>
                        <Link href={`/administrativo/inventario/${a.id}`}><Eye /></Link>
                      </Button>
                      {puedeEscribir && (
                        <Button asChild variant="ghost" size="icon" aria-label={t("editarFichaTitulo")}>
                          <Link href={`/administrativo/inventario/${a.id}/editar`}><PencilLine /></Link>
                        </Button>
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* < md: filas compactas */}
        <ul className="divide-y divide-linea md:hidden">
          {activos.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => abrir(a)}
                aria-label={`${tl("inventario.abrir")}: ${a.codigo} ${a.nombre}`}
                className="flex w-full items-center gap-3 p-3.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Miniatura activo={a} className="size-12 rounded-control" />
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="block font-mono text-sm font-semibold">{a.codigo}</span>
                  <span className="text-meta block truncate">{a.nombre} · {a.ubicacion}</span>
                  <StatusBadge status={a.estado} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <Sheet open={seleccionado !== null} onOpenChange={(abierto) => !abierto && setSeleccionado(null)}>
        <SheetContent>
          {seleccionado && (
            <>
              <header className="border-b border-linea px-6 pt-6 pr-16 pb-4">
                <div className="flex items-center gap-4">
                  <Miniatura activo={seleccionado} className="size-16 rounded-card" />
                  <div className="min-w-0 space-y-2">
                    <SheetTitle className="text-section">{seleccionado.nombre}</SheetTitle>
                    <SheetDescription className="sr-only">{tl("inventario.resumen")}</SheetDescription>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold">{seleccionado.codigo}</span>
                      <StatusBadge status={seleccionado.estado} />
                    </div>
                  </div>
                </div>
              </header>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
                {error && (
                  <p role="alert" className="flex items-center gap-2 rounded-control bg-tinta p-3 text-sm font-medium text-background">
                    <AlertCircle aria-hidden className="size-4 shrink-0" />
                    {error}
                  </p>
                )}
                <dl className="grid grid-cols-1 gap-x-4 gap-y-4 text-sm sm:grid-cols-2">
                  <Dato etiqueta={t("colCategoria")} valor={t(`categorias.${seleccionado.categoria}`)} />
                  <Dato etiqueta={t("colUbicacion")} valor={seleccionado.ubicacion} />
                  <Dato etiqueta={t("colCustodio")} valor={seleccionado.responsableNombre ?? t("sinCustodio")} />
                  <Dato etiqueta={t("colValor")} valor={dinero(seleccionado.valorEstimado)} mono />
                  <Dato etiqueta={tl("inventario.serie")} valor={seleccionado.numeroSerie} mono />
                  <Dato etiqueta={tl("inventario.marcaModelo")} valor={seleccionado.marcaModelo} />
                  <Dato etiqueta={tl("inventario.notas")} valor={seleccionado.notas} ancho />
                </dl>
              </div>

              <footer className="flex flex-wrap justify-end gap-2 border-t border-linea px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                {puedeEliminar && (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={eliminando}
                    onClick={() => void eliminar(seleccionado)}
                    className="mr-auto"
                  >
                    {eliminando ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                    {eliminando ? tl("inventario.eliminando") : t("eliminarTitulo")}
                  </Button>
                )}
                <Button asChild variant="outline">
                  <Link href={`/administrativo/inventario/${seleccionado.id}`}>
                    <Eye className="size-4" />
                    {tl("inventario.verDetalle")}
                  </Link>
                </Button>
                {puedeEscribir && (
                  <Button asChild>
                    <Link href={`/administrativo/inventario/${seleccionado.id}/editar`}>
                      <PencilLine className="size-4" />
                      {tl("inventario.editar")}
                    </Link>
                  </Button>
                )}
              </footer>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

/** Foto del activo o, sin ella, el icono de su categoría: la fila siempre tiene algo que reconocer. */
function Miniatura({ activo, className }: { activo: ActivoInventario; className: string }) {
  const Icono = ICONO_CATEGORIA[activo.categoria] ?? Package;

  return activo.fotoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={activo.fotoUrl} alt="" className={`${className} shrink-0 border border-linea object-cover`} />
  ) : (
    <span className={`${className} flex shrink-0 items-center justify-center bg-muted text-tinta-2`}>
      <Icono aria-hidden className="size-4" />
    </span>
  );
}

function Dato({ etiqueta, valor, mono = false, ancho = false }: { etiqueta: string; valor: string | null; mono?: boolean; ancho?: boolean }) {
  return (
    <div className={ancho ? "sm:col-span-2" : undefined}>
      <dt className="text-meta">{etiqueta}</dt>
      <dd className={mono ? "font-mono font-medium" : "font-medium"}>{valor || "—"}</dd>
    </div>
  );
}
