import Image from "next/image";
import { Newspaper } from "lucide-react";
import { getTranslations } from "next-intl/server";

import {
  CabeceraSeccion,
  Carrusel,
  CONTENEDOR,
  ElementoCarrusel,
  SECCION,
  TarjetaAnuncio,
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

  return (
    <section id="noticias" className={SECCION}>
      <div className={CONTENEDOR}>
        <CabeceraSeccion titulo={t("blogTitle")} />

        <div className="mt-8">
          <Carrusel etiqueta={t("blogTitle")}>
            {noticias.map((noticia) => (
              <ElementoCarrusel key={noticia.id}>
                <TarjetaAnuncio
                  cabecera={<Portada url={noticia.imagen_url} />}
                  insignia={
                    <Badge variant="neutra" className="bg-background/95 shadow-card">
                      {t("blogTagNews")}
                    </Badge>
                  }
                  titulo={noticia.titulo}
                  pie={
                    <p className="texto-meta">
                      {fechaLarga(noticia.fecha, locale)}
                      {noticia.autor ? ` · ${noticia.autor}` : ""}
                    </p>
                  }
                />
              </ElementoCarrusel>
            ))}
          </Carrusel>
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
        <Newspaper className="size-12 text-tinta-3" />
      </div>
    );
  }

  if (url.startsWith("/")) {
    return (
      <Image
        src={url}
        alt=""
        fill
        sizes="(max-width: 768px) 80vw, 400px"
        className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className="absolute inset-0 size-full object-cover" />
  );
}
