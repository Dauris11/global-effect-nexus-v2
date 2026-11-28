import { Mail, Plus } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { ENTIDAD, type Idioma } from "@content/entidad";
import { CATEGORIAS_FAQ, FAQ_PORTAL } from "@content/faq-portal";

import { AnclaFaq, FiltroFaq } from "@/components/landing/faq-cliente";
import { CONTENEDOR, SECCION, TITULO_SECCION } from "@/components/landing/piezas";

/**
 * Preguntas frecuentes del portal.
 *
 * Con `<details>` y `<summary>` nativos: el navegador ya sabe plegar, anunciar
 * el estado y buscar dentro del texto cerrado. Todas las preguntas van en el HTML
 * del servidor; el buscador y los chips (`faq-cliente.tsx`) solo ocultan lo que
 * ya está, así que sin JavaScript la lista sigue completa.
 *
 * La misma fuente (`content/faq-portal.ts`) alimenta el JSON-LD `FAQPage`: el
 * texto que ve la persona y el que lee un buscador es idéntico.
 */
export async function SeccionFaq() {
  const locale = (await getLocale()) as Idioma;
  const t = await getTranslations("landingFaq");

  const preguntas = FAQ_PORTAL.map((p) => ({
    id: `faq-${p.id}`,
    categoria: p.categoria,
    pregunta: p.pregunta[locale],
    respuesta: p.respuesta[locale],
  }));

  // Datos estructurados: se serializa con `<` escapado para que un texto no pueda cerrar el `<script>`.
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: preguntas.map((p) => ({
      "@type": "Question",
      name: p.pregunta,
      acceptedAnswer: { "@type": "Answer", text: p.respuesta },
    })),
  }).replace(/</g, "\\u003c");

  return (
    <section id="preguntas" aria-labelledby="faq-titulo" className={SECCION}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <AnclaFaq />

      <div className={`${CONTENEDOR} grid gap-10 lg:grid-cols-12 lg:gap-16`}>
        {/* Columna fija: el titular y el buscador se quedan a la vista mientras se leen las respuestas. */}
        <div className="revelar lg:col-span-4">
          <div className="lg:sticky lg:top-28">
            <h2 id="faq-titulo" className={TITULO_SECCION}>
              {t("titulo")}
            </h2>
            <p className="mt-3 text-tinta-2">
              {t("ayuda")}{" "}
              <a
                href={`mailto:${ENTIDAD.correo}`}
                className="inline-flex items-center gap-1.5 rounded-control font-semibold text-marca-600 underline-offset-4 hover:text-marca-700 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <Mail aria-hidden className="size-4 shrink-0" />
                {ENTIDAD.correo}
              </a>
              .
            </p>

            <FiltroFaq
              categorias={CATEGORIAS_FAQ.map((c) => ({ id: c, etiqueta: t(`categorias.${c}`) }))}
              etiquetaTodas={t("todas")}
              etiquetaBuscar={t("buscarEtiqueta")}
              placeholder={t("buscarPlaceholder")}
            />
          </div>
        </div>

        <div className="lg:col-span-8">
          <div id="faq-lista" className="border-t border-linea">
            {preguntas.map((p, i) => (
              <details
                key={p.id}
                id={p.id}
                open={i === 0}
                data-faq=""
                data-categoria={p.categoria}
                // Texto ya junto para que el filtro no recorra el DOM de cada respuesta.
                data-texto={`${p.pregunta} ${p.respuesta}`}
                className="group scroll-mt-28 border-b border-linea transition-colors duration-700 data-resaltada:bg-marca-50"
              >
                <summary className="flex min-h-16 cursor-pointer list-none items-center gap-4 py-5 text-lg font-semibold text-tinta transition-colors hover:text-marca-700 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                  <h3 className="text-lg font-semibold">{p.pregunta}</h3>
                  <span className="ml-auto flex size-9 shrink-0 items-center justify-center rounded-full border border-linea text-tinta-2 transition-[rotate,background-color,border-color,color] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] group-open:rotate-45 group-open:border-tinta group-open:bg-tinta group-open:text-background">
                    <Plus aria-hidden className="size-4" />
                  </span>
                </summary>

                <div className="pr-12 pb-6">
                  <p className="max-w-2xl leading-relaxed text-tinta-2">{p.respuesta}</p>
                  <a
                    href={`#${p.id}`}
                    className="mt-3 inline-flex min-h-9 items-center rounded-control text-meta text-tinta-3 underline-offset-4 hover:text-tinta hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    {t("enlace")}
                  </a>
                </div>
              </details>
            ))}
          </div>

          {/* Oculto por defecto: lo muestra el filtro cuando ninguna pregunta coincide. */}
          <div id="faq-vacio" hidden className="rounded-card border border-linea px-6 py-10 text-center" role="status">
            <p className="font-semibold text-tinta">{t("vacioTitulo")}</p>
            <p className="mt-1 text-sm text-tinta-2">
              {t("vacioTexto")}{" "}
              <a href={`mailto:${ENTIDAD.correo}`} className="font-semibold text-marca-600 underline-offset-4 hover:underline">
                {ENTIDAD.correo}
              </a>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
