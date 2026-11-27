import { EsqueletoEncabezado, EsqueletoPagina } from "@/components/estudiante/esqueletos";
import { Skeleton } from "@/components/ui/skeleton";

export default function Cargando() {
  return (
    <EsqueletoPagina className="space-y-6">
      <EsqueletoEncabezado />
      <Skeleton className="h-[104px] rounded-card" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[184px] rounded-card" />
        ))}
      </div>
    </EsqueletoPagina>
  );
}
