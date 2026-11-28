import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";

import "@/components/auth/auth.css";
import { FondoGrano } from "@/components/auth/fondo-grano";
import { Link } from "@/i18n/navigation";

/** Las pantallas de acceso no se indexan (GS-01: login y áreas privadas con `noindex`). */
export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Marco de las pantallas de acceso (login, recuperar, contraseña nueva). Sin barra lateral ni
 * superior, porque aquí todavía no hay rol.
 *
 * Una sola foto y un solo DOM para los dos tamaños: en escritorio es la columna derecha (la
 * frase de la Fundación encima del velo) y en móvil se queda en una banda de 160 px sobre el
 * formulario, sin la frase. `lg:order-2` la manda a la derecha sin duplicar la imagen, que
 * descargaría la foto dos veces.
 *
 * «Volver al inicio» vive aquí y solo aquí, arriba a la izquierda de la columna del formulario:
 * las páginas no lo repiten. El formulario se centra en vertical dentro de su columna.
 */
export default function LayoutAuth({ children }: { children: React.ReactNode }) {
  const t = useTranslations("auth");

  return (
    <div className="grid min-h-dvh grid-rows-[auto_1fr] bg-background lg:grid-cols-2 lg:grid-rows-1">
      <aside className="relative h-40 overflow-hidden bg-marca-950 lg:order-2 lg:h-auto">
        {/* Decorativa: la frase que la acompaña ya dice de qué va la pantalla. */}
        <Image
          src="/media/landing/hero-mobile.jpg"
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover"
        />
        <div aria-hidden className="auth-velo absolute inset-0" />
        <div className="absolute inset-x-0 bottom-0 hidden p-12 text-white lg:block">
          <p className="max-w-[420px] text-[28px] leading-tight font-semibold tracking-tight">{t("heroQuote")}</p>
          <p className="mt-3 text-sm text-white/85">{t("heroCaption")}</p>
        </div>
      </aside>

      <main className="relative flex flex-col px-6 py-6 sm:px-12 lg:order-1 overflow-hidden">
        <FondoGrano opacidadGrano={0.06} cantidadParticulas={30} />
        <div className="relative z-10">
          <Link
            href="/"
            className="-ml-2.5 inline-flex h-9 items-center gap-1.5 rounded-control px-2.5 text-sm font-medium text-tinta-2 transition-colors hover:bg-muted hover:text-tinta focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <ChevronLeft className="size-4" aria-hidden />
            {t("backHome")}
          </Link>
        </div>

        <div className="relative z-10 flex flex-1 items-center justify-center py-8">
          <div className="w-full max-w-[400px]">{children}</div>
        </div>
      </main>
    </div>
  );
}
