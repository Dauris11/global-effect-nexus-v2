"use client";

import { useSyncExternalStore } from "react";

const CONSULTA = "(prefers-reduced-motion: reduce)";

function suscribir(aviso: () => void) {
  const medio = window.matchMedia(CONSULTA);
  medio.addEventListener("change", aviso);
  return () => medio.removeEventListener("change", aviso);
}

/**
 * `true` si la persona pidió menos movimiento. Recharts anima por JS, así que
 * el `motion-reduce:` de CSS no lo alcanza: hay que apagar la animación desde
 * aquí. En el servidor se asume `false` y el cliente corrige al hidratar.
 */
export function useMovimientoReducido(): boolean {
  return useSyncExternalStore(
    suscribir,
    () => window.matchMedia(CONSULTA).matches,
    () => false,
  );
}
