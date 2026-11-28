import { getImageProps } from "next/image";
import { ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { HeroMedia } from "@/components/landing/hero-media";
import { CONTENEDOR } from "@/components/landing/piezas";
import { variantesBoton } from "@/components/ui/button-variantes";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * Hero de la portada: dice en una frase qué es el portal y a quién sirve.
 *
 * Es lo ÚNICO que lleva `<h1>` en la página. Debajo va la definición completa
 * («El Portal Global Effect es la plataforma donde…»), escrita para que un
 * buscador o un asistente de IA la pueda citar tal cual: sujeto, verbo y lo que
 * se puede hacer, en una sola oración.
 *
 * El texto es de servidor y se ve sin JavaScript. Las palabras del titular
 * entran escalonadas con CSS (`landing-palabra`), que solo se aplica si no se
 * pidió «reducir movimiento»; si no corre, el texto ya está en su sitio.
 *
 * Media: en el móvil una imagen fija; en escritorio la misma imagen hace de
 * póster mientras `HeroVideo` decide si monta el video (ver ese archivo). El
 * video original dura 6 minutos y pesa 130 MB, por eso aquí solo vive el tramo
 * de 12 s recortado y sin audio (`public/media/landing/`).
 *
 * El velo es el único degradado del sistema (excepción pedida por la Fundación): solo sirve para
 * que el blanco se lea ≥ 4,5:1 sobre cualquier fotograma, en claro y en oscuro por igual.
 */
export async function Hero() {
  const t = await getTranslations("landing");

  // Dirección de arte: en móvil la foto del edificio (optimizada por Next: AVIF/WebP, calidad 72, con
  // `object-position` para que el edificio quede a la vista en 390×560); en escritorio el póster, que
  // es el LCP, mientras `HeroMedia` decide si monta el video.
  const { props: movil } = getImageProps({
    src: "/media/landing/hero-mobile.jpg",
    alt: t("heroImageAlt"),
    fill: true,
    sizes: "100vw",
    quality: 72,
    // Sin `preload` de Next: precargaría la foto móvil también en escritorio. Abajo se precarga SOLO
    // la imagen que corresponde a cada ancho.
    fetchPriority: "high",
  });

  const palabras = t("heroTitle").split(" ");

  return (
    <div className="px-2 md:px-4">
      {/* React 19 sube estos `<link>` al `<head>`: el LCP se pide en cuanto llega el HTML, y cada ancho
          pide solo su imagen (la foto móvil pesa 5× más que el póster de escritorio en AVIF). */}
      <link
        rel="preload"
        as="image"
        media="(max-width: 1023px)"
        href={movil.src}
        imageSrcSet={movil.srcSet}
        imageSizes="100vw"
        fetchPriority="high"
      />
      <link
        rel="preload"
        as="image"
        media="(min-width: 1024px)"
        href="/media/landing/hero-desktop-poster.avif"
        type="image/avif"
        fetchPriority="high"
      />
      <section
        aria-labelledby="hero-titulo"
        className="relative isolate flex min-h-[560px] items-end overflow-hidden rounded-hoja bg-brand-950 text-white lg:min-h-[620px]"
      >
        <picture>
          <source media="(min-width: 1024px)" srcSet="/media/landing/hero-desktop-poster.avif" type="image/avif" />
          <source media="(min-width: 1024px)" srcSet="/media/landing/hero-desktop-poster.jpg" type="image/jpeg" />
          <img {...movil} alt={movil.alt} className="absolute inset-0 -z-20 size-full object-cover object-[62%_58%] lg:object-center" />
        </picture>

        <HeroMedia
          mp4="/media/landing/hero-desktop.mp4"
          webm="/media/landing/hero-desktop.webm"
          poster="/media/landing/hero-desktop-poster.jpg"
        />

        {/* Velo de legibilidad (único degradado permitido; ver landing.css). */}
        <div aria-hidden className="hero-velo absolute inset-0 -z-10" />

        <div className={cn(CONTENEDOR, "relative")}>
          <div className="max-w-[760px] px-0 pt-14 pb-[104px] md:px-6 md:pb-[120px] lg:py-14 lg:pb-[120px]">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-3 py-1 text-[13px] font-semibold">
              <span aria-hidden className="landing-vivo relative size-2 rounded-full bg-brand-300 text-brand-300" />
              {t("heroTag")}
            </span>

            <h1
              id="hero-titulo"
              className="mt-[18px] mb-4 text-[clamp(36px,5.2vw,60px)] leading-[1.05] font-bold tracking-[-0.03em] text-balance"
            >
              {palabras.map((palabra, i) => (
                <span key={i}>
                  <span className="landing-palabra inline-block" style={{ "--paso": i } as React.CSSProperties}>
                    {palabra}
                  </span>{" "}
                </span>
              ))}
            </h1>

            <p className="landing-palabra max-w-[560px] text-lg text-white/85" style={{ "--paso": palabras.length } as React.CSSProperties}>
              {t("heroDefinition")}
            </p>

            <div
              className="landing-palabra mt-7 flex flex-wrap gap-3"
              style={{ "--paso": palabras.length + 2 } as React.CSSProperties}
            >
              <Link href="/login" className={variantesBoton({ size: "lg", className: "group/cta" })}>
                {t("heroCta")}
                <ChevronRight className="transition-transform duration-200 group-hover/cta:translate-x-0.5" />
              </Link>

              {/* Cristal sobre el video: el hero es siempre oscuro, así que el botón no cambia con el tema. */}
              <a
                href="#preguntas"
                className={variantesBoton({
                  variant: "secondary",
                  size: "lg",
                  className: "border-white/35! bg-white/15! text-white! backdrop-blur-md enabled:hover:bg-white/25!",
                })}
              >
                {t("heroFaqCta")}
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
