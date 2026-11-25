"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";

import { cn } from "@/lib/utils";

/** Minúsculas y sin acentos, para que «nómina» y «NOMINA» se encuentren. */
export function normalizarBusqueda(texto: string): string {
  return texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

export type EstadoOpcion = { activa: boolean };

type Props<T> = {
  opciones: readonly T[];
  /** Identificador único de la opción (lo que viaja en `valores`). */
  obtenerValor: (opcion: T) => string;
  /** Todo lo que debe poder encontrarse: nombre, código, módulo… */
  textoBusqueda: (opcion: T) => string;
  /** Valores elegidos (selección múltiple). */
  valores: readonly string[];
  onCambiar: (valores: string[]) => void;
  renderOpcion: (opcion: T, estado: EstadoOpcion) => React.ReactNode;
  /** Contenido de cada chip elegido; el botón de quitar lo pone el componente. */
  renderChip: (opcion: T) => React.ReactNode;
  /** aria-label del botón de quitar de cada chip. */
  etiquetaQuitar: (opcion: T) => string;
  etiquetaBusqueda: string;
  placeholder: string;
  textoSinResultados: string;
  /** Aviso cuando hay más resultados de los que caben; recibe cuántos faltan. */
  textoMas: (restantes: number) => string;
  /** Texto para lectores de pantalla con el número de coincidencias. */
  anunciarResultados: (n: number) => string;
  maxResultados?: number;
  className?: string;
};

/**
 * Selector buscable de selección múltiple (patrón combobox de ARIA 1.2).
 *
 * Cerrado ocupa solo el campo y los chips de lo elegido, aunque haya cien
 * opciones; abierto muestra únicamente las coincidencias (máx. `maxResultados`).
 * Teclado: flechas mueven la opción activa (y abren la lista), Enter la elige,
 * Escape cierra la lista. Dentro de un `Dialog`, `DialogContent` ya ignora
 * Escape si el campo tiene `aria-expanded="true"`, así que no cierra el diálogo.
 *
 * La lista va en el flujo normal y no flotante: dentro de un diálogo con
 * desplazamiento un popover se recorta y se pelea con el scroll.
 */
export function ComboboxBuscador<T>({
  opciones,
  obtenerValor,
  textoBusqueda,
  valores,
  onCambiar,
  renderOpcion,
  renderChip,
  etiquetaQuitar,
  etiquetaBusqueda,
  placeholder,
  textoSinResultados,
  textoMas,
  anunciarResultados,
  maxResultados = 8,
  className,
}: Props<T>) {
  const id = useId();
  const idLista = `${id}-lista`;
  const entrada = useRef<HTMLInputElement>(null);
  const [consulta, setConsulta] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [activa, setActiva] = useState(0);

  const elegidos = useMemo(() => new Set(valores), [valores]);
  const coincidencias = useMemo(() => {
    const q = normalizarBusqueda(consulta);
    const palabras = q.split(/\s+/).filter(Boolean);
    return opciones.filter(
      (o) =>
        !elegidos.has(obtenerValor(o)) &&
        palabras.every((p) => normalizarBusqueda(textoBusqueda(o)).includes(p)),
    );
  }, [opciones, consulta, elegidos, obtenerValor, textoBusqueda]);
  const visibles = coincidencias.slice(0, maxResultados);
  const indiceActivo = Math.min(activa, Math.max(visibles.length - 1, 0));

  const elegir = (opcion: T) => {
    onCambiar([...valores, obtenerValor(opcion)]);
    setConsulta("");
    setActiva(0);
    setAbierto(false);
    entrada.current?.focus();
  };
  const quitar = (valor: string) => onCambiar(valores.filter((v) => v !== valor));

  const alTeclear = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!abierto) {
        setAbierto(true);
        return;
      }
      const n = visibles.length;
      if (n) setActiva((indiceActivo + (e.key === "ArrowDown" ? 1 : n - 1)) % n);
    } else if (e.key === "Enter") {
      // Con la lista cerrada, Enter no debe enviar el formulario que lo contiene.
      e.preventDefault();
      if (abierto && visibles[indiceActivo]) elegir(visibles[indiceActivo]);
    } else if (e.key === "Escape" && abierto) {
      setAbierto(false);
    }
  };

  const porValor = new Map(opciones.map((o) => [obtenerValor(o), o]));
  const idOpcion = (i: number) => `${id}-op-${i}`;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-tinta-3" />
        <input
          ref={entrada}
          type="text"
          role="combobox"
          aria-label={etiquetaBusqueda}
          aria-expanded={abierto}
          aria-controls={idLista}
          aria-autocomplete="list"
          aria-activedescendant={abierto && visibles.length ? idOpcion(indiceActivo) : undefined}
          autoComplete="off"
          placeholder={placeholder}
          value={consulta}
          onChange={(e) => {
            setConsulta(e.target.value);
            setActiva(0);
            setAbierto(true);
          }}
          onClick={() => setAbierto(true)}
          onKeyDown={alTeclear}
          onBlur={() => setAbierto(false)}
          className="border-linea-fuerte placeholder:text-tinta-3 flex h-11 w-full rounded-control border bg-background pr-4 pl-10 text-base text-tinta outline-none focus-visible:border-tinta focus-visible:ring-1 focus-visible:ring-tinta sm:text-[15px]"
        />
      </div>

      <span role="status" aria-live="polite" className="sr-only">
        {abierto ? anunciarResultados(coincidencias.length) : ""}
      </span>

      {abierto && (
        <div className="rounded-card border border-linea bg-background shadow-card">
          <ul id={idLista} role="listbox" aria-label={etiquetaBusqueda} className="max-h-72 overflow-y-auto p-1.5">
            {visibles.map((o, i) => (
              <li
                key={obtenerValor(o)}
                id={idOpcion(i)}
                role="option"
                aria-selected={i === indiceActivo}
                // mousedown y no click: el click llega tras el blur del campo, que ya cerró la lista.
                onMouseDown={(e) => {
                  e.preventDefault();
                  elegir(o);
                }}
                onMouseMove={() => setActiva(i)}
                className={cn(
                  "min-h-11 cursor-pointer rounded-control px-3 py-2 text-sm",
                  i === indiceActivo && "bg-muted",
                )}
              >
                {renderOpcion(o, { activa: i === indiceActivo })}
              </li>
            ))}
            {visibles.length === 0 && <li className="texto-meta px-3 py-3" role="presentation">{textoSinResultados}</li>}
          </ul>
          {coincidencias.length > visibles.length && (
            <p className="texto-meta border-t border-linea px-4 py-2">{textoMas(coincidencias.length - visibles.length)}</p>
          )}
        </div>
      )}

      {valores.length > 0 && (
        <ul className="space-y-2">
          {valores.map((v) => {
            const o = porValor.get(v);
            if (!o) return null;
            return (
              <li key={v} className="flex items-start justify-between gap-2 rounded-control border border-linea px-3 py-2 text-sm">
                <div className="min-w-0">{renderChip(o)}</div>
                <button
                  type="button"
                  aria-label={etiquetaQuitar(o)}
                  onClick={() => quitar(v)}
                  className="-my-1 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-full text-tinta-2 hover:bg-muted hover:text-tinta focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <X className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
