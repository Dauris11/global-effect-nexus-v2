import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

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
  const t = await getTranslations({ locale, namespace: "landing" });

  return {
    title: t("heroTitle"),
    description: t("heroDefinition"),
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
  const idioma = locale === "en" ? "en" : "es";
  const t = await getTranslations({ locale, namespace: "landing" });
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
