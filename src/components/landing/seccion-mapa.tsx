import { readFile } from "node:fs/promises";
import path from "node:path";

import { Clock, Mail, MapPin, Navigation } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { ENTIDAD, type Idioma } from "@content/entidad";

import { BotonCopiar, MapaAnimado, MapaInteractivo } from "@/components/landing/mapa-cliente";
import { CONTENEDOR, SECCION, TITULO_SECCION } from "@/components/landing/piezas";
import { variantesBoton } from "@/components/ui/button-variantes";

/**
 * El SVG del mapa se lee una vez por proceso. Va en línea y no como `<img>`
 * porque un `<img>` no puede heredar los tokens de color: en modo oscuro el
 * mapa se quedaría con los colores del claro.
 */
let svgBase: Promise<string> | undefined;

function leerMapa() {
  svgBase ??= readFile(path.join(process.cwd(), "public/media/landing/mapa-rd.svg"), "utf8");

  return svgBase;
}

/**
 * Prepara el SVG para pegarlo en la página:
 * - quita el manifiesto C2PA (metadatos del generador, miles de caracteres inútiles);
 * - quita los colores de respaldo `#xxxxxx` de `var(--map-*, …)`: los tokens de
 *   `globals.css` son la única fuente de color;
 * - renombra los `id` del título y la descripción, que como `t` y `d` chocarían
 *   con cualquier otro SVG en línea de la página;
 * - cambia el pin por uno animable con tokens, y traduce título y descripción.
 */
function prepararMapa(svg: string, titulo: string, descripcion: string, nombres: { santoDomingo: string; santiago: string; pin: string }) {
  const [x, y] = [322.1, 190.2];

  return svg
    .replace(/<metadata>[\s\S]*?<\/metadata>/, "")
    .replace(/\s+xmlns:c2pa="[^"]*"/, "")
    .replace(/(var\(--map-[a-z]+),#[0-9a-fA-F]{3,8}\)/g, "$1)")
    .replace('aria-labelledby="t d"', 'aria-labelledby="mapa-t mapa-d" class="h-auto w-full"')
    .replace(/<title id="t">[^<]*<\/title>/, `<title id="mapa-t">${titulo}</title>`)
    .replace(/<desc id="d">[^<]*<\/desc>/, `<desc id="mapa-d">${descripcion}</desc>`)
    .replace(">Santo Domingo<", `>${nombres.santoDomingo}<`)
    .replace(">Santiago<", `>${nombres.santiago}<`)
    .replace(
      /<g class="map-pin"[\s\S]*?<\/g>/,
      `<g transform="translate(${x} ${y})"><circle class="mapa-pulso" r="10" fill="var(--map-pin)" opacity=".35"/><g class="mapa-cae"><circle r="7" fill="var(--map-pin)" stroke="var(--map-pin-borde)" stroke-width="3"/></g></g>`,
    )
    .replace(/(<text[^>]*font-weight="700"[^>]*>)La Vega(<\/text>)/, `$1${nombres.pin}$2`);
}

/**
 * Sección de ubicación: el mapa del país con el pin de La Vega y una tarjeta
 * con lo que hace falta para llegar. Datos desde `content/entidad.ts`.
 *
 * No hay iframe de Google Maps en la carga: el mapa propio responde a «¿dónde
 * queda?» y el interactivo se carga solo si la persona lo pide.
 */
export async function SeccionMapa() {
  const locale = (await getLocale()) as Idioma;
  const t = await getTranslations("landingMapa");

  const svg = prepararMapa(await leerMapa(), t("mapaTitulo"), t("mapaDescripcion"), {
    santoDomingo: t("santoDomingo"),
    santiago: t("santiago"),
    pin: t("etiquetaPin"),
  });

  const coordenadas = `${ENTIDAD.latitud},${ENTIDAD.longitud}`;
  const ciudadPais = `${ENTIDAD.ciudad}, ${ENTIDAD.pais[locale]}`;
  const horario = ENTIDAD.horario?.[locale] ?? null;
  // El aviso de «pendiente» es interno: el visitante de producción nunca lo ve.
  const mostrarPendiente = ENTIDAD.provisional && process.env.NODE_ENV !== "production";

  return (
    <section id="ubicacion" aria-labelledby="ubicacion-titulo" className={SECCION}>
      <div className={CONTENEDOR}>
        <div className="revelar max-w-2xl">
          <h2 id="ubicacion-titulo" className={TITULO_SECCION}>
            {t("titulo")}
          </h2>
          <p className="mt-3 text-tinta-2">{t("resumen")}</p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-12">
          <MapaAnimado className="revelar rounded-card border border-linea bg-card p-4 shadow-card md:p-6 lg:col-span-7">
            <div dangerouslySetInnerHTML={{ __html: svg }} />
          </MapaAnimado>

          <div className="revelar flex flex-col gap-5 rounded-card border border-linea bg-card p-6 shadow-card lg:col-span-5">
            <h3 className="text-section font-semibold text-tinta">{ENTIDAD.nombre}</h3>

            <Fila icono={<MapPin aria-hidden className="size-5" />} etiqueta={t("direccion")}>
              {(ENTIDAD.direccion || mostrarPendiente) && (
                <p className="text-tinta">
                  {ENTIDAD.direccion ?? t("direccionPendiente")}
                  {mostrarPendiente && !ENTIDAD.direccion && <Pendiente>{t("pendiente")}</Pendiente>}
                </p>
              )}
              <p className="text-sm text-tinta-2">{ciudadPais}</p>
              <div className="mt-1 -ml-3">
                <BotonCopiar
                  texto={ENTIDAD.direccion ? `${ENTIDAD.direccion}, ${ciudadPais}` : ciudadPais}
                  etiqueta={t("copiar")}
                  etiquetaCopiada={t("copiada")}
                />
              </div>
            </Fila>

            {(horario || mostrarPendiente) && (
              <Fila icono={<Clock aria-hidden className="size-5" />} etiqueta={t("horario")}>
                <p className="text-tinta">
                  {horario ?? t("horarioPendiente")}
                  {mostrarPendiente && !horario && <Pendiente>{t("pendiente")}</Pendiente>}
                </p>
              </Fila>
            )}

            <Fila icono={<Mail aria-hidden className="size-5" />} etiqueta={t("correo")}>
              <a
                href={`mailto:${ENTIDAD.correo}`}
                className="rounded-control font-semibold text-marca-600 underline-offset-4 hover:text-marca-700 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {ENTIDAD.correo}
              </a>
            </Fila>

            <div className="mt-auto flex flex-wrap gap-3 pt-2">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${coordenadas}`}
                target="_blank"
                rel="noopener noreferrer"
                className={variantesBoton({ variant: "primary", size: "lg" })}
              >
                <Navigation />
                {t("comoLlegar")}
              </a>
              <a
                href={`https://waze.com/ul?ll=${coordenadas}&navigate=yes`}
                target="_blank"
                rel="noopener noreferrer"
                className={variantesBoton({ variant: "secondary", size: "lg" })}
              >
                {t("waze")}
              </a>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <MapaInteractivo
            latitud={ENTIDAD.latitud}
            longitud={ENTIDAD.longitud}
            etiqueta={t("verMapa")}
            titulo={t("mapaInteractivo")}
          />
        </div>
      </div>
    </section>
  );
}

function Fila({ icono, etiqueta, children }: { icono: React.ReactNode; etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 shrink-0 text-marca-600">{icono}</span>
      <div className="min-w-0">
        <p className="text-meta font-semibold text-tinta-3">{etiqueta}</p>
        {children}
      </div>
    </div>
  );
}

/** Etiqueta solo de desarrollo: marca lo que aún no entregó el cliente. */
function Pendiente({ children }: { children: React.ReactNode }) {
  return <span className="ml-2 rounded-full border border-linea-fuerte px-2 py-0.5 text-meta font-medium text-tinta-2">{children}</span>;
}
