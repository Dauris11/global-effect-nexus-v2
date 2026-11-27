"use client";

import { createContext, useContext, useMemo } from "react";

import type { Permiso, Rol } from "@/lib/rbac";

/**
 * Lo que la persona puede hacer, ya resuelto (rol + habilitaciones personales).
 *
 * El servidor lo lee una vez en el layout del portal y lo reparte por contexto:
 * la barra lateral, las pestañas del móvil, el buscador de comandos y la barra
 * superior derivan el menú del mismo conjunto, para que lo que no se puede abrir
 * desaparezca de todos los sitios a la vez y no de la mitad.
 */
const ContextoPermisos = createContext<ReadonlySet<Permiso> | undefined>(undefined);
const ContextoRol = createContext<Rol | undefined>(undefined);

export function ProveedorPermisos({
  permisos,
  rol,
  children,
}: {
  permisos: readonly Permiso[];
  /** Rol efectivo (el de «Ver como» si lo hay): las pestañas de cada módulo dependen de él. */
  rol: Rol;
  children: React.ReactNode;
}) {
  // Un `Set` nuevo en cada render haría repintar a todos los consumidores.
  const conjunto = useMemo(() => new Set(permisos), [permisos]);

  return (
    <ContextoRol.Provider value={rol}>
      <ContextoPermisos.Provider value={conjunto}>{children}</ContextoPermisos.Provider>
    </ContextoRol.Provider>
  );
}

export function usePermisos(): ReadonlySet<Permiso> | undefined {
  return useContext(ContextoPermisos);
}

export function useRol(): Rol | undefined {
  return useContext(ContextoRol);
}
