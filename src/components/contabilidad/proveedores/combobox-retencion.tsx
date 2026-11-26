"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { normalizarBusqueda } from "@/components/ui/combobox-buscador";
import {
  retencionPorCodigo,
  retencionesParaProveedor,
  type ImpuestoRetencion,
  type ReglaRetencion,
} from "@/lib/contabilidad/retenciones-dgii";
import { cn } from "@/lib/utils";

type Props = {
  id: string;
  name: string;
  impuesto: ImpuestoRetencion;
  tipoProveedor?: "fisica" | "juridica";
  valor: string;
  onCambiar: (codigo: string) => void;
};

/**
 * Combobox buscable de selección única para elegir la retención de ISR o ITBIS
 * según el catálogo oficial DGII (`Retenciones-ISR-ITBIS.pdf`). Prioriza las
 * retenciones aplicables al tipo de proveedor elegido.
 */
export function ComboboxRetencion({
  id,
  name,
  impuesto,
  tipoProveedor,
  valor,
  onCambiar,
}: Props) {
  const locale = useLocale();
  const t = useTranslations("contab.facturaForm");
  const listId = useId();
  const contenedor = useRef<HTMLDivElement>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [indice, setIndice] = useState(0);

  const opciones = useMemo(
    () => retencionesParaProveedor(impuesto, tipoProveedor),
    [impuesto, tipoProveedor],
  );
  const seleccionada = retencionPorCodigo(valor);
  const textoNombre = (r: ReglaRetencion) => (locale === "en" ? r.nombre.en : r.nombre.es);

  const filtradas = useMemo(() => {
    const q = normalizarBusqueda(busqueda);
    if (!q) return opciones;
    const palabras = q.split(/\s+/).filter(Boolean);
    return opciones.filter((r) => {
      const texto = normalizarBusqueda(
        `${r.nombre.es} ${r.nombre.en} ${r.etiquetaTasa} ${r.baseLegal} ${r.codigo}`,
      );
      return palabras.every((p) => texto.includes(p));
    });
  }, [opciones, busqueda]);

  const indiceActivo = Math.min(indice, Math.max(filtradas.length - 1, 0));

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (contenedor.current && !contenedor.current.contains(e.target as Node)) {
        setAbierto(false);
        setBusqueda("");
      }
    };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [abierto]);

  const elegir = (codigo: string) => {
    onCambiar(codigo);
    setAbierto(false);
    setBusqueda("");
    setIndice(0);
  };

  const alTeclear = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!abierto) {
        setAbierto(true);
        return;
      }
      if (filtradas.length > 0) {
        setIndice((indiceActivo + (e.key === "ArrowDown" ? 1 : filtradas.length - 1)) % filtradas.length);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (abierto && filtradas[indiceActivo]) elegir(filtradas[indiceActivo].codigo);
    } else if (e.key === "Escape") {
      setAbierto(false);
      setBusqueda("");
    }
  };

  const esRecomendada = (r: ReglaRetencion) =>
    !tipoProveedor || r.aplicaA === tipoProveedor || r.aplicaA === "ambos";

  return (
    <div ref={contenedor} className="relative">
      <input type="hidden" name={name} value={valor} />
      <div className="relative flex items-center">
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={abierto}
          aria-controls={listId}
          onClick={() => {
            const prox = !abierto;
            setAbierto(prox);
            if (prox) setTimeout(() => entrada.current?.focus(), 0);
          }}
          className={cn(
            "flex min-h-10 w-full items-center justify-between gap-2 rounded-control border border-linea bg-background px-3 py-2 text-left text-sm text-tinta transition-colors hover:border-marca-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca",
            seleccionada && "pr-14",
          )}
        >
          <span className="min-w-0 flex-1 truncate">
            {seleccionada ? (
              <span className="flex items-center gap-2">
                <span className="shrink-0 rounded bg-marca-50 px-1.5 py-0.5 font-mono text-xs font-semibold text-marca-700">
                  {seleccionada.etiquetaTasa}
                </span>
                <span className="truncate">{textoNombre(seleccionada)}</span>
              </span>
            ) : (
              <span className="text-tinta-2">{t("sinRetencion")}</span>
            )}
          </span>
          <ChevronDown className="size-4 shrink-0 text-tinta-2" />
        </button>

        {seleccionada && (
          <button
            type="button"
            onClick={() => elegir("")}
            aria-label={t("sinRetencion")}
            title={t("sinRetencion")}
            className="absolute right-8 rounded p-1 text-tinta-2 hover:bg-superficie hover:text-tinta"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {abierto && (
        <div
          id={listId}
          role="listbox"
          className="mt-1.5 rounded-control border border-linea bg-background shadow-md"
        >
          <div className="relative border-b border-linea p-2">
            <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-tinta-2" />
            <input
              ref={entrada}
              type="text"
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setIndice(0);
              }}
              onKeyDown={alTeclear}
              placeholder={t("buscarRetencion")}
              className="h-9 w-full rounded-control border border-linea bg-superficie/40 pl-8 pr-3 text-sm text-tinta placeholder:text-tinta-3 focus:border-marca focus:outline-none"
            />
          </div>

          <div className="max-h-64 overflow-y-auto p-1">
            <button
              type="button"
              role="option"
              aria-selected={valor === ""}
              onClick={() => elegir("")}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-control px-2.5 py-2 text-left text-sm transition-colors hover:bg-superficie",
                valor === "" && "bg-marca-50/70 font-medium text-marca-800",
              )}
            >
              <span>{t("sinRetencion")}</span>
              {valor === "" && <Check className="size-4 shrink-0 text-marca-600" />}
            </button>

            {filtradas.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-tinta-2">
                {t("sinResultadosRetencion")}
              </p>
            ) : (
              filtradas.map((r, i) => {
                const elegida = valor === r.codigo;
                const recomendada = esRecomendada(r);
                return (
                  <button
                    key={r.codigo}
                    type="button"
                    role="option"
                    aria-selected={elegida}
                    onMouseEnter={() => setIndice(i)}
                    onClick={() => elegir(r.codigo)}
                    className={cn(
                      "flex w-full items-start justify-between gap-2 rounded-control px-2.5 py-2 text-left text-sm transition-colors",
                      i === indiceActivo && "bg-superficie",
                      elegida && "bg-marca-50/70",
                    )}
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded bg-marca-50 px-1.5 py-0.5 font-mono text-xs font-semibold text-marca-700">
                          {r.etiquetaTasa}
                        </span>
                        <span className="font-medium text-tinta">{textoNombre(r)}</span>
                      </div>
                      <p className="text-xs text-tinta-2">
                        {r.baseLegal}
                        {recomendada && tipoProveedor ? ` · ${t("recomendadaProveedor")}` : ""}
                      </p>
                    </div>
                    {elegida && <Check className="mt-0.5 size-4 shrink-0 text-marca-600" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
