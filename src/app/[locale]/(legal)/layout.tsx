import { ChevronLeft } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

/**
 * Marco de las páginas legales: públicas (sin sesión), con el logo y la salida
 * de vuelta al inicio. Sin menú ni barra lateral porque quien llega aquí viene
 * de un enlace del pie, no de dentro del portal.
 */
export default function LayoutLegal({ children }: { children: React.ReactNode }) {
  const t = useTranslations("legal");
  const tComun = useTranslations("common");

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-linea bg-card">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-4 md:px-6">
          <Link
            href="/"
            aria-label={tComun("foundation")}
            className="block rounded-control focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Image src="/logo.webp" alt={tComun("foundation")} width={720} height={157} priority className="logo-claro h-9 w-auto" />
            <Image src="/logo-dark.webp" alt={tComun("foundation")} width={720} height={157} priority className="logo-oscuro h-9 w-auto" />
          </Link>

          <Link
            href="/"
            className="inline-flex h-9 items-center gap-1.5 rounded-control px-2.5 text-sm font-medium text-tinta-2 transition-colors hover:bg-muted hover:text-tinta focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <ChevronLeft aria-hidden className="size-4" />
            {t("volver")}
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-10 md:px-6 md:py-14">{children}</main>
    </div>
  );
}
