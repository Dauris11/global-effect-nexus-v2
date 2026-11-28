import { getTranslations } from "next-intl/server";

import { CabeceraPregunta, CONTENEDOR } from "@/components/landing/piezas";

/**
 * «¿Cómo entro por primera vez?»: tres pasos numerados.
 *
 * Es lista ordenada (`<ol>`) y no tres tarjetas sueltas: el orden importa y así
 * se anuncia a un lector de pantalla. El número lo pinta el contador CSS, no el
 * texto, para que «1» no se lea como parte de la frase. Todo va en el HTML del
 * servidor; no depende de JavaScript.
 */
export async function SeccionPasos() {
  const t = await getTranslations("landing");

  return (
    <section id="primer-acceso" aria-labelledby="pasos-titulo" className="scroll-mt-24 pb-16 md:pb-24">
      <div className={CONTENEDOR}>
        <CabeceraPregunta id="pasos-titulo" etiqueta={t("stepsTag")} titulo={t("stepsTitle")} />

        <ol className="grid list-none gap-4 [counter-reset:paso] md:grid-cols-3">
          {([1, 2, 3] as const).map((n) => (
            <li
              key={n}
              className="relative rounded-card border border-linea bg-card p-6 before:mb-3.5 before:flex before:size-[30px] before:items-center before:justify-center before:rounded-[9px] before:bg-marca-50 before:text-[13px] before:font-extrabold before:text-marca-700 before:content-[counter(paso)] before:[counter-increment:paso]"
            >
              <b className="mb-1.5 block text-[17px] font-bold text-tinta">{t(`step_${n}_t`)}</b>
              <p className="text-[15px] text-tinta-2">{t(`step_${n}_d`)}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
