import {
  EsqueletoAccesos,
  EsqueletoCifras,
  EsqueletoEncabezado,
  EsqueletoLista,
  EsqueletoPagina,
} from "@/components/estudiante/esqueletos";
import { Skeleton } from "@/components/ui/skeleton";

/** Inicio del portal: saludo, cifras, "lo próximo", accesos y dos listas. */
export default function Cargando() {
  return (
    <EsqueletoPagina className="space-y-10 md:space-y-12">
      <div className="space-y-6">
        <EsqueletoEncabezado />
        <EsqueletoCifras />
      </div>
      <Skeleton className="h-[184px] rounded-card" />
      <EsqueletoAccesos />
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-12">
        <EsqueletoLista />
        <EsqueletoLista />
      </div>
    </EsqueletoPagina>
  );
}
