"use client";

import dynamic from "next/dynamic";
import type { PropsMapaLaVega, LiceoMapaItem } from "./mapa-la-vega-cliente";

export type { PropsMapaLaVega, LiceoMapaItem };

/**
 * Componente de Mapa de La Vega cargado exclusivamente en el cliente (SSR desactivado)
 * para garantizar compatibilidad total con Leaflet en Next.js y Vercel.
 */
export const MapaLaVega = dynamic<PropsMapaLaVega>(
  () => import("./mapa-la-vega-cliente").then((mod) => mod.MapaLaVegaCliente),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[420px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/40 flex items-center justify-center animate-pulse text-xs text-slate-500 font-medium">
        Cargando mapa de La Vega...
      </div>
    ),
  },
);
