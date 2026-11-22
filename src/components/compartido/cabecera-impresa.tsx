import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";

import { fechaLarga } from "@/lib/fechas";

/**
 * Encabezado que solo se ve en el papel: logo, nombre de la Fundación y fecha. Va en el
 * armazón de todo el portal, así que cualquier pantalla que se imprima o se guarde en PDF
 * sale identificada sin que cada una arme el suyo. El título lo pone la propia pantalla.
 */
export async function CabeceraImpresa() {
  const [t, idiomaCrudo] = await Promise.all([getTranslations("export"), getLocale()]);
  const idioma = idiomaCrudo === "en" ? "en" : "es";

  return (
    <div className="solo-imprimir mb-4 border-b border-linea pb-3">
      <div className="flex items-center justify-between gap-4">
        <Image src="/logo.webp" alt={t("foundation")} width={180} height={48} className="h-10 w-auto" />
        <p className="texto-meta text-right">{t("issuedOn", { fecha: fechaLarga(new Date().toISOString(), idioma) })}</p>
      </div>
    </div>
  );
}
