"use client";

import { useCallback, useSyncExternalStore } from "react";

import {
  APARIENCIA_INICIAL,
  CLAVE_APARIENCIA,
  aplicarApariencia,
  leerApariencia,
  type Apariencia,
} from "@/lib/apariencia";

const oyentes = new Set<() => void>();

function suscribir(aviso: () => void) {
  oyentes.add(aviso);
  // `storage` avisa de los cambios hechos en otra pestaña del mismo navegador.
  window.addEventListener("storage", aviso);

  return () => {
    oyentes.delete(aviso);
    window.removeEventListener("storage", aviso);
  };
}

// El snapshot es un texto y no un objeto: `useSyncExternalStore` compara por
// identidad y un objeto nuevo en cada lectura lo haría repintar sin parar.
const instantanea = () => {
  const { tema, barra } = leerApariencia();

  return `${tema}|${barra}`;
};

const instantaneaServidor = () =>
  `${APARIENCIA_INICIAL.tema}|${APARIENCIA_INICIAL.barra}`;

/** Apariencia vigente y la función para cambiarla (se guarda y se aplica). */
export function useApariencia() {
  const valor = useSyncExternalStore(suscribir, instantanea, instantaneaServidor);
  const [tema, barra] = valor.split("|") as [Apariencia["tema"], Apariencia["barra"]];

  const cambiar = useCallback((parcial: Partial<Apariencia>) => {
    const nueva = { ...leerApariencia(), ...parcial };

    try {
      localStorage.setItem(CLAVE_APARIENCIA, JSON.stringify(nueva));
    } catch {
      // Sin almacenamiento el cambio vale solo para esta visita.
    }

    aplicarApariencia(nueva);
    oyentes.forEach((aviso) => aviso());
  }, []);

  return { tema, barra, cambiar };
}
