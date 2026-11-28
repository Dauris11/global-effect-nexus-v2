"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { Input } from "@/components/ui/input";
import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/** Un chip filtra por UN parámetro de la URL; chips de parámetros distintos se pueden combinar. */
export type ChipEstado = { value: string; label: string; count?: number; param?: string };

/** Un selector de «Más filtros» (universidad, período, orden…). Escribe en la URL al cambiar. */
export type SelectorFiltro = {
  param: string;
  label: string;
  /** Texto de «sin filtro» (p. ej. «Todas las universidades»). */
  todos: string;
  opciones: readonly { value: string; label: string }[];
};

const RETARDO_BUSQUEDA_MS = 250;

/**
 * Barra de filtros en vivo (docs/ux-rules.md §4): buscador, chips de estado con conteo
 * («Activos 6») y «Más filtros» en un popover. Todo cambia al instante —la búsqueda con
 * 250 ms de retardo— y vive en la URL, así que un enlace filtrado se comparte. No hay
 * botón «Aplicar». Debe ir dentro de un `<Suspense>` (usa `useSearchParams`).
 *
 * El conteo de cada chip lo calcula quien llama (es dato de servidor); aquí solo se pinta.
 */
export function FilterBar({
  chips,
  totalChips,
  chipParam = "estado",
  searchParam = "q",
  placeholder,
  selectores,
  moreFilters,
  porDefecto,
  className,
}: {
  chips?: readonly ChipEstado[];
  /** Número que lleva el chip «Todos» (el total sin filtrar). */
  totalChips?: number;
  /** Parámetro de los chips que no traen el suyo. */
  chipParam?: string;
  searchParam?: string;
  placeholder?: string;
  /** Selectores del popover «Más filtros»; el número del botón sale de cuántos están puestos. */
  selectores?: readonly SelectorFiltro[];
  /** Contenido libre adicional del popover; debe escribir en la URL por su cuenta. */
  moreFilters?: React.ReactNode;
  /**
   * Valor del chip que rige cuando la URL no trae ninguno (p. ej. «Por atender» en una bandeja).
   * Con él NO se pinta «Todos»: el estado sin parámetro ya es ese chip, y dos «por defecto» confundirían.
   */
  porDefecto?: string;
  className?: string;
}) {
  const t = useTranslations("appUi");
  const router = useRouter();
  const pathname = usePathname();
  const parametros = useSearchParams();
  const [texto, setTexto] = useState(parametros.get(searchParam) ?? "");
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);
  const paramDe = (c: ChipEstado) => c.param ?? chipParam;
  const paramsChips = [...new Set((chips ?? []).map(paramDe))];
  const hayChipActivo = paramsChips.some((p) => parametros.get(p));
  const moreActive = (selectores ?? []).filter((x) => parametros.get(x.param)).length;

  const escribir = (clave: string, valor: string, quitar: readonly string[] = []) => {
    const nuevos = new URLSearchParams(parametros.toString());

    for (const q of quitar) nuevos.delete(q);
    if (valor) nuevos.set(clave, valor);
    else nuevos.delete(clave);
    // Cambiar un filtro vuelve a la primera página.
    nuevos.delete("pagina");
    router.replace(`${pathname}${nuevos.size ? `?${nuevos}` : ""}`, { scroll: false });
  };

  // Búsqueda con retardo: se escribe en la URL 250 ms después de la última tecla.
  useEffect(() => {
    if (texto === (parametros.get(searchParam) ?? "")) return;

    const espera = setTimeout(() => escribir(searchParam, texto.trim()), RETARDO_BUSQUEDA_MS);

    return () => clearTimeout(espera);
    // `escribir` cambia con cada render y no debe reiniciar el temporizador.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);

  useEffect(() => {
    if (!abierto) return;

    const fuera = (e: MouseEvent) => {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false);
    };
    const escape = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);

    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", escape);

    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", escape);
    };
  }, [abierto]);

  // Un solo selector no justifica un panel: se pinta en línea junto al buscador («Tipo: Todos»).
  // Con 2 o más, o con contenido libre, sigue el panel «Más filtros».
  const enLinea = selectores?.length === 1 && !moreFilters ? selectores[0] : null;
  const hayFiltros = Boolean(texto || hayChipActivo || moreActive > 0);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1 sm:max-w-sm">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-tinta-3" />
          <Input
            type="search"
            aria-label={t("filterBar.searchLabel")}
            placeholder={placeholder ?? t("filterBar.search")}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className="h-9 pl-10 text-sm"
          />
        </div>

        {enLinea && (
          <label className="text-label inline-flex items-center gap-2">
            <span className="text-tinta-2">{enLinea.label}:</span>
            <select
              value={parametros.get(enLinea.param) ?? ""}
              onChange={(e) => escribir(enLinea.param, e.target.value)}
              className="text-body h-9 max-w-48 rounded-control border border-linea-fuerte bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">{enLinea.todos}</option>
              {enLinea.opciones.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        )}

        {!enLinea && (selectores?.length || moreFilters) && (
          <div ref={contenedor} className="relative">
            <button
              type="button"
              aria-expanded={abierto}
              onClick={() => setAbierto((v) => !v)}
              className="text-label inline-flex h-9 items-center gap-2 rounded-control border border-linea-fuerte bg-background px-3 transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <SlidersHorizontal aria-hidden className="size-4" />
              {t("filterBar.moreFilters")}
              {moreActive > 0 && <span className="rounded-full bg-tinta px-1.5 text-xs text-background tabular-nums">{moreActive}</span>}
            </button>
            {abierto && (
              <div className="absolute top-11 left-0 z-40 w-72 space-y-3 rounded-card border border-linea bg-popover p-4 shadow-elevada">
                {selectores?.map((x) => (
                  <label key={x.param} className="text-label block space-y-1.5">
                    {x.label}
                    <select
                      value={parametros.get(x.param) ?? ""}
                      onChange={(e) => escribir(x.param, e.target.value)}
                      className="text-body h-9 w-full rounded-control border border-linea-fuerte bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">{x.todos}</option>
                      {x.opciones.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </label>
                ))}
                {moreFilters}
              </div>
            )}
          </div>
        )}

        {hayFiltros && (
          <button
            type="button"
            onClick={() => {
              setTexto("");
              router.replace(pathname, { scroll: false });
            }}
            className="text-label inline-flex h-9 items-center gap-1.5 rounded-control px-2 text-marca-700 hover:underline"
          >
            <X aria-hidden className="size-4" />
            {t("filterBar.clear")}
          </button>
        )}
      </div>

      {chips && chips.length > 0 && (
        <div role="group" // Una sola línea siempre: si no caben, se desplazan y el borde se difumina para
          // avisar de que hay más. Partirlos en dos filas movía toda la lista hacia abajo.
          className="sin-barra -mx-6 flex flex-nowrap gap-2 overflow-x-auto px-6 pr-10 [mask-image:linear-gradient(to_right,#000_calc(100%-2.5rem),transparent)] md:mx-0 md:px-0 md:pr-10">
          {[...(porDefecto === undefined ? [{ value: "", label: t("filterBar.all"), count: totalChips, param: undefined as string | undefined }] : []), ...chips].map((c) => {
            const esteActivo =
              c.value === ""
                ? !hayChipActivo
                : parametros.get(paramDe(c)) === c.value || (c.value === porDefecto && !parametros.get(paramDe(c)));

            return (
              <button
                key={`${paramDe(c)}-${c.value || "todos"}`}
                type="button"
                aria-pressed={esteActivo}
                data-chip
                data-active={esteActivo ? "" : undefined}
                // «Todos» quita todos los chips; un chip activo vuelve a apagarse al pulsarlo.
                onClick={() => (c.value === "" ? escribir(paramsChips[0] ?? chipParam, "", paramsChips) : escribir(paramDe(c), esteActivo ? "" : c.value))}
                className={cn(
                  "inline-flex h-[30px] shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  esteActivo ? "border-tinta bg-tinta text-background" : "border-linea-fuerte bg-background text-tinta-2 hover:border-tinta hover:text-tinta",
                )}
              >
                {c.label}
                {c.count !== undefined && <span className="text-xs font-semibold tabular-nums opacity-70">{c.count}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
