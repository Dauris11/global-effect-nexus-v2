import { getTranslations } from "next-intl/server";

import { CifraAnimada } from "@/components/landing/cifra-animada";
import { CONTENEDOR } from "@/components/landing/piezas";
import type { Locale } from "@/i18n/routing";
import type { CifrasPublicas } from "@/server/landing/consultas";

/**
 * Franja de cifras bajo el hero.
 *
 * Todas salen de la base (`cifrasPublicas` e `inscritosComidaHoy`), ninguna
 * está escrita a mano: una portada que presume de trazabilidad no puede
 * inventarse sus números. Las que valen cero se omiten, porque "0
 * patrocinadores" en una instalación recién sembrada diría algo falso de la
 * Fundación; si todas son cero, la franja no se pinta.
 *
 * Sin cajas ni iconos: la cifra grande es la que manda, con su etiqueta
 * debajo. El aire entre columnas basta para separarlas.
 */
export async function SeccionCifras({
  cifras,
  inscritosHoy,
  locale,
}: {
  cifras: CifrasPublicas;
  inscritosHoy: number;
  locale: Locale;
}) {
  const t = await getTranslations("landing");

  const filas = [
    { clave: "students", valor: cifras.becados },
    { clave: "g360", valor: cifras.cursando_360 },
    { clave: "sponsors", valor: cifras.patrocinadores },
    { clave: "meals", valor: inscritosHoy },
  ].filter((fila) => fila.valor > 0);

  if (filas.length === 0) return null;

  return (
    <section aria-labelledby="cifras-titulo" className={`${CONTENEDOR} pt-10 pb-4 md:pt-14`}>
      <h2 id="cifras-titulo" className="sr-only">
        {t("statsTitle")}
      </h2>

      {/* Flex y no rejilla de cuatro: con dos cifras una rejilla dejaba media
          fila vacía, y las que haya tienen que leerse como un solo grupo. */}
      <dl className="revelar-hijos flex flex-wrap gap-x-12 gap-y-8 md:gap-x-20">
        {filas.map((fila) => (
          <div key={fila.clave} className="flex min-w-32 flex-col-reverse gap-1">
            <dt className="text-sm leading-snug text-tinta-2">
              {t(`stats_${fila.clave}`, { n: fila.valor })}
            </dt>
            <dd className="text-[40px] leading-none font-semibold tracking-[-0.03em] text-tinta tabular-nums md:text-[56px]">
              <CifraAnimada valor={fila.valor} idioma={locale} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
