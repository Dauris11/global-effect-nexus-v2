import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * Pantalla de carga con la forma de lo que va a llegar, para que al cargar nada salte de
 * sitio. Cuatro formas cubren todo el portal; cada `loading.tsx` elige la suya:
 *   · `lista`      encabezado, cifras, filtros y filas (listados y bandejas)
 *   · `detalle`    volver, portada, pestañas y dos bloques (fichas)
 *   · `formulario` encabezado y una tarjeta de campos (alta y edición)
 *   · `panel`      encabezado, tarjetas de acceso y un bloque grande (inicios y módulos)
 * Es de servidor y sin estado: el brillo es `animate-shimmer`, que se apaga con movimiento reducido.
 */
export type VarianteCarga = "lista" | "detalle" | "formulario" | "panel";

const Encabezado = () => (
  <div className="flex items-end justify-between gap-4">
    <div className="space-y-2">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-9 w-56 max-w-full" />
    </div>
    <Skeleton className="hidden h-11 w-36 sm:block" />
  </div>
);

export function CargaPagina({ variante = "lista" }: { variante?: VarianteCarga }) {
  const t = useTranslations("common");

  return (
    <div role="status" aria-busy="true" className="mx-auto w-full max-w-6xl space-y-6">
      <span className="sr-only">{t("loading")}</span>

      {variante === "lista" && (
        <>
          <Encabezado />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 rounded-card" />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-9 w-24 rounded-full" />
            ))}
          </div>
          <Skeleton className="h-11 w-full max-w-md rounded-full" />
          <div className="space-y-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 rounded-card" />
            ))}
          </div>
        </>
      )}

      {variante === "detalle" && (
        <>
          <Skeleton className="h-9 w-40" />
          <div className="flex items-center gap-5 rounded-card border border-linea p-5">
            <Skeleton className="size-24 shrink-0 rounded-full" />
            <div className="w-full space-y-3">
              <Skeleton className="h-7 w-64 max-w-full" />
              <Skeleton className="h-4 w-80 max-w-full" />
              <Skeleton className="h-4 w-48 max-w-full" />
            </div>
          </div>
          <div className="flex gap-2 overflow-hidden">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-10 w-28 shrink-0 rounded-full" />
            ))}
          </div>
          <Skeleton className="h-56 rounded-card" />
          <Skeleton className="h-40 rounded-card" />
        </>
      )}

      {variante === "formulario" && (
        <>
          <Encabezado />
          <div className="space-y-5 rounded-card border border-linea p-5">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-11 w-full" />
              </div>
            ))}
            <Skeleton className="ml-auto h-11 w-36" />
          </div>
        </>
      )}

      {variante === "panel" && (
        <>
          <Encabezado />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-32 rounded-card" />
            ))}
          </div>
          <Skeleton className="h-72 rounded-card" />
        </>
      )}
    </div>
  );
}
