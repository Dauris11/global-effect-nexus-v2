"use client";

import { createContext, useContext, useMemo } from "react";

import type { Permiso } from "@/lib/rbac";

/**
 * Lo que la persona puede hacer, ya resuelto (rol + habilitaciones personales).
 *
 * El servidor lo lee una vez en el layout del portal y lo reparte por contexto:
 * la barra lateral, las pestañas del móvil, el buscador de comandos y la barra
 * superior derivan el menú del mismo conjunto, para que lo que no se puede abrir
 * desaparezca de todos los sitios a la vez y no de la mitad.
 */
const ContextoPermisos = createContext<ReadonlySet<Permiso> | undefined>(undefined);

export function ProveedorPermisos({
  permisos,
  children,
}: {
  permisos: readonly Permiso[];
  children: React.ReactNode;
}) {
  // Un `Set` nuevo en cada render haría repintar a todos los consumidores.
  const conjunto = useMemo(() => new Set(permisos), [permisos]);

  return <ContextoPermisos.Provider value={conjunto}>{children}</ContextoPermisos.Provider>;
}

export function usePermisos(): ReadonlySet<Permiso> | undefined {
  return useContext(ContextoPermisos);
}
