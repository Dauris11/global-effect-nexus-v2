import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";

/** Carga con la forma de la ficha: encabezado, datos y líneas. */
export default function CargandoAsiento() {
  const t = useTranslations("common");

  return (
    <div role="status" className="mx-auto max-w-4xl space-y-6">
      <span className="sr-only">{t("loading")}</span>
      <Skeleton className="h-11 w-32" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      <Skeleton className="h-32 rounded-card" />
      <Skeleton className="h-64 rounded-card" />
    </div>
  );
}
