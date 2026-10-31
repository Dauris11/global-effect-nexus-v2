import Image from "next/image";
import { Newspaper } from "lucide-react";
import { getTranslations } from "next-intl/server";

import {
  CabeceraSeccion,
  CONTENEDOR,
  SECCION,
} from "@/components/landing/piezas";
import { Badge } from "@/components/ui/badge";
import { fechaLarga } from "@/lib/fechas";
import type { Locale } from "@/i18n/routing";
import type { NoticiaPublica } from "@/server/landing/consultas";

/**
 * Noticias y actividades ya celebradas.
 *
 * La sección desaparece entera si no hay nada publicado: un titular "Noticias"
 * sobre un hueco vacío da peor impresión que no tener la sección.
 *
 * Solo llegan aquí las filas con `publicada = true`; el filtro está en la
 * consulta, así que un borrador no puede colarse por descuido.
 */
export async function SeccionNoticias({
  noticias,
  locale,
}: {
  noticias: readonly NoticiaPublica[];
  locale: Locale;
}) {
  if (noticias.length === 0) return null;

  const t = await getTranslations("landing");
  const [destacada, ...resto] = noticias;

  return (
    <section id="noticias" className={SECCION}>
      <div className={CONTENEDOR}>
        <CabeceraSeccion titulo={t("blogTitle")} />

        {/*
          La más reciente, grande y con su resumen; las demás, en filas con
          miniatura al lado. Tres tarjetas iguales decían que las tres noticias
          pesaban lo mismo, y la de esta semana casi siempre pesa más.
        */}
        <div className="revelar-hijos mt-10 grid gap-10 lg:grid-cols-12 lg:gap-12">
          <article className="lg:col-span-7">
            <div className="relative aspect-[16/10] overflow-hidden rounded-card bg-muted">
              <Portada url={destacada.imagen_url} />
              <div className="absolute top-3 left-3 z-10">
                <Badge variant="neutra" className="bg-background/95 shadow-card">
                  {t("blogTagNews")}
                </Badge>
              </div>
            </div>
            <p className="texto-meta mt-5">
              {fechaLarga(destacada.fecha, locale)}
              {destacada.autor ? ` · ${destacada.autor}` : ""}
            </p>
            <h3 className="mt-2 text-2xl leading-tight font-semibold tracking-[-0.02em] text-balance text-tinta md:text-[28px]">
              {destacada.titulo}
            </h3>
            {destacada.resumen && (
              <p className="mt-3 line-clamp-3 max-w-2xl leading-relaxed text-tinta-2">
                {destacada.resumen}
              </p>
            )}
          </article>

          {resto.length > 0 && (
            <ul className="flex flex-col gap-6 lg:col-span-5">
              {resto.map((noticia) => (
                <li key={noticia.id} className="flex gap-4 border-t border-linea pt-6 first:border-t-0 first:pt-0">
                  <div className="relative aspect-square w-24 shrink-0 overflow-hidden rounded-control bg-muted md:w-32">
                    <Portada url={noticia.imagen_url} />
                  </div>
                  <div className="min-w-0">
                    <p className="texto-meta">{fechaLarga(noticia.fecha, locale)}</p>
                    <h3 className="mt-1 line-clamp-3 text-lg leading-snug font-semibold text-tinta">
                      {noticia.titulo}
                    </h3>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * Portada de la noticia.
 *
 * `next/image` solo acepta hosts declarados en `remotePatterns`, y una URL
 * externa sin declarar hace fallar la petición entera. Como `noticia.imagen_url`
 * es texto libre que escribe administración, se distingue: las rutas locales van
 * optimizadas, y una URL externa se sirve con una etiqueta normal para que se
 * vea igualmente en lugar de tumbar la página.
 */
function Portada({ url }: { url: string | null }) {
  if (!url) {
    // Sin imagen, un marcador sobrio: mejor que estirar una foto ajena.
    return (
      <div className="flex size-full items-center justify-center">
        <Newspaper className="size-10 text-tinta-3" />
      </div>
    );
  }

  if (url.startsWith("/")) {
    return (
      <Image
        src={url}
        alt=""
        fill
        sizes="(max-width: 1024px) 100vw, 720px"
        className="object-cover"
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      className="absolute inset-0 size-full object-cover"
    />
  );
}
