import { useTranslations } from "next-intl";

import { EncabezadoCarga } from "@/components/ui/encabezado-carga";
import { Skeleton } from "@/components/ui/skeleton";

/** Encabezado y dos tarjetas de cuenta, como la pantalla. */
export default function CargandoBancos() {
  const t = useTranslations("common");

  return (
    <div role="status" className="space-y-8">
      <span className="sr-only">{t("loading")}</span>
      <EncabezadoCarga />
      <div className="grid gap-4 md:grid-cols-2">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-48 rounded-card" />
        ))}
      </div>
    </div>
  );
}
