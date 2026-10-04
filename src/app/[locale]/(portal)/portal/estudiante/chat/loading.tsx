import {
  EsqueletoEncabezado,
  EsqueletoPagina,
} from "@/components/estudiante/esqueletos";
import { Skeleton } from "@/components/ui/skeleton";

/** Chat: encabezado, aviso de privacidad, conversación y campo de escribir. */
export default function Cargando() {
  return (
    <EsqueletoPagina className="mx-auto max-w-3xl space-y-6">
      <EsqueletoEncabezado />
      <Skeleton className="h-16 rounded-control" />
      <div className="space-y-3">
        <Skeleton className="h-14 w-3/5 rounded-card" />
        <Skeleton className="ml-auto h-10 w-2/5 rounded-card" />
        <Skeleton className="h-20 w-3/4 rounded-card" />
      </div>
      <Skeleton className="h-24 rounded-control" />
    </EsqueletoPagina>
  );
}
