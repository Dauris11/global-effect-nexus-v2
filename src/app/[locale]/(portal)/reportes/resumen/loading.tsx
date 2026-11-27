import { useTranslations } from "next-intl";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Carga con la forma del tablero: seis cifras, tres montos, tres gráficas y el bloque de donantes. */
export default function CargandoTableroEjecutivo() {
  const t = useTranslations("common");

  return (
    <div role="status" className="space-y-6 md:space-y-8">
      <span className="sr-only">{t("loading")}</span>

      <Skeleton className="h-9 w-64 max-w-full" />

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Card key={i} className="gap-4 p-5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-16" />
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 md:gap-4">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="gap-4 p-5">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-8 w-40" />
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="gap-4 p-5 md:p-6">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-[200px] w-full rounded-card" />
          </Card>
        ))}
      </div>

      <Card className="gap-4 p-5 md:p-6">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-16 w-full" />
      </Card>
    </div>
  );
}
