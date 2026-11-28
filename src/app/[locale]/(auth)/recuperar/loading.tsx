import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";

/** Misma forma que la pantalla (logo, titular, un campo y el botón) para que nada salte al llegar. */
export default function CargandoRecuperar() {
  const t = useTranslations("common");

  return (
    <div role="status">
      <span className="sr-only">{t("loading")}</span>
      <Skeleton className="h-9 w-44" />
      <Skeleton className="mt-8 h-9 w-64 max-w-full" />
      <Skeleton className="mt-2 h-4 w-72 max-w-full" />
      <div className="mt-8 space-y-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}
