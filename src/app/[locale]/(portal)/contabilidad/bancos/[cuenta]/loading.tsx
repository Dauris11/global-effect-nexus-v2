import { useTranslations } from "next-intl";

import { EncabezadoCarga } from "@/components/ui/encabezado-carga";
import { Skeleton } from "@/components/ui/skeleton";

/** Encabezado, filtros, las cuatro cifras y el libro. */
export default function CargandoLibro() {
  const t = useTranslations("common");

  return (
    <div role="status" className="space-y-6">
      <span className="sr-only">{t("loading")}</span>
      <Skeleton className="h-5 w-24" />
      <EncabezadoCarga />
      <Skeleton className="h-11 w-full max-w-xl rounded-control" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 rounded-card" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-card" />
    </div>
  );
}
