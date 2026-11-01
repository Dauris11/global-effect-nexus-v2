import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import type { DestinoPortal } from "@/components/landing/buscador-portal";
import { Footer } from "@/components/landing/footer";
import { Hero, type Diapositiva } from "@/components/landing/hero";
import { Navbar } from "@/components/landing/navbar";
import { SeccionAcceso } from "@/components/landing/seccion-acceso";
import { SeccionCifras } from "@/components/landing/seccion-cifras";
import { SeccionCierre } from "@/components/landing/seccion-cierre";
import { SeccionEventos } from "@/components/landing/seccion-eventos";
import { SeccionFaq } from "@/components/landing/seccion-faq";
import { SeccionMapa } from "@/components/landing/seccion-mapa";
import { SeccionNoticias } from "@/components/landing/seccion-noticias";
import { SeccionPatrocinadores } from "@/components/landing/seccion-patrocinadores";
import { SeccionProgramas } from "@/components/landing/seccion-programas";
import type { Locale } from "@/i18n/routing";
import {
  cifrasPublicas,
  diapositivasLanding,
  eventosPublicos,
  inscritosComidaHoy,
  noticiasPublicas,
} from "@/server/landing/consultas";

// Movimiento propio de la portada; el portal no lo carga.
import "@/components/landing/landing.css";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "landing" });

  return {
    title: t("heroTitle"),
    description: t("heroText"),
  };
}

/**
 * Página de inicio pública. No exige sesión.
 *
 * Los datos se leen en el servidor, en paralelo: son varias consultas
 * independientes y encadenarlas con `await` seguidos sumaría una ida y
 * vuelta al pooler por cada una para nada. Todas van cacheadas con la etiqueta
 * `TAG_LANDING`, así que la visita normal no toca la base; las acciones del
 * panel de administración tiran esa caché al publicar.
 *
 * Los textos se resuelven aquí y se pasan como props a los componentes
 * cliente. Es deliberado: el espacio `landing` son 10,3 KB de mensajes y
 * dárselos al proveedor los serializaría enteros en el HTML, cuando el hero, la
 * barra y el panel usan unas pocas cadenas.
 */
export default async function PaginaInicio({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "landing" });
  const tComun = await getTranslations({ locale, namespace: "common" });

  const idioma: Locale = locale === "en" ? "en" : "es";

  const [diapositivasBd, eventos, noticias, inscritos, cifras] =
    await Promise.all([
      diapositivasLanding(),
      eventosPublicos(12),
      noticiasPublicas(3),
      inscritosComidaHoy(),
      cifrasPublicas(),
    ]);

  /*
   * Los anuncios de la base mandan si administración ha publicado alguno; se
   * editan en `/configuracion/landing`. Cuando no hay ninguno activo se usan
   * las tres de `messages`, que están traducidas a los dos idiomas y
   * emparejadas con las imágenes de `public/`.
   *
   * El botón propio del anuncio solo se pasa si tiene texto Y enlace: con uno
   * de los dos vacío no hay botón que dibujar, y la acción que los guarda
   * admite dejarlos en blanco.
   */
  const IMAGENES = [
    "/hero-slide-1.webp",
    "/hero-slide-2.webp",
    "/hero-slide-3.webp",
  ];

  const diapositivas: Diapositiva[] =
    diapositivasBd.length > 0
      ? diapositivasBd.map((fila, indice) => ({
          titulo: fila.titulo,
          imagen: fila.imagen_url ?? IMAGENES[indice % IMAGENES.length],
          cta:
            fila.cta_texto && fila.cta_enlace
              ? { texto: fila.cta_texto, href: fila.cta_enlace }
              : undefined,
        }))
      : [
          { titulo: t("heroTitle"), imagen: IMAGENES[0] },
          { titulo: t("heroSlide2Title"), imagen: IMAGENES[1] },
          { titulo: t("heroSlide3Title"), imagen: IMAGENES[2] },
        ];

  /*
   * Secciones con ancla, en el orden en que aparecen. La barra y el pie leen
   * esta lista, así que nunca enlazan a un ancla que no esté en la página.
   *
   * "Noticias" solo entra si hay algo publicado: la sección se oculta sola
   * cuando no hay noticias y un enlace a un ancla inexistente no llevaría a
   * ninguna parte.
   */
  const secciones = [
    { ancla: "acceso", texto: t("navAccess") },
    { ancla: "que-hacemos", texto: t("navWork") },
    { ancla: "patrocinadores", texto: t("navSponsors") },
    { ancla: "eventos", texto: t("navEventos") },
    ...(noticias.length > 0
      ? [{ ancla: "noticias", texto: t("blogTitle") }]
      : []),
    { ancla: "preguntas", texto: t("navFaq") },
  ];

  /*
   * Destinos de la búsqueda-píldora. Son los mismos que ya ofrecía la landing
   * (las tres puertas y los accesos por rol): la píldora es otra forma de
   * llegar a ellos, no rutas nuevas.
   */
  const destinos: DestinoPortal[] = [
    { icono: "portal", titulo: t("access_portal_title"), texto: t("access_portal_desc"), href: "/login" },
    { icono: "comida", titulo: t("access_meals_title"), texto: t("access_meals_desc"), href: "/comida" },
    {
      icono: "solicitudes",
      titulo: t("access_requests_title"),
      texto: t("access_requests_desc"),
      href: "/portal/estudiante/solicitudes",
    },
  ];
  const roles: DestinoPortal[] = [
    { icono: "estudiantes", titulo: t("role_students"), href: "/login" },
    { icono: "profesores", titulo: t("role_teachers"), href: "/login" },
    { icono: "administracion", titulo: t("role_admin"), href: "/login" },
    { icono: "contabilidad", titulo: t("role_accounting"), href: "/login" },
  ];

  return (
    // 16 px de cuerpo en la landing (docs/09 §2.4); el portal se queda en 15.
    <div className="text-base">
      <Navbar
        enlaces={secciones}
        destinos={destinos}
        roles={roles}
        textos={{
          comida: t("navMealsShort"),
          acceder: t("enter"),
          abrirMenu: t("menuOpen"),
          cerrarMenu: t("menuClose"),
          secciones: t("menuSections"),
          pregunta: t("searchPill"),
          ayuda: t("searchPillHint"),
          porRol: t("accessRolesTitle"),
          logo: tComun("foundation"),
        }}
      />

      <main>
        <Hero
          diapositivas={diapositivas}
          accion={{ texto: t("heroCta"), href: "/login" }}
          etiquetaAnterior={t("heroPrev")}
          etiquetaSiguiente={t("heroNext")}
          etiquetaCarrusel={t("heroCarousel")}
        />

        {/*
          Las puertas van inmediatamente después del hero. Esta es una
          plataforma de gestión, no un folleto: quien llega casi siempre viene a
          entrar a su portal, y tenerlo al final obligaba a recorrer siete
          secciones para hacer lo único que casi todo el mundo viene a hacer.
          Lo que cuenta la Fundación —programas, patrocinadores, eventos— va
          después, para quien sí llega a leer.

          Aquí había tres secciones seguidas: las puertas, el panel "Ahora
          mismo" y la barra de cifras. Son una sola desde este cambio, con el
          estado del comedor dentro de la puerta que lleva a inscribirse.
        */}
        {/* Las cifras, justo bajo la foto: lo primero que se lee después del
            titular es cuánta gente hay detrás, no un texto sobre ella. */}
        <SeccionCifras cifras={cifras} inscritosHoy={inscritos} locale={idioma} />

        <SeccionAcceso inscritosHoy={inscritos} />

        <SeccionProgramas />

        {/*
          "Dónde estamos" va entre lo que hace la Fundación y la petición a los
          patrocinadores, porque es lo que enlaza a los dos: el arco del globo
          va de quien aporta a donde se gasta.

          No entra en `secciones`, así que no añade enlace al menú ni al pie: es
          un puente entre dos secciones, no un destino. Se encuentra bajando,
          que es como se lee el resto de la página.
        */}
        <SeccionMapa />

        <SeccionPatrocinadores />

        <SeccionEventos eventos={eventos} locale={idioma} />

        <SeccionNoticias noticias={noticias} locale={idioma} />

        <SeccionFaq />

        {/* La acción otra vez, para que bajar hasta el final no acabe en el
            pie sin nada que pulsar. */}
        <SeccionCierre />
      </main>

      <Footer secciones={secciones} />
    </div>
  );
}
