"use client";

import { useEffect } from "react";

import { aplicarApariencia, leerApariencia } from "@/lib/apariencia";

/**
 * Aplica la apariencia guardada mientras el portal está montado.
 *
 * Al salir del portal (landing, login) se retira: la apariencia es del portal y
 * esas páginas no están pensadas para el modo oscuro.
 */
export function AplicadorApariencia() {
  useEffect(() => {
    aplicarApariencia(leerApariencia());

    return () => {
      const raiz = document.documentElement;

      raiz.classList.remove("dark");
      delete raiz.dataset.barra;
      delete raiz.dataset.acento;
    };
  }, []);

  return null;
}
