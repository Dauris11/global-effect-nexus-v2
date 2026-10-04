import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { routing } from "@/i18n/routing";
import { BLANCO } from "@/lib/paleta";

import "../globals.css";

/**
 * Inter es la única familia tipográfica del sistema (`docs/09-sistema-visual.md`), con los
 * pesos 300-900 que usan los títulos hero y los valores de KPI. Se expone como
 * `--font-inter`, que es lo que lee `--font-sans` en `globals.css`.
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "common" });

  return {
    title: {
      default: t("appName"),
      template: `%s · ${t("appName")}`,
    },
    description: t("foundation"),
    // Añadida a la pantalla de inicio de un iPhone, se abre sin la barra del
    // navegador, como una app.
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: t("appName"),
    },
  };
}

/**
 * Color de la barra del sistema (blanco, como el lienzo) y `viewport-fit:
 * cover`, que deja dibujar hasta el borde del iPhone: sin él no existen las
 * variables `safe-area-inset-*` que usa la barra inferior.
 */
export const viewport: Viewport = {
  themeColor: BLANCO,
  viewportFit: "cover",
};

export default async function LayoutRaiz({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // El proxy ya normaliza el idioma, pero una URL escrita a mano como /de
  // llegaría hasta aquí; sin esta comprobación se renderizaría sin mensajes.
  if (!hasLocale(routing.locales, locale)) notFound();

  // Solo los espacios que consumen componentes cliente. Sin este recorte se
  // serializarían los 45 KB de mensajes en cada página.
  const messages = await mensajesCliente();

  return (
    <html lang={locale} className={inter.variable} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
