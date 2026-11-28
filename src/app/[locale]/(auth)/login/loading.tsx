import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * Mientras se comprueba si ya hay sesión: la misma forma del login —logo, titular, Google,
 * separador, dos campos y el botón— para que al llegar el formulario nada salte de sitio.
 * El marco (foto y «Volver al inicio») es del layout y ya está en pantalla.
 */
export default function CargandoLogin() {
  const t = useTranslations("common");

  return (
    <div role="status">
      <span className="sr-only">{t("loading")}</span>

      <Skeleton className="h-9 w-44" />
      <Skeleton className="mt-8 h-9 w-56" />
      <Skeleton className="mt-2 h-4 w-64 max-w-full" />

      <div className="mt-8 space-y-5">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="mx-auto h-4 w-28" />
        {[0, 1].map((campo) => (
          <div key={campo} className="space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-11 w-full" />
          </div>
        ))}
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}
