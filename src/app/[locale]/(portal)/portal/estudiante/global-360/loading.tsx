import { Skeleton } from "@/components/ui/skeleton";

/**
 * Mientras carga Global Effect 360: encabezado, cuatro cifras y la rejilla de
 * tarjetas de materia, con el hueco 4:3 de cada una.
 */
export default function CargandoGlobal360() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-5 w-full max-w-md" />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[88px] rounded-card" />
        ))}
      </div>

      <div className="space-y-6">
        <Skeleton className="h-7 w-48" />
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-[4/3] rounded-card" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
