/**
 * Ficha de entidad: la única fuente de los datos de la Fundación. De aquí salen
 * los metadatos, el JSON-LD, el pie, el mapa y `llms.txt`, así que el nombre, el
 * correo y la ciudad no pueden divergir entre lo que ve una persona y lo que lee
 * un buscador o un asistente de IA (consistencia NAP).
 *
 * Lo que vale `null`, `[]` o `provisional: true` está pendiente del cliente y NO
 * entra en el JSON-LD: un dato inventado en el schema es peor que uno ausente.
 * Las coordenadas actuales son solo el centro de La Vega; mientras `geo.provisional`
 * sea `true` se dibujan en el mapa pero no se publican como `Place`.
 *
 * Los campos `latitud`, `longitud` y `correo`, y `pais` como objeto bilingüe, se
 * conservan porque el mapa, el pie y las páginas legales ya los leen; `pais.codigo`
 * es el ISO-3166 que pide el schema. Cuando esos componentes migren a `geo` y
 * `email`, se retiran.
 */
const GEO = { lat: 19.2221, lng: -70.5296, provisional: true as boolean };

export const ENTIDAD = {
  nombre: "Fundación Global Effect",
  portal: "Portal Global Effect",
  descripcionCorta:
    "Plataforma de la Fundación Global Effect para estudiantes, docentes y equipo en La Vega, República Dominicana.",
  email: "info@globaleffect.org",
  ciudad: "La Vega",
  region: "La Vega",
  pais: { codigo: "DO", es: "República Dominicana", en: "Dominican Republic" },
  /** Calle y número; `null` = pendiente del cliente. */
  direccion: null as string | null,
  geo: GEO,
  /** Teléfono en formato internacional; `null` = pendiente del cliente. */
  telefono: null as string | null,
  /** Horario de atención; `null` = pendiente del cliente. */
  horario: null as { es: string; en: string } | null,
  /** Perfiles oficiales (redes, directorios); vacío = pendiente del cliente. */
  sameAs: [] as string[],
  /** Dominio definitivo; sin definir mientras el sitio viva en *.vercel.app. */
  dominio: process.env.NEXT_PUBLIC_SITE_URL,

  // Alias de compatibilidad (ver nota arriba).
  latitud: GEO.lat,
  longitud: GEO.lng,
  correo: "info@globaleffect.org",
  provisional: GEO.provisional,
};

export type Idioma = "es" | "en";

/**
 * URL base sin barra final. Sin dominio definitivo cae al despliegue de Vercel y,
 * en local, a localhost: así los canónicos y el sitemap siempre son absolutos.
 * `dominioDefinitivo()` dice si es el real, que es lo que decide si se indexa.
 */
export function urlSitio(): string {
  const base =
    ENTIDAD.dominio ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
    "http://localhost:3000";

  return base.replace(/\/+$/, "");
}

export function dominioDefinitivo(): boolean {
  try {
    return !!ENTIDAD.dominio && !new URL(ENTIDAD.dominio).hostname.endsWith(".vercel.app");
  } catch {
    return false;
  }
}

/** Ruta absoluta en un idioma: el español no lleva prefijo (`localePrefix: as-needed`). */
export function urlLocalizada(ruta: string, idioma: Idioma): string {
  const limpia = ruta === "/" ? "" : ruta;

  return `${urlSitio()}${idioma === "en" ? "/en" : ""}${limpia}` || urlSitio();
}
