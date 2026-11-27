import { useTranslations } from "next-intl";

import { EncabezadoCarga } from "@/components/ui/encabezado-carga";
import { Skeleton } from "@/components/ui/skeleton";

/** Carga con la forma de la lista de plantillas. */
export default function CargandoRecurrentes() {
  const t = useTranslations("common");

  return (
    <div role="status" className="space-y-6">
      <span className="sr-only">{t("loading")}</span>
      <Skeleton className="h-11 w-32" />
      <EncabezadoCarga />
      <Skeleton className="h-72 rounded-card" />
    </div>
  );
}
