import { getLocale, getTranslations } from "next-intl/server";

import { PaginaNoEncontrada } from "@/components/seo/pagina-no-encontrada";

export default async function NoEncontrada() {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "seo" });

  return (
    <PaginaNoEncontrada
      titulo={t("notFoundTitulo")}
      texto={t("notFoundTexto")}
      volver={t("notFoundVolver")}
      href={locale === "en" ? "/en" : "/"}
    />
  );
}
