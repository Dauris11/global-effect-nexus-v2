import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { CONTENEDOR } from "@/components/landing/piezas";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/**
 * Franja de cierre.
 *
 * Quien baja hasta aquí ya leyó todo lo que la Fundación tenía que contar y está
 * a un paso del pie, que no es un sitio donde hacer nada. Un titular y un botón,
 * el mismo de toda la página.
 *
 * Antes era una banda turquesa a pantalla completa. Con la norma de app web el
 * turquesa va solo en el CTA (docs/09 §1.2), así que el bloque es blanco y el
 * acento lo lleva el botón.
 */
export async function SeccionCierre() {
  const t = await getTranslations("landing");

  return (
    <section className="border-t border-linea py-12 md:py-16">
      <div
        className={`${CONTENEDOR} flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between`}
      >
        <h2 className="texto-titulo-pagina">{t("closingTitle")}</h2>

        <Button asChild size="lg">
          <Link href="/login">
            {t("enter")}
            <ArrowRight />
          </Link>
        </Button>
      </div>
    </section>
  );
}
