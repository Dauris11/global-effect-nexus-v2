import {
  EsqueletoEncabezado,
  EsqueletoLista,
  EsqueletoPagina,
} from "@/components/estudiante/esqueletos";
import { Skeleton } from "@/components/ui/skeleton";

/** Transporte del estudiante: encabezado, pestañas, mapa y paradas de la ruta. */
export default function Cargando() {
  return (
    <EsqueletoPagina className="mx-auto max-w-5xl">
      <EsqueletoEncabezado />
      <Skeleton className="h-10 w-full rounded-control sm:w-80" />
      <Skeleton className="h-[min(480px,65svh)] min-h-[320px] w-full rounded-card" />
      <EsqueletoLista filas={3} />
    </EsqueletoPagina>
  );
}
