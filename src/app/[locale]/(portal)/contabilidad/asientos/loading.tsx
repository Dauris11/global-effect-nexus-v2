import { useTranslations } from "next-intl";

import { EncabezadoCarga } from "@/components/ui/encabezado-carga";
import { Skeleton } from "@/components/ui/skeleton";

/** Carga con la forma del patrón Lista: encabezado, barra de filtros con chips y tabla. */
export default function CargandoAsientos() {
  const t = useTranslations("common");

  return (
    <div role="status" className="space-y-6">
      <span className="sr-only">{t("loading")}</span>
      <EncabezadoCarga />
      <div className="space-y-3">
        <Skeleton className="h-9 w-full max-w-sm rounded-control" />
        <div className="flex gap-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-full" />
          ))}
        </div>
      </div>
      <Skeleton className="h-96 rounded-card" />
    </div>
  );
}
