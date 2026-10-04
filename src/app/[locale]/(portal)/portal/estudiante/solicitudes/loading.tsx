import {
  EsqueletoEncabezado,
  EsqueletoLista,
  EsqueletoPagina,
} from "@/components/estudiante/esqueletos";
import { Skeleton } from "@/components/ui/skeleton";

/** Solicitudes: encabezado, el formulario en su tarjeta y la lista de trámites. */
export default function Cargando() {
  return (
    <EsqueletoPagina className="mx-auto max-w-4xl space-y-10">
      <EsqueletoEncabezado />
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-80 rounded-card" />
      </div>
      <EsqueletoLista filas={3} />
    </EsqueletoPagina>
  );
}
