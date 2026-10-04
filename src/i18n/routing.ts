import { defineRouting } from "next-intl/routing";

/**
 * Idiomas del sistema. La restricción `usuario_idioma_check` de la migración
 * 0017 solo admite 'es' y 'en'; si aquí se añade otro, hay que ampliarla antes.
 *
 * `localePrefix: "as-needed"` deja el español sin prefijo, así la landing
 * pública vive en `/` y el inglés en `/en`.
 */
export const routing = defineRouting({
  locales: ["es", "en"],
  defaultLocale: "es",
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];
