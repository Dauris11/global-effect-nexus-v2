import { useTranslations } from "next-intl";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Carga del panel con su misma forma: encabezado, las dos filas de cifras,
 * los accesos, tres gráficas y las listas. Así, cuando llegan los datos, nada
 * salta de sitio.
 */
export default function CargandoDashboard() {
  const t = useTranslations("common");

  return (
    <div role="status" className="space-y-8 md:space-y-12">
      <span className="sr-only">{t("loading")}</span>

      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-64 max-w-full" />
        <Skeleton className="h-5 w-80 max-w-full" />
      </div>

      <div className="space-y-3 md:space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
          {[0, 1, 2].map((i) => (
            <Skeleton
              key={i}
              className={i === 2 ? "col-span-2 h-[88px] rounded-card md:col-span-1" : "h-[88px] rounded-card"}
            />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[88px] rounded-card" />
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <Skeleton className="h-7 w-48" />
        <div className="grid grid-cols-3 gap-3 md:gap-4 lg:grid-cols-6">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-[108px] rounded-card" />
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="gap-4 p-5 md:p-6">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-[200px] w-full rounded-card" />
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1].map((tarjeta) => (
          <Card key={tarjeta} className="p-5 md:p-6">
            <Skeleton className="mb-4 h-5 w-44" />
            {[0, 1, 2, 3].map((fila) => (
              <div
                key={fila}
                className="flex items-center gap-3 border-b border-linea py-3 last:border-b-0"
              >
                <Skeleton className="size-8 shrink-0 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-3/5" />
                  <Skeleton className="h-3.5 w-2/5" />
                </div>
              </div>
            ))}
          </Card>
        ))}
      </div>
    </div>
  );
}
