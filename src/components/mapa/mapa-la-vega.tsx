"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

import type { LiceoMapaItem, PropsMapaLaVega } from "./mapa-la-vega-cliente";

export type { LiceoMapaItem, PropsMapaLaVega };

/**
 * Hueco con la forma del mapa: barra de filtros, lienzo y leyenda. Las alturas
 * son las mismas que pone el cliente para que nada salte al llegar Leaflet.
 */
function EsqueletoMapa() {
  return (
    <div className="space-y-3" aria-busy="true">
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-11 w-44" />
        <Skeleton className="h-11 w-28 rounded-full" />
        <Skeleton className="h-11 w-32 rounded-full" />
      </div>
      <Skeleton className="h-[min(420px,65svh)] min-h-64 w-full rounded-card" />
      <Skeleton className="h-4 w-56" />
    </div>
  );
}

/**
 * Leaflet toca `window` al importarse, así que el mapa entero se carga solo en
 * el navegador. De paso, sus ~150 KB no viajan a las páginas que no lo usan.
 */
export const MapaLaVega = dynamic<PropsMapaLaVega>(
  () => import("./mapa-la-vega-cliente").then((mod) => mod.MapaLaVegaCliente),
  { ssr: false, loading: EsqueletoMapa },
);
