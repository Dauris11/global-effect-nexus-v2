import { getTranslations } from "next-intl/server";

import { PaginaNoEncontrada } from "@/components/seo/pagina-no-encontrada";

import "./globals.css";

/**
 * 404 global: cualquier URL sin pantalla (`/xyz/abc`, un idioma inexistente) cae
 * aquí, no en el layout de idioma, así que necesita su propio `<html>`. Va en
 * español, el idioma por defecto del sitio; los 404 dentro de `/en` usan
 * `[locale]/not-found`.
 */
export default async function NoEncontradaGlobal() {
  const t = await getTranslations({ locale: "es", namespace: "seo" });

  return (
    <html lang="es">
      <body>
        <PaginaNoEncontrada
          titulo={t("notFoundTitulo")}
          texto={t("notFoundTexto")}
          volver={t("notFoundVolver")}
          href="/"
        />
      </body>
    </html>
  );
}
