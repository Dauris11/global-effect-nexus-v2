import { EsqueletoPagina } from "@/components/estudiante/esqueletos";
import { Skeleton } from "@/components/ui/skeleton";

/** Cabina del chofer: tarjeta de mando con el botón grande y la lista de pasajeros. */
export default function Cargando() {
  return (
    <EsqueletoPagina className="mx-auto max-w-xl py-4">
      <Skeleton className="h-64 w-full rounded-card" />
      <Skeleton className="h-48 w-full rounded-card" />
    </EsqueletoPagina>
  );
}
