"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

import { cn } from "@/lib/utils";

export type OpcionBuscable = {
  value: string;
  label: string;
};

function normalizarBusqueda(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Desplegable con buscador integrado para listas largas (p. ej. tipos de gasto
 * o bancos de República Dominicana). Envía el valor en un `<input hidden>` para
 * integrarse directamente con Server Actions y formularios nativos.
 */
export function SelectBuscable({
  id,
  name,
  opciones,
  value,
  onChange,
  placeholder,
  placeholderBuscar,
  sinResultados,
  required,
  className,
}: {
  id?: string;
  name: string;
  opciones: readonly OpcionBuscable[];
  value: string;
  onChange: (nuevoValor: string) => void;
  placeholder: string;
  placeholderBuscar: string;
  sinResultados: string;
  required?: boolean;
  className?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const contenedorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const seleccionada = useMemo(
    () => opciones.find((o) => o.value === value) ?? null,
    [opciones, value],
  );

  const filtradas = useMemo(() => {
    const q = normalizarBusqueda(busqueda);
    if (!q) return opciones;
    return opciones.filter((o) => normalizarBusqueda(o.label).includes(q));
  }, [opciones, busqueda]);

  useEffect(() => {
    if (!abierto) return;
    inputRef.current?.focus();
    const alClickFuera = (e: MouseEvent) => {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    };
    const alTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    document.addEventListener("mousedown", alClickFuera);
    document.addEventListener("keydown", alTecla);
    return () => {
      document.removeEventListener("mousedown", alClickFuera);
      document.removeEventListener("keydown", alTecla);
    };
  }, [abierto]);

  return (
    <div ref={contenedorRef} className={cn("relative", className)}>
      {/* Input oculto (o visualmente oculto con required para validación nativa del form) */}
      <input
        type="text"
        name={name}
        value={value}
        onChange={() => {}}
        required={required}
        tabIndex={-1}
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-1/2 h-px w-px opacity-0"
      />

      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        onClick={() => {
          setAbierto((prev) => !prev);
          if (abierto) setBusqueda("");
        }}
        className={cn(
          "flex h-[38px] pointer-coarse:h-11 w-full items-center justify-between gap-2 rounded-control border border-linea-fuerte bg-background px-3 text-left text-sm text-tinta outline-none transition-colors focus-visible:border-marca-500 focus-visible:ring-[3px] focus-visible:ring-marca-100",
          !seleccionada && "text-tinta-3",
        )}
      >
        <span className="min-w-0 flex-1 truncate">
          {seleccionada ? seleccionada.label : placeholder}
        </span>
        <ChevronDown className="size-4 shrink-0 text-tinta-3" />
      </button>

      {abierto && (
        <div className="absolute z-50 mt-1.5 w-full rounded-control border border-linea-fuerte bg-background shadow-lg">
          <div className="flex items-center gap-2 border-b border-linea px-2.5 py-2">
            <Search className="size-4 shrink-0 text-tinta-3" />
            <input
              ref={inputRef}
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder={placeholderBuscar}
              className="w-full bg-transparent text-sm text-tinta outline-none placeholder:text-tinta-3"
            />
          </div>

          <ul role="listbox" className="max-h-56 overflow-y-auto py-1">
            {filtradas.length === 0 ? (
              <li className="px-3 py-2 text-xs text-tinta-3">{sinResultados}</li>
            ) : (
              filtradas.map((opcion) => {
                const activa = opcion.value === value;
                return (
                  <li key={opcion.value} role="option" aria-selected={activa}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(opcion.value);
                        setAbierto(false);
                        setBusqueda("");
                      }}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60",
                        activa && "bg-marca-500/10 font-medium text-marca-700",
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate">{opcion.label}</span>
                      {activa && <Check className="size-4 shrink-0 text-marca-600" />}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
