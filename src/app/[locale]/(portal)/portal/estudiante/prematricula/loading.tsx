import { EsqueletoEncabezado, EsqueletoPagina } from "@/components/estudiante/esqueletos";
import { Skeleton } from "@/components/ui/skeleton";

/** Prematrícula: encabezado, el aviso del plazo y el primer paso. */
export default function Cargando() {
  return (
    <EsqueletoPagina className="space-y-6">
      <EsqueletoEncabezado />
      <Skeleton className="h-16 rounded-control" />
      <Skeleton className="h-8 w-full max-w-md" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-20 rounded-card" />
        <Skeleton className="h-20 rounded-card" />
      </div>
    </EsqueletoPagina>
  );
}
