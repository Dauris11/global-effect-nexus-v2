import { getTranslations } from "next-intl/server";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Piezas de carga de las pantallas del estudiante. Cada `loading.tsx` las
 * monta en la MISMA forma que su página —encabezado, cifras, lista o tabla—
 * para que, al llegar los datos, nada salte de sitio.
 *
 * Sin texto visible: solo el "Cargando…" para lectores de pantalla.
 */

export async function EsqueletoPagina({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const t = await getTranslations("common");

  return (
    <div className={cn("space-y-8", className)} aria-busy>
      <span className="sr-only" role="status">
        {t("loading")}
      </span>
      {children}
    </div>
  );
}

/** Antetítulo, título grande y subtítulo, como `EncabezadoPagina`. */
export function EsqueletoEncabezado() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-64 max-w-full" />
      <Skeleton className="h-4 w-80 max-w-full" />
    </div>
  );
}

/** Fila de `StatCard`: dos columnas en el móvil, cuatro en escritorio. */
export function EsqueletoCifras() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-[92px] rounded-card" />
      ))}
    </div>
  );
}

/** Fila de chips de filtro. */
export function EsqueletoChips() {
  return (
    <div className="flex gap-7 overflow-hidden border-b border-linea pb-2.5">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex shrink-0 flex-col items-center gap-1.5">
          <Skeleton className="size-6 rounded-full" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

/** Título de sección y filas separadas por línea, con icono a la izquierda. */
export function EsqueletoLista({ filas = 4 }: { filas?: number }) {
  return (
    <div className="space-y-3">
      <Skeleton className="h-6 w-48" />
      <div>
        {Array.from({ length: filas }, (_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b border-linea py-3 last:border-b-0"
          >
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-3 w-2/5" />
            </div>
            <Skeleton className="h-5 w-12 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Tarjeta de accesos: dos columnas en el móvil, tres en escritorio. */
export function EsqueletoAccesos({ cuantos = 6 }: { cuantos?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-3">
      {Array.from({ length: cuantos }, (_, i) => (
        <Skeleton key={i} className="h-40 rounded-card" />
      ))}
    </div>
  );
}
