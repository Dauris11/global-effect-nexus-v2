import { EsqueletoPagina } from "@/components/estudiante/esqueletos";
import { Skeleton } from "@/components/ui/skeleton";

/** Puerta pública de transporte: cabecera, mapa en vivo y las dos tarjetas de abajo. */
export default function Cargando() {
  return (
    <div className="min-h-dvh bg-muted/30 px-4 py-8 dark:bg-background">
      <EsqueletoPagina className="mx-auto max-w-4xl space-y-6">
        <Skeleton className="h-24 w-full rounded-card" />
        <Skeleton className="h-[min(480px,65svh)] min-h-[320px] w-full rounded-card" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-80 w-full rounded-card" />
          <Skeleton className="h-80 w-full rounded-card" />
        </div>
      </EsqueletoPagina>
    </div>
  );
}
