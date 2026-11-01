"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";
import type { PropsMapaTransporte } from "./mapa-transporte-cliente";

export type { PropsMapaTransporte };

function EsqueletoMapaTransporte() {
  return (
    <div className="space-y-3" aria-busy="true">
      <Skeleton className="h-10 w-48 rounded-control" />
      <Skeleton className="h-[min(480px,65svh)] min-h-[320px] w-full rounded-card" />
      <Skeleton className="h-4 w-72" />
    </div>
  );
}

export const MapaTransporte = dynamic<PropsMapaTransporte>(
  () =>
    import("./mapa-transporte-cliente").then(
      (mod) => mod.MapaTransporteCliente,
    ),
  { ssr: false, loading: EsqueletoMapaTransporte },
);

