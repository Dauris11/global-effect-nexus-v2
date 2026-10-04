import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";

import { routing } from "./routing";

/**
 * Configuración por petición que consume el plugin de next-intl
 * (ver `next.config.mjs`). Los mensajes viven en `messages/<idioma>.json`
 * y son la única fuente de los textos de la interfaz: nada de cadenas
 * en español incrustadas en los componentes.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const solicitado = await requestLocale;
  const locale = hasLocale(routing.locales, solicitado)
    ? solicitado
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
