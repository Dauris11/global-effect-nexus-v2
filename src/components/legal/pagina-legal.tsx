import { getTranslations } from "next-intl/server";
import { TriangleAlert } from "lucide-react";

import { ENTIDAD } from "@content/entidad";

type Clave = "privacidad" | "terminos" | "cookies";
type Seccion = { titulo: string; texto: string };

/**
 * Cuerpo de las tres páginas legales. Los textos viven en `messages/*.json`
 * (espacio `legal`) y la estructura es la misma, así que una sola pieza las pinta.
 *
 * El aviso «Pendiente de revisión legal» es parte de la página, no un comentario:
 * son borradores y no deben pasar por definitivos mientras un abogado no los revise.
 */
export async function PaginaLegal({ clave, locale }: { clave: Clave; locale: string }) {
  const t = await getTranslations({ locale, namespace: "legal" });
  const secciones = Object.values(t.raw(`${clave}.secciones`) as Record<string, Seccion>);

  return (
    <article>
      <p className="inline-flex items-center gap-2 rounded-full border border-linea-fuerte px-3 py-1 text-meta font-semibold text-tinta-2">
        <TriangleAlert aria-hidden className="size-3.5" />
        {t("borrador")}
      </p>

      <h1 className="mt-4 text-page font-semibold tracking-tight text-tinta">{t(`${clave}.titulo`)}</h1>
      <p className="mt-2 text-meta text-tinta-3">{t("actualizado")}</p>
      <p className="mt-6 text-tinta-2">{t(`${clave}.intro`)}</p>

      <p role="note" className="mt-6 rounded-card border border-linea bg-muted p-4 text-sm text-tinta-2">
        {t("borradorAviso")}
      </p>

      {secciones.map((seccion, i) => (
        <section key={seccion.titulo} className="mt-10">
          <h2 className="text-section font-semibold text-tinta">
            {i + 1}. {seccion.titulo}
          </h2>
          <p className="mt-2 leading-relaxed text-tinta-2">{seccion.texto}</p>
        </section>
      ))}

      <section className="mt-10 border-t border-linea pt-8">
        <h2 className="text-section font-semibold text-tinta">{t("contactoTitulo")}</h2>
        <p className="mt-2 text-tinta-2">
          {t("contactoTexto")}{" "}
          <a
            href={`mailto:${ENTIDAD.correo}`}
            className="rounded-control font-semibold text-marca-600 underline-offset-4 hover:text-marca-700 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {ENTIDAD.correo}
          </a>
          .
        </p>
      </section>
    </article>
  );
}
