import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * Mientras se comprueba si ya hay sesión: la misma tarjeta del login —logo,
 * titular, dos campos, el botón, el separador y Google— para que al llegar el
 * formulario nada salte de sitio.
 */
export default function CargandoLogin() {
  const t = useTranslations("common");

  return (
    <div
      role="status"
      className="rounded-hoja border border-linea bg-card p-6 shadow-elevada sm:p-10"
    >
      <span className="sr-only">{t("loading")}</span>

      <Skeleton className="h-10 w-44" />
      <Skeleton className="mt-8 h-8 w-48" />

      <div className="mt-6 space-y-4">
        {[0, 1].map((campo) => (
          <div key={campo} className="space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-12 w-full" />
          </div>
        ))}
        <Skeleton className="h-12 w-full" />
        <Skeleton className="mx-auto h-4 w-8" />
        <Skeleton className="h-12 w-full" />
      </div>

      <Skeleton className="mx-auto mt-8 h-4 w-64 max-w-full" />
    </div>
  );
}
