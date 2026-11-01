import { useTranslations } from "next-intl";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Carga con la forma de la bandeja: avisos, cuatro listas y tres gráficas. */
export default function CargandoBandeja() {
  const t = useTranslations("common");

  return (
    <div role="status" className="space-y-6 md:space-y-8">
      <span className="sr-only">{t("loading")}</span>

      <Skeleton className="h-9 w-64 max-w-full" />

      <Card className="gap-3 p-5 md:p-6">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1, 2, 3].map((tarjeta) => (
          <Card key={tarjeta} className="p-5 md:p-6">
            <Skeleton className="mb-4 h-5 w-44" />
            {[0, 1, 2, 3].map((fila) => (
              <div
                key={fila}
                className="flex items-center gap-3 border-b border-linea py-3 last:border-b-0"
              >
                <Skeleton className="size-3 shrink-0 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-3/5" />
                  <Skeleton className="h-3.5 w-2/5" />
                </div>
              </div>
            ))}
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="gap-4 p-5 md:p-6">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-[200px] w-full rounded-card" />
          </Card>
        ))}
      </div>
    </div>
  );
}
