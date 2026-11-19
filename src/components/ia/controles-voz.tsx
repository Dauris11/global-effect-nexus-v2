"use client";

import { Mic, MicOff, Square, Volume2, VolumeX } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Botones de voz compartidos por el widget y el chat de pantalla completa.
 * Todos son botones de verdad con `aria-pressed` y etiqueta: un lector de
 * pantalla anuncia su estado, y el objetivo táctil es de 44 px.
 */

export type TextosVoz = {
  iniciar: string;
  detener: string;
  noSoportada: string;
  modoActivar: string;
  modoDesactivar: string;
  leer: string;
  detenerLectura: string;
  escuchando: string;
  hablando: string;
  permiso: string;
  sinVoz: string;
};

const BASE =
  "focus-visible:ring-ring flex size-11 shrink-0 items-center justify-center rounded-full outline-none transition-colors focus-visible:ring-2 disabled:opacity-40";

export function BotonMicrofono({
  escuchando,
  soporta,
  alPulsar,
  textos,
}: {
  escuchando: boolean;
  soporta: boolean;
  alPulsar: () => void;
  textos: TextosVoz;
}) {
  const etiqueta = !soporta ? textos.noSoportada : escuchando ? textos.detener : textos.iniciar;

  return (
    <button
      type="button"
      onClick={alPulsar}
      disabled={!soporta}
      aria-pressed={escuchando}
      aria-label={etiqueta}
      title={etiqueta}
      className={cn(BASE, escuchando ? "bg-marca-50 text-marca-700" : "text-tinta-3 hover:bg-muted hover:text-tinta")}
    >
      {escuchando ? <Square className="size-4 fill-current" /> : soporta ? <Mic className="size-5" /> : <MicOff className="size-5" />}
    </button>
  );
}

/** Interruptor de «conversación por voz»: enviar al terminar de hablar y leer las respuestas. */
export function InterruptorModoVoz({
  activo,
  alCambiar,
  textos,
}: {
  activo: boolean;
  alCambiar: (valor: boolean) => void;
  textos: TextosVoz;
}) {
  const etiqueta = activo ? textos.modoDesactivar : textos.modoActivar;

  return (
    <button
      type="button"
      onClick={() => alCambiar(!activo)}
      aria-pressed={activo}
      aria-label={etiqueta}
      title={etiqueta}
      className={cn(BASE, activo ? "bg-marca-50 text-marca-700" : "text-tinta-3 hover:bg-muted hover:text-tinta")}
    >
      {activo ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
    </button>
  );
}

/** Leer una respuesta en voz alta (o cortar la lectura). Pequeño: va dentro de la burbuja. */
export function BotonLeer({
  hablando,
  alPulsar,
  textos,
  claro = false,
}: {
  hablando: boolean;
  alPulsar: () => void;
  textos: TextosVoz;
  claro?: boolean;
}) {
  const etiqueta = hablando ? textos.detenerLectura : textos.leer;

  return (
    <button
      type="button"
      onClick={alPulsar}
      aria-pressed={hablando}
      aria-label={etiqueta}
      title={etiqueta}
      className={cn(
        "focus-visible:ring-ring inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-full text-xs outline-none transition-colors focus-visible:ring-2",
        claro ? "text-background/80 hover:text-background" : "text-tinta-3 hover:text-tinta",
        hablando && "text-marca-700",
      )}
    >
      {hablando ? <Square className="size-3.5 fill-current" /> : <Volume2 className="size-4" />}
    </button>
  );
}
