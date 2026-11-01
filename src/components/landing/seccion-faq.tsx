import { Mail, Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { horaLegible } from "@/lib/parametros";
import { parametros } from "@/server/parametros/consultas";

import {
  CONTENEDOR,
  SECCION,
  TITULO_SECCION,
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
  const correo = p["contacto.correo"];
  const horas = { apertura: horaLegible(p["comedor.apertura"]), cierre: horaLegible(p["comedor.cierre"]) };

  const preguntas = ["q1", "q2", "q3", "q4"];

  return (
    <section id="preguntas" className={`${SECCION} landing-faq`}>
      {/*
        Titular a la izquierda y preguntas a la derecha: en una sola columna el
        bloque ocupaba media pantalla de ancho y dejaba la otra media vacía.
        En escritorio el titular se queda pegado mientras se leen las
        respuestas, con el correo a mano para lo que no esté aquí.
      */}
      <div className={`${CONTENEDOR} grid gap-10 lg:grid-cols-12 lg:gap-16`}>
        <div className="revelar lg:col-span-4">
          <div className="lg:sticky lg:top-28">
            <h2 className={TITULO_SECCION}>{t("faqTitle")}</h2>
            <a
              href={`mailto:${correo}`}
              className="group mt-3 inline-flex min-h-11 items-center gap-2 rounded-control font-semibold text-marca-600 transition-colors hover:text-marca-700 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <Mail className="size-4 shrink-0" />
              <span className="break-all">{correo}</span>
            </a>
          </div>
        </div>

        <div className="revelar-hijos border-t border-linea lg:col-span-8">
          {preguntas.map((pregunta) => (
            <details key={pregunta} className="group border-b border-linea">
              <summary className="flex min-h-16 cursor-pointer list-none items-center gap-4 py-5 text-lg font-semibold text-tinta transition-colors hover:text-marca-700 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                {t(`faq_${pregunta}_title`)}
                <span className="ml-auto flex size-9 shrink-0 items-center justify-center rounded-full border border-linea text-tinta-2 transition-[rotate,background-color,border-color,color] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] group-open:rotate-45 group-open:border-tinta group-open:bg-tinta group-open:text-background">
                  <Plus className="size-4" />
                </span>
              </summary>

              <p className="max-w-2xl pr-12 pb-6 leading-relaxed text-tinta-2">
                {t(`faq_${pregunta}_desc`, horas)}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
