"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { Input } from "@/components/ui/input";
import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export type ChipEstado = { value: string; label: string; count?: number };

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
  chipParam = "estado",
  searchParam = "q",
  placeholder,
  moreFilters,
  moreActive = 0,
  className,
}: {
  chips?: readonly ChipEstado[];
  chipParam?: string;
  searchParam?: string;
  placeholder?: string;
  /** Contenido del popover «Más filtros» (selects, rangos…); debe escribir en la URL por su cuenta. */
  moreFilters?: React.ReactNode;
  /** Cuántos filtros del popover están puestos, para el número en el botón. */
  moreActive?: number;
  className?: string;
}) {
  const t = useTranslations("appUi");
  const router = useRouter();
  const pathname = usePathname();
  const parametros = useSearchParams();
  const [texto, setTexto] = useState(parametros.get(searchParam) ?? "");
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);
  const activo = parametros.get(chipParam) ?? "";

  const escribir = (clave: string, valor: string) => {
    const nuevos = new URLSearchParams(parametros.toString());

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

  const hayFiltros = Boolean(texto || activo || moreActive > 0);

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

        {moreFilters && (
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
            {abierto && <div className="absolute top-11 left-0 z-40 w-72 space-y-3 rounded-card border border-linea bg-popover p-4 shadow-elevada">{moreFilters}</div>}
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
        <div role="group" className="sin-barra -mx-6 flex gap-2 overflow-x-auto px-6 lg:-mx-8 lg:px-8">
          {[{ value: "", label: t("filterBar.all"), count: undefined }, ...chips].map((c) => {
            const esteActivo = c.value === activo;

            return (
              <button
                key={c.value || "todos"}
                type="button"
                aria-pressed={esteActivo}
                onClick={() => escribir(chipParam, c.value)}
                className={cn(
                  "text-label inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  esteActivo ? "border-tinta bg-tinta text-background" : "border-linea-fuerte bg-background text-tinta-2 hover:border-tinta hover:text-tinta",
                )}
              >
                {c.label}
                {c.count !== undefined && <span className={cn("tabular-nums", esteActivo ? "text-background/80" : "text-tinta-3")}>{c.count}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
