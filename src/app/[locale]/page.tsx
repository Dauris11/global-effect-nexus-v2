import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ENTIDAD, urlLocalizada, urlSitio, type Idioma } from "@content/entidad";

import { Footer } from "@/components/landing/footer";
import { Hero } from "@/components/landing/hero";
import { Navbar } from "@/components/landing/navbar";
import { CabeceraPregunta, CONTENEDOR } from "@/components/landing/piezas";
import { SeccionAcceso } from "@/components/landing/seccion-acceso";
import { SeccionFaq } from "@/components/landing/seccion-faq";
import { SeccionMapa } from "@/components/landing/seccion-mapa";
import { SeccionPasos } from "@/components/landing/seccion-pasos";
import {
  SeccionPerfiles,
  type Perfil,
  type TextosPerfiles,
} from "@/components/landing/seccion-perfiles";

import { jsonLdInicio } from "@/lib/seo/json-ld-inicio";

// Movimiento propio de la portada; el portal no lo carga.
import "@/components/landing/landing.css";

/**
 * Se regenera cada minuto: el estado del comedor («Abierta hasta las…» o
 * «Cerrada · abre a las…») se calcula en el servidor con la hora de La Vega y
 * tiene que cambiar solo al llegar la apertura o el cierre. Un minuto de desfase
 * en un horario de comedor no importa; recalcular en cada visita sí costaría.
 */
export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "seo" });
  const idioma = (locale === "en" ? "en" : "es") as Idioma;
  const url = urlLocalizada("/", idioma);

  return {
    title: { absolute: t("title") },
    description: t("description"),
    // El canónico apunta siempre al dominio definitivo, también si se entra por *.vercel.app.
    alternates: {
      canonical: url,
      languages: { "es-DO": urlLocalizada("/", "es"), "en-DO": urlLocalizada("/", "en"), "x-default": urlLocalizada("/", "es") },
    },
    openGraph: {
      type: "website",
      siteName: ENTIDAD.portal,
      locale: idioma === "en" ? "en_US" : "es_DO",
      url,
      title: t("title"),
      description: t("description"),
      // Se declara explícita: el archivo `opengraph-image` de la raíz no hereda a esta ruta con `[locale]`.
      images: [{ url: `${urlSitio()}/opengraph-image`, width: 1200, height: 630, alt: t("ogAlt") }],
    },
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("description"),
      images: [`${urlSitio()}/opengraph-image`],
    },
  };
}

/**
 * La landing es la puerta del PORTAL, no de la Fundación: responde qué es, quién
 * entra, cómo se entra, qué se puede hacer y dónde queda. No lleva cifras ni
 * contenido institucional (programas, trazabilidad, eventos, noticias); eso vive
 * en el sitio de la Fundación.
 *
 * Cada sección abre con su pregunta como H2 y la responde en la primera línea.
 * Todos los textos son de servidor: la definición, el H1, los H2 y los pasos
 * están en el HTML sin necesitar JavaScript.
 *
 * Los textos de las pestañas se resuelven aquí y se pasan como props: el
 * componente cliente no necesita todo el espacio `landing`, que se serializaría
 * entero al navegador.
 */
export default async function PaginaInicio({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Sin esto next-intl lee el idioma de las cabeceras de la petición y la página se vuelve dinámica.
  setRequestLocale(locale);
  const idioma = locale === "en" ? "en" : "es";
  const t = await getTranslations({ locale, namespace: "landing" });
  const tSeo = await getTranslations({ locale, namespace: "seo" });
  const tComun = await getTranslations({ locale, namespace: "common" });

  // Las anclas, en el orden de la página. La barra y el pie leen esta lista, así
  // que nunca enlazan a un ancla que no exista.
  const secciones = [
    { ancla: "accesos", texto: t("navAccesos") },
    { ancla: "perfiles", texto: t("navPerfiles") },
    { ancla: "preguntas", texto: t("navFaq") },
    { ancla: "ubicacion", texto: t("navUbicacion") },
  ];

  const datosPerfil = (perfil: Perfil): TextosPerfiles["perfiles"][Perfil] => ({
    nombre: t(`profileTab_${perfil}`),
    acciones: [1, 2, 3, 4].map((n) => ({
      titulo: t(`p_${perfil}_${n}_t`),
      detalle: t(`p_${perfil}_${n}_d`),
    })),
    vista: [1, 2, 3].map((n) => ({
      titulo: t(`v_${perfil}_${n}_t`),
      estado: t(`v_${perfil}_${n}_s`),
    })),
  });

  const textosPerfiles: TextosPerfiles = {
    pestanas: t("profilesTabs"),
    vista: t("previewTitle"),
    perfiles: { est: datosPerfil("est"), doc: datosPerfil("doc"), eq: datosPerfil("eq") },
  };

  return (
    // 16 px de cuerpo en la landing (docs/09 §2.4); el portal se queda en 15.
    <div className="text-base">
      {/* Un solo grafo; se escapa `<` para que un texto no pueda cerrar el script. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            jsonLdInicio(idioma, {
              appName: tSeo("appName"),
              titulo: tSeo("title"),
              descripcion: tSeo("description"),
              audienciaEstudiantes: tSeo("audienciaEstudiantes"),
              audienciaDocentes: tSeo("audienciaDocentes"),
              audienciaPersonal: tSeo("audienciaPersonal"),
              areaServida: tSeo("areaServida"),
            }),
          ).replace(/</g, "\\u003c"),
        }}
      />
      <Navbar
        enlaces={secciones}
        textos={{
          acceder: t("enterPortal"),
          accederCorto: t("enterShort"),
          logo: tComun("foundation"),
          principal: t("navMain"),
          tema: t("themeLabel"),
          temas: {
            claro: t("themeLight"),
            oscuro: t("themeDark"),
            sistema: t("themeSystem"),
          },
        }}
      />

      <main>
        <Hero />

        <SeccionAcceso idioma={idioma} />

        <section id="perfiles" aria-labelledby="perfiles-titulo" className="scroll-mt-24 py-16 md:py-24">
          <div className={CONTENEDOR}>
            <CabeceraPregunta
              id="perfiles-titulo"
              etiqueta={t("profilesTag")}
              titulo={t("profilesTitle")}
              respuesta={t("profilesLead")}
            />
            <SeccionPerfiles textos={textosPerfiles} />
          </div>
        </section>

        <SeccionPasos />

        <SeccionFaq />

        <SeccionMapa />
      </main>

      <Footer secciones={secciones} />
    </div>
  );
}
