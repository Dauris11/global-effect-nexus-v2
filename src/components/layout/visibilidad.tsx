"use client";

import { createContext, useContext, useMemo } from "react";

import type { Permiso } from "@/lib/rbac";

/**
 * Las rutas que el administrador maestro ocultó para el rol de quien mira.
 *
 * El servidor las lee una vez en el layout del portal y las reparte por
 * contexto: la barra lateral, las pestañas del móvil, el buscador de comandos y
 * la barra superior las aplican con el mismo conjunto, para que lo oculto
 * desaparezca de todos los sitios a la vez y no de la mitad.
 */
const Contexto = createContext<ReadonlySet<string>>(new Set());

/** Lo que la persona puede hacer, ya resuelto (rol + habilitaciones personales). */
const ContextoPermisos = createContext<ReadonlySet<Permiso> | undefined>(undefined);

export function ProveedorVisibilidad({
  ocultos,
  permisos,
  children,
}: {
  ocultos: readonly string[];
  permisos: readonly Permiso[];
  children: React.ReactNode;
}) {
  // Un `Set` nuevo en cada render haría repintar a todos los consumidores.
  const conjunto = useMemo(() => new Set(ocultos), [ocultos]);
  const conjuntoPermisos = useMemo(() => new Set(permisos), [permisos]);

  return (
    <Contexto.Provider value={conjunto}>
      <ContextoPermisos.Provider value={conjuntoPermisos}>
        {children}
      </ContextoPermisos.Provider>
    </Contexto.Provider>
  );
}

export function usePermisos(): ReadonlySet<Permiso> | undefined {
  return useContext(ContextoPermisos);
}

export function useOcultos(): ReadonlySet<string> {
  return useContext(Contexto);
}
