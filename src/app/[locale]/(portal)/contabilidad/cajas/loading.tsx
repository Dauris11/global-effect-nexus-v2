import { useTranslations } from "next-intl";

import { EncabezadoCarga } from "@/components/ui/encabezado-carga";
import { Skeleton } from "@/components/ui/skeleton";

/** Encabezado y tarjetas de cajas chicas y operativas. */
export default function CargandoCajas() {
  const t = useTranslations("common");

  return (
    <div role="status" className="space-y-6">
      <span className="sr-only">{t("loading")}</span>
      <EncabezadoCarga />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-44 rounded-card border border-linea" />
        ))}
      </div>
    </div>
  );
}

