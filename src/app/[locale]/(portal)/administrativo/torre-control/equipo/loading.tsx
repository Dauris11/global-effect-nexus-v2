import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";

/** Misma forma que la torre: encabezado, cuatro cifras, chips y filas. */
export default function CargandoTorreEquipo() {
  const t = useTranslations("common");

  return (
    <div role="status" className="mx-auto max-w-6xl space-y-8">
      <span className="sr-only">{t("loading")}</span>
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-64" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20 rounded-card" />
        ))}
      </div>
      <Skeleton className="h-14 w-full" />
      <div className="space-y-3">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-16 rounded-card" />
        ))}
      </div>
    </div>
  );
}
