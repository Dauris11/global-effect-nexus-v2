"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";

import { cn } from "@/lib/utils";

type Posicion = {
  top: number;
  left: number;
  debajo: boolean;
};

/**
 * Icono de ayuda con globo flotante en portal (`document.body`).
 *
 * Va en portal y no en `position: absolute` dentro del formulario porque los
 * diálogos usan `overflow-y-auto` para desplazarse y recortarían el globo en
 * los bordes. Abre con puntero, foco de teclado o toque en móvil.
 */
export function TooltipAyuda({
  texto,
  etiqueta,
  className,
}: {
  texto: string | string[];
  etiqueta: string;
  className?: string;
}) {
  const id = useId();
  const botonRef = useRef<HTMLButtonElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [pos, setPos] = useState<Posicion | null>(null);
  const lineas = Array.isArray(texto) ? texto.filter(Boolean) : [texto];

  const calcularPosicion = useCallback(() => {
    const el = botonRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const debajo = rect.top < 120;
    // Medio ancho del globo (256px / 2) + margen mínimo de 12px contra el borde.
    const margen = 140;
    const centro = rect.left + rect.width / 2;
    const left = Math.min(Math.max(centro, margen), window.innerWidth - margen);
    setPos({
      top: debajo ? rect.bottom + 8 : rect.top - 8,
      left,
      debajo,
    });
  }, []);

  const abrir = useCallback(() => {
    calcularPosicion();
    setAbierto(true);
  }, [calcularPosicion]);

  const cerrar = useCallback(() => {
    setAbierto(false);
  }, []);

  useEffect(() => {
    if (!abierto) return;
    const alTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
    };
    const alClickFuera = (e: MouseEvent) => {
      if (botonRef.current && !botonRef.current.contains(e.target as Node)) {
        cerrar();
      }
    };
    window.addEventListener("scroll", cerrar, true);
    window.addEventListener("resize", calcularPosicion);
    window.addEventListener("keydown", alTecla);
    document.addEventListener("mousedown", alClickFuera);
    return () => {
      window.removeEventListener("scroll", cerrar, true);
      window.removeEventListener("resize", calcularPosicion);
      window.removeEventListener("keydown", alTecla);
      document.removeEventListener("mousedown", alClickFuera);
    };
  }, [abierto, calcularPosicion, cerrar]);

  if (lineas.length === 0) return null;

  return (
    <>
      <button
        ref={botonRef}
        type="button"
        aria-label={etiqueta}
        aria-describedby={abierto ? id : undefined}
        onMouseEnter={abrir}
        onMouseLeave={cerrar}
        onFocus={abrir}
        onBlur={cerrar}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (abierto) cerrar();
          else abrir();
        }}
        className={cn(
          "inline-flex size-5 shrink-0 items-center justify-center rounded-full text-tinta-3 transition-colors hover:bg-muted hover:text-tinta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-500/30",
          className,
        )}
      >
        <Info className="size-3.5" aria-hidden />
      </button>
      {abierto &&
        pos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            id={id}
            role="tooltip"
            style={{
              top: pos.top,
              left: pos.left,
              transform: pos.debajo ? "translateX(-50%)" : "translate(-50%, -100%)",
            }}
            className="pointer-events-none fixed z-[60] w-64 space-y-1.5 rounded-control bg-tinta px-3 py-2 text-xs leading-relaxed font-normal text-background shadow-elevada"
          >
            {lineas.map((linea, i) => (
              <p key={i}>{linea}</p>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
