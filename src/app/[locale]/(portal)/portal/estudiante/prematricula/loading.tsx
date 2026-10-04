import { Skeleton } from "@/components/ui/skeleton";

/**
 * Mientras carga "Mis materias": encabezado, cuatro cifras y un período con su
 * tabla (en el teléfono, sus tarjetas). El bloque de elegir materias no se
 * dibuja: solo existe con la ventana de prematrícula, y adivinarlo haría saltar
 * la página las más de las veces.
 */
export default function CargandoMisMaterias() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-52" />
        <Skeleton className="h-5 w-full max-w-md" />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[88px] rounded-card" />
        ))}
      </div>

      <div className="space-y-6 border-t border-linea pt-8">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-6 w-32" />
        <div className="hidden space-y-2 md:block">
          <Skeleton className="h-10" />
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
        <div className="space-y-3 md:hidden">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-card" />
          ))}
        </div>
      </div>
    </div>
  );
}
