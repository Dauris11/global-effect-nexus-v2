import { ENTIDAD, urlLocalizada, urlSitio, type Idioma } from "@content/entidad";
import { FAQ_PORTAL } from "@content/faq-portal";

type Textos = {
  appName: string;
  descripcion: string;
  audienciaEstudiantes: string;
  audienciaDocentes: string;
  audienciaPersonal: string;
  areaServida: string;
  titulo: string;
};

/**
 * Un solo `@graph` para `/`: organización, sitio, aplicación, página y FAQ.
 * Todo con `@id` para que los nodos se referencien entre sí en vez de repetirse.
 *
 * Solo entra lo visible y lo confirmado: dirección de calle, teléfono, horario,
 * `sameAs` y `Place` con coordenadas se omiten mientras la ficha los tenga en
 * `null`, vacíos o `provisional` (un dato falso en el schema se cita en IA).
 */
export function jsonLdInicio(idioma: Idioma, t: Textos) {
  const base = urlSitio();
  const org = `${base}/#organization`;
  const app = `${base}/#webapp`;
  const faq = `${urlLocalizada("/", idioma)}#faq`;
  const lang = idioma === "en" ? "en-DO" : "es-DO";
  const pais = ENTIDAD.pais[idioma];

  const direccion = {
    "@type": "PostalAddress",
    ...(ENTIDAD.direccion ? { streetAddress: ENTIDAD.direccion } : {}),
    addressLocality: ENTIDAD.ciudad,
    addressRegion: ENTIDAD.region,
    addressCountry: ENTIDAD.pais.codigo,
  };

  const organizacion = {
    "@type": "NGO",
    "@id": org,
    name: ENTIDAD.nombre,
    url: base,
    logo: `${base}/icon-512.png`,
    description: ENTIDAD.descripcionCorta,
    email: ENTIDAD.email,
    address: direccion,
    areaServed: t.areaServida,
    ...(ENTIDAD.telefono ? { telephone: ENTIDAD.telefono } : {}),
    ...(ENTIDAD.sameAs.length ? { sameAs: ENTIDAD.sameAs } : {}),
  };

  const lugar = ENTIDAD.geo.provisional
    ? []
    : [
        {
          "@type": "Place",
          "@id": `${base}/#place`,
          name: ENTIDAD.nombre,
          address: direccion,
          geo: { "@type": "GeoCoordinates", latitude: ENTIDAD.geo.lat, longitude: ENTIDAD.geo.lng },
          containedInPlace: { "@type": "AdministrativeArea", name: `${ENTIDAD.ciudad}, ${pais}` },
        },
      ];

  return {
    "@context": "https://schema.org",
    "@graph": [
      organizacion,
      {
        "@type": "WebSite",
        "@id": `${base}/#website`,
        url: base,
        name: t.appName,
        publisher: { "@id": org },
        inLanguage: lang,
      },
      {
        "@type": "WebApplication",
        "@id": app,
        name: t.appName,
        url: `${base}/login`,
        applicationCategory: "EducationalApplication",
        operatingSystem: "Web",
        provider: { "@id": org },
        isAccessibleForFree: true,
        inLanguage: lang,
        audience: [t.audienciaEstudiantes, t.audienciaDocentes, t.audienciaPersonal].map((audienceType) => ({
          "@type": "EducationalAudience",
          audienceType,
        })),
      },
      {
        "@type": "WebPage",
        "@id": `${urlLocalizada("/", idioma)}#webpage`,
        url: urlLocalizada("/", idioma),
        name: t.titulo,
        description: t.descripcion,
        inLanguage: lang,
        isPartOf: { "@id": `${base}/#website` },
        about: { "@id": app },
        mainEntity: { "@id": faq },
      },
      {
        "@type": "FAQPage",
        "@id": faq,
        inLanguage: lang,
        mainEntity: FAQ_PORTAL.map((p) => ({
          "@type": "Question",
          name: p.pregunta[idioma],
          acceptedAnswer: { "@type": "Answer", text: p.respuesta[idioma] },
        })),
      },
      ...lugar,
    ],
  };
}
