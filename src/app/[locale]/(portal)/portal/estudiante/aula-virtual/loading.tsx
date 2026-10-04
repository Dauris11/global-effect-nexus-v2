import { Skeleton } from "@/components/ui/skeleton";

/**
 * Mientras carga el aula virtual: la misma forma que la página —encabezado,
 * cuatro cifras, el aviso, la fila de filtros y las tarjetas de tareas— para
 * que al llegar los datos nada salte de sitio.
 */
export default function CargandoAulaVirtual() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-5 w-full max-w-md" />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[88px] rounded-card" />
        ))}
      </div>

      <Skeleton className="h-16" />

      <div className="space-y-6">
        <Skeleton className="h-7 w-48" />
        <div className="flex gap-7">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-16" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-56 rounded-card" />
          ))}
        </div>
      </div>
    </div>
  );
}
