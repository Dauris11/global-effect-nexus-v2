import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { CONTENEDOR } from "@/components/landing/piezas";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/**
 * Cierre de la página.
 *
 * Quien baja hasta aquí ya leyó todo lo que la Fundación tenía que contar y está
 * a un paso del pie, que no es un sitio donde hacer nada. Un titular grande,
 * una línea y el mismo botón de toda la página.
 *
 * Panel de tinta con las esquinas `rounded-hoja`: es el único bloque oscuro de
 * la landing y marca el final como el hero marca el principio. Tinta y no
 * turquesa, porque la marca reserva el turquesa al CTA (docs/09 §1.2) y aquí
 * lo lleva el botón, que sobre oscuro se lee todavía mejor. `tinta` se invierte
 * en modo oscuro y el panel pasa a claro, que es lo que debe hacer.
 */
export async function SeccionCierre() {
  const t = await getTranslations("landing");

  return (
    <section aria-labelledby="cierre-titulo" className={`${CONTENEDOR} pt-4 pb-16 md:pb-24`}>
      <div className="revelar flex flex-col items-start gap-8 rounded-hoja bg-tinta px-6 py-12 text-background md:flex-row md:items-end md:justify-between md:px-14 md:py-20">
        <div className="max-w-2xl">
          <h2
            id="cierre-titulo"
            className="text-[34px] leading-[1.05] font-semibold tracking-[-0.03em] text-balance md:text-[56px]"
          >
            {t("closingTitle")}
          </h2>
          <p className="mt-4 max-w-lg text-lg leading-relaxed text-background/75">
            {t("closingText")}
          </p>
        </div>

        <Button asChild size="lg" className="group/cta shrink-0 focus-visible:ring-offset-tinta">
          <Link href="/login">
            {t("enter")}
            <ArrowRight className="transition-transform duration-200 group-hover/cta:translate-x-0.5" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
