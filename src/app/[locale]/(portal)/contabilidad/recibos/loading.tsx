import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";

/** Carga con la forma de la consulta: encabezado, filtros, totales y lista. */
export default function CargandoRecibos() {
  const t = useTranslations("common");

  return (
    <div role="status" className="mx-auto max-w-6xl space-y-6">
      <span className="sr-only">{t("loading")}</span>
      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-80 max-w-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-11 rounded-control" />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-24 rounded-card" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-card" />
    </div>
  );
}
