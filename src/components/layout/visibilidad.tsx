"use client";

import { createContext, useContext, useMemo } from "react";

/**
 * Las rutas que el administrador maestro ocultó para el rol de quien mira.
 *
 * El servidor las lee una vez en el layout del portal y las reparte por
 * contexto: la barra lateral, las pestañas del móvil, el buscador de comandos y
 * la barra superior las aplican con el mismo conjunto, para que lo oculto
 * desaparezca de todos los sitios a la vez y no de la mitad.
 */
const Contexto = createContext<ReadonlySet<string>>(new Set());

export function ProveedorVisibilidad({
  ocultos,
  children,
}: {
  ocultos: readonly string[];
  children: React.ReactNode;
}) {
  // Un `Set` nuevo en cada render haría repintar a todos los consumidores.
  const conjunto = useMemo(() => new Set(ocultos), [ocultos]);

  return <Contexto.Provider value={conjunto}>{children}</Contexto.Provider>;
}

export function useOcultos(): ReadonlySet<string> {
  return useContext(Contexto);
}
