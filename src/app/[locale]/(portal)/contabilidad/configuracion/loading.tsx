import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";

/** Carga con la forma de la pantalla: encabezado, pestañas y una tarjeta de formulario. */
export default function CargandoConfiguracion() {
  const t = useTranslations("common");

  return (
    <div role="status" className="mx-auto max-w-6xl space-y-6">
      <span className="sr-only">{t("loading")}</span>
      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-64 max-w-full" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      <div className="flex h-12 items-end gap-6 border-b border-linea">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="mb-3 h-5 w-24" />
        ))}
      </div>
      <div className="rounded-card border border-linea p-5 md:p-6">
        <div className="grid gap-5 md:grid-cols-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-12 rounded-control" />
            </div>
          ))}
        </div>
      </div>
      <Skeleton className="h-20 rounded-card" />
    </div>
  );
}
