import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";

/** Encabezado y las dos tarjetas de formato, como la pantalla. */
export default function CargandoImpuestos() {
  const t = useTranslations("common");

  return (
    <div role="status" className="mx-auto max-w-5xl space-y-8">
      <span className="sr-only">{t("loading")}</span>
      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-5 w-72 max-w-full" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-48 rounded-card" />
        ))}
      </div>
    </div>
  );
}
