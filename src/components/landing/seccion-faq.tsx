import { ChevronDown } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { horaLegible } from "@/lib/parametros";
import { parametros } from "@/server/parametros/consultas";

import {
  CabeceraSeccion,
  CONTENEDOR,
  SECCION,
} from "@/components/landing/piezas";

/**
 * Preguntas frecuentes.
 *
 * Con `<details>` y `<summary>` nativos en vez de un acordeón de React: el
 * navegador ya sabe plegar, anunciar el estado a un lector de pantalla y
 * permitir buscar dentro del texto cerrado. Un componente cliente aquí solo
 * añadiría JavaScript para reimplementar lo que ya funciona.
 */
export async function SeccionFaq() {
  const t = await getTranslations("landing");
  const p = await parametros();
  // El horario del comedor sale en alguna respuesta: se pasa a todas, y las que no lo usan lo ignoran.
  const horas = { apertura: horaLegible(p["comedor.apertura"]), cierre: horaLegible(p["comedor.cierre"]) };

  const preguntas = ["q1", "q2", "q3", "q4"];

  return (
    <section id="preguntas" className={SECCION}>
      <div className={CONTENEDOR}>
        <CabeceraSeccion titulo={t("faqTitle")} texto={t("faqEyebrow")} />

        <div className="mt-6 max-w-3xl divide-y divide-linea border-y border-linea">
          {preguntas.map((pregunta) => (
            <details key={pregunta} className="group">
              <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 py-4 font-semibold text-tinta focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                {t(`faq_${pregunta}_title`)}
                <ChevronDown className="ml-auto size-5 shrink-0 text-tinta-2 transition-transform group-open:rotate-180" />
              </summary>

              <p className="pb-5 leading-relaxed text-tinta-2">
                {t(`faq_${pregunta}_desc`, horas)}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
