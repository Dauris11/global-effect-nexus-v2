import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";

/** Carga con la forma de la lista de plantillas. */
export default function CargandoRecurrentes() {
  const t = useTranslations("common");

  return (
    <div role="status" className="mx-auto max-w-6xl space-y-6">
      <span className="sr-only">{t("loading")}</span>
      <Skeleton className="h-11 w-32" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-5 w-80 max-w-full" />
      </div>
      <Skeleton className="h-72 rounded-card" />
    </div>
  );
}
