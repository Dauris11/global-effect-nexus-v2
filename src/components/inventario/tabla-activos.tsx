"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  Armchair,
  Car,
  CheckCircle2,
  ChevronRight,
  Clock,
  Eye,
  Laptop,
  Loader2,
  Package,
  Plus,
  QrCode,
  Refrigerator,
  Search,
  Trash2,
  Wrench,
  XCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Link, useRouter } from "@/i18n/navigation";
import type { ActivoInventario, CategoriaActivo, EstadoActivo } from "@/lib/inventario";
import { cn } from "@/lib/utils";
import { eliminarActivoAction } from "@/server/inventario/acciones";

interface TablaActivosProps {
  activos: ActivoInventario[];
  puedeEscribir: boolean;
  puedeAuditar: boolean;
  puedeEliminar?: boolean;
}

const CATEGORIA_ICONOS: Record<CategoriaActivo, React.ComponentType<{ className?: string }>> = {
  herramientas: Wrench,
  tecnologia: Laptop,
  mobiliario: Armchair,
  electrodomesticos: Refrigerator,
  vehiculos: Car,
  otros: Package,
};

export function TablaActivos({
  activos,
  puedeEscribir,
  puedeAuditar,
  puedeEliminar = false,
}: TablaActivosProps) {
  const t = useTranslations("admin.inventario");
  const router = useRouter();

  const [busqueda, setBusqueda] = useState("");
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string>("todas");
  const [estadoSeleccionado] = useState<string>("todos");
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);

  const filtrados = useMemo(() => {
    return activos.filter((a) => {
      const matchBusqueda =
        !busqueda ||
        a.codigo.toLowerCase().includes(busqueda.toLowerCase()) ||
        a.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        a.ubicacion.toLowerCase().includes(busqueda.toLowerCase()) ||
        (a.numeroSerie && a.numeroSerie.toLowerCase().includes(busqueda.toLowerCase())) ||
        (a.responsableNombre && a.responsableNombre.toLowerCase().includes(busqueda.toLowerCase()));

      const matchCategoria =
        categoriaSeleccionada === "todas" || a.categoria === categoriaSeleccionada;

      const matchEstado =
        estadoSeleccionado === "todos" || a.estado === estadoSeleccionado;

      return matchBusqueda && matchCategoria && matchEstado;
    });
  }, [activos, busqueda, categoriaSeleccionada, estadoSeleccionado]);

  const formatoMoneda = (val: number | null) => {
    if (val === null || val === undefined) return "—";
    return new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency: "DOP",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const manejarEliminar = async (activo: ActivoInventario) => {
    const confirmado = window.confirm(
      t("confirmarEliminar", { code: activo.codigo, name: activo.nombre })
    );
    if (!confirmado) return;

    try {
      setErrorEliminar(null);
      setEliminandoId(activo.id);
      await eliminarActivoAction(activo.id);
      router.refresh();
    } catch (err) {
      setErrorEliminar(err instanceof Error ? err.message : t("errorEliminar"));
    } finally {
      setEliminandoId(null);
    }
  };

  const renderEstadoBadge = (estado: EstadoActivo) => {
    switch (estado) {
      case "operativo":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-transparent bg-[#1E9E6A]/10 px-2 py-0.5 text-xs font-semibold text-[#1E9E6A]">
            <CheckCircle2 className="size-3.5" />
            <span>{t("estados.operativo")}</span>
          </span>
        );
      case "mantenimiento":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-marca-50 px-2 py-0.5 text-xs font-semibold text-marca-700">
            <Clock className="size-3.5" />
            <span>{t("estados.mantenimiento")}</span>
          </span>
        );
      case "prestado":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-tinta-2">
            <Package className="size-3.5" />
            <span>{t("estados.prestado")}</span>
          </span>
        );
      case "baja":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-transparent bg-[#B4342B]/10 px-2 py-0.5 text-xs font-semibold text-[#B4342B]">
            <XCircle className="size-3.5" />
            <span>{t("estados.baja")}</span>
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {errorEliminar && (
        <div className="flex items-center gap-2 rounded-xl border border-linea-fuerte bg-muted p-3 text-xs font-semibold text-tinta">
          <AlertCircle className="size-4 shrink-0 text-tinta" />
          <span>{errorEliminar}</span>
        </div>
      )}

      {/* Barra de Búsqueda y Botones de Acción */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tinta-3" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder={t("buscarPlaceholder")}
            className="w-full rounded-xl border border-linea bg-background py-2 pr-3 pl-9 text-xs outline-none transition-colors focus:border-marca-500"
          />
        </div>

        <div className="flex items-center gap-2">
          {puedeAuditar && (
            <Link
              href="/administrativo/inventario/escanear"
              className="flex items-center gap-1.5 rounded-xl border border-marca-500/30 bg-marca-50 px-3 py-2 text-xs font-bold text-marca-700 transition-colors hover:bg-marca-100"
            >
              <QrCode className="size-4" />
              <span>{t("escanearQr")}</span>
            </Link>
          )}

          {puedeEscribir && (
            <Link
              href="/administrativo/inventario/nuevo"
              className="flex items-center gap-1.5 rounded-xl bg-marca-600 px-3 py-2 text-xs font-bold text-white shadow-xs transition-colors hover:bg-marca-700"
            >
              <Plus className="size-4" />
              <span>{t("nuevoActivo")}</span>
            </Link>
          )}
        </div>
      </div>

      {/* Píldoras de Filtro Rápido (Categorías) */}
      <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <button
          type="button"
          onClick={() => setCategoriaSeleccionada("todas")}
          className={cn(
            "rounded-lg px-3 py-1 font-semibold transition-colors",
            categoriaSeleccionada === "todas"
              ? "bg-marca-600 text-white"
              : "bg-muted text-tinta-2 hover:text-tinta"
          )}
        >
          {t("todasCategorias", { count: activos.length })}
        </button>
        {(["herramientas", "tecnologia", "mobiliario", "electrodomesticos", "vehiculos", "otros"] as const).map(
          (cat) => {
            const Icono = CATEGORIA_ICONOS[cat];
            const cant = activos.filter((a) => a.categoria === cat).length;
            if (cant === 0 && categoriaSeleccionada !== cat) return null;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoriaSeleccionada(cat)}
                className={cn(
                  "flex items-center gap-1 rounded-lg px-2.5 py-1 font-semibold transition-colors",
                  categoriaSeleccionada === cat
                    ? "bg-marca-600 text-white"
                    : "bg-muted text-tinta-2 hover:text-tinta"
                )}
              >
                <Icono className="size-3.5" />
                <span>{t(`categorias.${cat}`)}</span>
                <span className="text-[10px] opacity-75">({cant})</span>
              </button>
            );
          }
        )}
      </div>

      {/* Vista de Escritorio: Tabla Normalizada */}
      <div className="hidden rounded-2xl border border-linea bg-card shadow-xs md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-linea bg-muted/40 font-semibold text-tinta-2 uppercase">
              <tr>
                <th className="py-3 pr-3 pl-4">{t("colCodigoActivo")}</th>
                <th className="px-3 py-3">{t("colCategoria")}</th>
                <th className="px-3 py-3">{t("colUbicacion")}</th>
                <th className="px-3 py-3">{t("colCustodio")}</th>
                <th className="px-3 py-3">{t("colEstado")}</th>
                <th className="px-3 py-3 text-right">{t("colValor")}</th>
                <th className="py-3 pr-4 pl-3 text-center">{t("colAcciones")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-linea">
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-tinta-3">
                    {t("vacioFiltro")}
                  </td>
                </tr>
              ) : (
                filtrados.map((activo) => {
                  const IconoCat = CATEGORIA_ICONOS[activo.categoria] ?? Package;
                  return (
                    <tr key={activo.id} className="transition-colors hover:bg-muted/30">
                      <td className="py-3 pr-3 pl-4">
                        <div className="flex items-center gap-3">
                          {activo.fotoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={activo.fotoUrl}
                              alt={activo.nombre}
                              className="size-10 rounded-lg border border-linea object-cover"
                            />
                          ) : (
                            <div className="flex size-10 items-center justify-center rounded-lg bg-marca-50 text-marca-600">
                              <IconoCat className="size-5" />
                            </div>
                          )}
                          <div>
                            <p className="font-mono font-bold tracking-wide text-marca-700">
                              {activo.codigo}
                            </p>
                            <p className="line-clamp-1 font-semibold text-tinta">{activo.nombre}</p>
                            {activo.numeroSerie && (
                              <p className="text-[10px] text-tinta-3">S/N: {activo.numeroSerie}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-tinta">
                          <IconoCat className="size-3 text-tinta-2" />
                          <span>{t(`categorias.${activo.categoria}`)}</span>
                        </span>
                      </td>
                      <td className="px-3 py-3 text-tinta-2 font-medium">{activo.ubicacion}</td>
                      <td className="px-3 py-3">
                        {activo.responsableNombre ? (
                          <span className="font-medium text-tinta">{activo.responsableNombre}</span>
                        ) : (
                          <span className="text-tinta-3 italic">{t("sinCustodio")}</span>
                        )}
                      </td>
                      <td className="px-3 py-3">{renderEstadoBadge(activo.estado)}</td>
                      <td className="px-3 py-3 text-right font-mono font-semibold text-tinta">
                        {formatoMoneda(activo.valorEstimado)}
                      </td>
                      <td className="py-3 pr-4 pl-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Link
                            href={`/administrativo/inventario/${activo.id}`}
                            className="inline-flex size-8 items-center justify-center rounded-lg border border-linea bg-background text-tinta-2 transition-colors hover:bg-muted hover:text-tinta"
                            title={t("verFichaTitulo")}
                          >
                            <Eye className="size-4" />
                          </Link>
                          {puedeEscribir && (
                            <Link
                              href={`/administrativo/inventario/${activo.id}/editar`}
                              className="inline-flex size-8 items-center justify-center rounded-lg border border-linea bg-background text-tinta-2 transition-colors hover:bg-muted hover:text-tinta"
                              title={t("editarFichaTitulo")}
                            >
                              <Wrench className="size-4" />
                            </Link>
                          )}
                          {puedeEliminar && (
                            <button
                              type="button"
                              onClick={() => void manejarEliminar(activo)}
                              disabled={eliminandoId === activo.id}
                              className="inline-flex size-8 items-center justify-center rounded-lg border border-linea bg-background text-tinta-2 transition-colors hover:bg-muted hover:text-tinta disabled:opacity-50"
                              title={t("eliminarTitulo")}
                            >
                              {eliminandoId === activo.id ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <Trash2 className="size-4" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Vista Móvil: Tarjetas Táctiles Nativas */}
      <div className="flex flex-col gap-3 md:hidden">
        {filtrados.length === 0 ? (
          <div className="rounded-2xl border border-linea bg-card p-8 text-center text-xs text-tinta-3">
            {t("vacioMovil")}
          </div>
        ) : (
          filtrados.map((activo) => {
            const IconoCat = CATEGORIA_ICONOS[activo.categoria] ?? Package;
            return (
              <div
                key={activo.id}
                className="flex flex-col rounded-2xl border border-linea bg-card p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {activo.fotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={activo.fotoUrl}
                        alt={activo.nombre}
                        className="size-12 rounded-xl border border-linea object-cover"
                      />
                    ) : (
                      <div className="flex size-12 items-center justify-center rounded-xl bg-marca-50 text-marca-600">
                        <IconoCat className="size-6" />
                      </div>
                    )}
                    <div>
                      <p className="font-mono text-xs font-bold text-marca-600">{activo.codigo}</p>
                      <h4 className="line-clamp-1 text-sm font-bold text-tinta">{activo.nombre}</h4>
                      <p className="text-[11px] text-tinta-2">{activo.ubicacion}</p>
                    </div>
                  </div>
                  {renderEstadoBadge(activo.estado)}
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-linea pt-2 text-xs">
                  <div>
                    <span className="text-[10px] text-tinta-3 uppercase">{t("movilCustodio")}</span>
                    <p className="font-medium text-tinta">
                      {activo.responsableNombre ?? t("sinAsignar")}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-tinta-3 uppercase">{t("movilValor")}</span>
                    <p className="font-mono font-bold text-tinta">
                      {formatoMoneda(activo.valorEstimado)}
                    </p>
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between gap-2">
                  {puedeEliminar ? (
                    <button
                      type="button"
                      onClick={() => void manejarEliminar(activo)}
                      disabled={eliminandoId === activo.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-linea px-2.5 py-1 text-xs font-medium text-tinta-2 transition-colors hover:bg-muted hover:text-tinta disabled:opacity-50"
                    >
                      {eliminandoId === activo.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="size-3.5" />
                      )}
                      <span>{t("eliminarTitulo")}</span>
                    </button>
                  ) : (
                    <span />
                  )}
                  <Link
                    href={`/administrativo/inventario/${activo.id}`}
                    className="flex items-center text-xs font-semibold text-marca-600"
                  >
                    <span>{t("movilVerFicha")}</span>
                    <ChevronRight className="size-4" />
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
