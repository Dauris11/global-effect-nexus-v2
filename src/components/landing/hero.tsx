"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";

import { CONTENEDOR } from "@/components/landing/piezas";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * Hero rotativo de la página de inicio, con los anuncios que publique
 * administración o los tres de `messages` si no hay ninguno.
 *
 * Solo el titular. Aquí había además una píldora, un párrafo, dos botones fijos
 * y una banda de "Matrícula Abierta" con su enlace: seis cosas compitiendo en la
 * primera pantalla, y ninguna se leía. Ahora el hero dice UNA cosa, en grande, y
 * las acciones están en la barra (la píldora) y en la franja de acceso.
 *
 * La única excepción es el botón de un anuncio publicado desde el panel: ese no
 * es una promoción escrita en el código, es lo que la Fundación tiene que
 * anunciar hoy, y sin su botón el anuncio no serviría de nada.
 *
 * Recibe los textos ya traducidos como props en vez de leerlos con
 * `useTranslations`. El espacio `landing` son 10,3 KB de mensajes; pasando solo
 * las cadenas que se usan, no hay que serializarlo entero al navegador.
 *
 * Las imágenes van con `next/image` y `fill`, no como `background-image`: los
 * PNG de `public/` pesan entre 700 y 900 KB y así los reescala y sirve en
 * formato moderno. La primera lleva `priority` porque es lo primero que se ve.
 */

export type Diapositiva = {
  titulo: string;
  imagen: string;
  /**
   * Botón propio del anuncio, si administración le puso texto y enlace en
   * `/configuracion/landing`. Es lo que hace que un anuncio sirva de algo:
   * "Convocatoria de becas abierta" con un botón a donde se postula, en vez de
   * un titular que hay que creer.
   */
  cta?: { texto: string; href: string };
};

const INTERVALO_MS = 6000;

export function Hero({
  diapositivas,
  etiquetaAnterior,
  etiquetaSiguiente,
  etiquetaCarrusel,
}: {
  diapositivas: readonly Diapositiva[];
  etiquetaAnterior: string;
  etiquetaSiguiente: string;
  /** "carrusel" en el idioma de la página, para `aria-roledescription`. */
  etiquetaCarrusel: string;
}) {
  const total = diapositivas.length;
  const [actual, setActual] = useState(0);
  const [reducido, setReducido] = useState(false);
  const [interactuando, setInteractuando] = useState(false);

  /*
   * Dos motivos distintos para no rotar, y hay que distinguirlos: quien pide
   * menos movimiento en el sistema no quiere rotación en ningún momento,
   * mientras que la pausa por interacción se levanta al retirar el ratón.
   * Con un solo estado, mover el ratón reanudaba la rotación a alguien que
   * había pedido lo contrario.
   */
  const enPausa = reducido || interactuando;

  const ir = useCallback(
    (paso: number) => setActual((i) => (i + paso + total) % total),
    [total],
  );

  useEffect(() => {
    // Con una sola diapositiva no hay nada que rotar; en pausa tampoco.
    if (total < 2 || enPausa) return;

    const temporizador = setInterval(() => ir(1), INTERVALO_MS);

    return () => clearInterval(temporizador);
  }, [ir, total, enPausa]);

  // Respeta a quien pide menos movimiento en el sistema: se detiene la
  // rotación automática, pero los controles manuales siguen funcionando.
  useEffect(() => {
    const consulta = window.matchMedia("(prefers-reduced-motion: reduce)");

    const aplicar = () => setReducido(consulta.matches);

    aplicar();
    consulta.addEventListener("change", aplicar);

    return () => consulta.removeEventListener("change", aplicar);
  }, []);

  const diapositiva = diapositivas[actual];

  return (
    /*
     * Foto a sangre DENTRO del contenedor, con las esquinas `rounded-hoja`: el
     * hero es una tarjeta grande, no una banda de borde a borde (docs/09 §5).
     *
     * `min-h` y no altura fija: con altura fija y `overflow-hidden` un titular
     * de tres líneas se recortaba sin aviso. Así mide lo previsto cuando el
     * texto es corto y crece cuando hace falta.
     *
     * La rotación se detiene mientras el ratón está encima o algo de dentro
     * tiene el foco: un carrusel que cambia cada 6 segundos mientras alguien
     * lee o recorre los enlaces con el teclado se los quita de debajo.
     */
    <div className={cn(CONTENEDOR, "pt-2 md:pt-4")}>
      <section
        role="region"
        aria-roledescription={etiquetaCarrusel}
        aria-labelledby="hero-titulo"
        onMouseEnter={() => setInteractuando(true)}
        onMouseLeave={() => setInteractuando(false)}
        onFocus={() => setInteractuando(true)}
        onBlur={() => setInteractuando(false)}
        className="relative isolate flex min-h-[440px] flex-col justify-end overflow-hidden rounded-hoja bg-muted md:min-h-[560px]"
      >
        {diapositivas.map((item, indice) => (
          <div
            key={`${item.imagen}-${indice}`}
            className={cn(
              "absolute inset-0 -z-10 transition-opacity duration-700",
              indice === actual ? "opacity-100" : "opacity-0",
            )}
            aria-hidden={indice !== actual}
          >
            <Image
              src={item.imagen}
              alt=""
              fill
              priority={indice === 0}
              sizes="(max-width: 1280px) 100vw, 1280px"
              className="object-cover"
            />
          </div>
        ))}

        {/* Velo oscuro sutil, solo abajo, donde va el texto: sin él el blanco
            no se lee sobre una foto clara. Negro y no tinta, porque `tinta` se
            invierte en modo oscuro y el velo se volvería blanco. */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-gradient-to-t from-black/70 via-black/25 to-transparent"
        />

        <div className="flex flex-col gap-6 p-6 md:flex-row md:items-end md:justify-between md:p-10">
          <div className="max-w-3xl">
            <h1
              id="hero-titulo"
              className="font-semibold tracking-tight text-balance text-white"
              style={{ fontSize: "clamp(30px, 5vw, 56px)", lineHeight: 1.08, letterSpacing: "-0.03em" }}
            >
              {diapositiva.titulo}
            </h1>

            {/* Solo el del anuncio publicado. Sin anuncio no hay botón: entrar
                se hace desde la barra y la franja de acceso de justo debajo. */}
            {diapositiva.cta && (
              <Button asChild size="lg" className="mt-6">
                <Link href={diapositiva.cta.href}>
                  {diapositiva.cta.texto}
                  <ArrowRight />
                </Link>
              </Button>
            )}
          </div>

          {total > 1 && (
            <div className="flex shrink-0 items-center gap-2">
              {/* El punto se ve de 8 px pero se pulsa en 44: el botón lleva el
                  relleno y la bolita va dentro, en un `span`. */}
              <div className="mr-1 flex items-center">
                {diapositivas.map((item, indice) => (
                  <button
                    key={`${item.imagen}-${indice}`}
                    type="button"
                    onClick={() => setActual(indice)}
                    aria-current={indice === actual}
                    aria-label={`${indice + 1} / ${total}`}
                    className="-mx-1.5 flex size-11 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
                  >
                    <span
                      className={cn(
                        "h-2 rounded-full transition-all",
                        indice === actual ? "w-6 bg-white" : "w-2 bg-white/50",
                      )}
                    />
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => ir(-1)}
                aria-label={etiquetaAnterior}
                className={CLASE_FLECHA}
              >
                <ChevronLeft className="size-5" />
              </button>

              <button
                type="button"
                onClick={() => ir(1)}
                aria-label={etiquetaSiguiente}
                className={CLASE_FLECHA}
              >
                <ChevronRight className="size-5" />
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

/** Flechas blancas y redondas, como las de una galería de fotos. */
const CLASE_FLECHA =
  "flex size-11 items-center justify-center rounded-full bg-white/90 text-black shadow-card transition hover:bg-white hover:shadow-elevada focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/40 focus-visible:outline-none active:scale-95";
