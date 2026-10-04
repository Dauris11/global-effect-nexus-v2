import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

/**
 * Marco de las pantallas de acceso. Sin barra lateral ni superior, porque aquí
 * todavía no hay rol.
 *
 * El fondo es el gris `muted` plano y la tarjeta blanca encima, con la sombra
 * elevada: el contraste lo da la sombra neutra, no un resplandor azul (las
 * sombras y los fondos teñidos de marca salieron con el lenguaje "app web").
 * El logo vive dentro de la tarjeta, que es lo primero que se mira; fuera queda
 * solo la salida de vuelta al inicio.
 */
export default function LayoutAuth({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations("auth");

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-muted px-4 py-10">
      <div className="w-full max-w-[440px] space-y-6">
        {children}

        <p className="text-center">
          <Link
            href="/"
            className="inline-flex h-11 items-center gap-1.5 rounded-control px-4 text-sm text-tinta-2 transition-colors hover:bg-background hover:text-tinta focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <ArrowLeft className="size-4" />
            {t("backHome")}
          </Link>
        </p>
      </div>
    </div>
  );
}
