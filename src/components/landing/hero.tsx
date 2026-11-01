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
 * Tres piezas y en este orden de peso: el titular, muy grande; una frase que
 * dice qué es la Fundación; y un solo botón. Aquí llegó a haber seis cosas
 * compitiendo (píldora, párrafo, dos botones, una banda de matrícula) y luego
 * solo el titular, que era bonito pero no decía qué era esto ni qué hacer.
 *
 * El botón es el del anuncio si administración le puso uno —es lo que la
 * Fundación tiene que anunciar hoy— y si no, entrar al portal, que es a lo que
 * viene casi todo el mundo.
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
  accion,
  etiquetaAnterior,
  etiquetaSiguiente,
  etiquetaCarrusel,
}: {
  diapositivas: readonly Diapositiva[];
  /** Botón por defecto cuando el anuncio no trae el suyo. */
  accion: { texto: string; href: string };
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
  const boton = diapositiva.cta ?? accion;

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
        className="relative isolate flex min-h-[520px] flex-col justify-end overflow-hidden rounded-hoja bg-muted md:min-h-[640px]"
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
              // La clase se pone al volverse activa, y ponerla reinicia el
              // acercamiento: cada anuncio entra con el suyo.
              className={cn("object-cover", indice === actual && "landing-foto-activa")}
            />
          </div>
        ))}

        {/* Velo oscuro sutil, solo abajo, donde va el texto: sin él el blanco
            no se lee sobre una foto clara. Negro y no tinta, porque `tinta` se
            invierte en modo oscuro y el velo se volvería blanco. */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-gradient-to-t from-black/75 via-black/30 to-transparent"
        />

        <div className="flex flex-col gap-8 p-6 md:flex-row md:items-end md:justify-between md:p-12">
          {/* `key` con el índice: al cambiar de anuncio el bloque se vuelve a
              montar y repite la entrada escalonada, titular primero. */}
          <div key={actual} className="max-w-4xl">
            <h1
              id="hero-titulo"
              className="landing-entrada text-[38px] leading-[1.02] font-semibold tracking-[-0.035em] text-balance text-white sm:text-[52px] lg:text-[76px]"
            >
              {diapositiva.titulo}
            </h1>

            <div className="landing-entrada mt-8 md:mt-10" style={{ "--paso": 1 } as React.CSSProperties}>
              <Button asChild size="lg" className="group/cta">
                <Link href={boton.href}>
                  {boton.texto}
                  <ArrowRight className="transition-transform duration-200 group-hover/cta:translate-x-0.5" />
                </Link>
              </Button>
            </div>
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
                    {/* El activo es una pista que se llena en lo que dura el
                        anuncio: dice cuánto falta para el siguiente sin un
                        número. Con movimiento reducido se ve llena y quieta. */}
                    <span
                      className={cn(
                        "relative h-2 overflow-hidden rounded-full transition-[width,background-color] duration-300",
                        indice === actual ? "w-8 bg-white/40" : "w-2 bg-white/50",
                      )}
                    >
                      {indice === actual && (
                        // La clave cambia al pausar y al reanudar: el
                        // intervalo vuelve a contar 6 s desde cero al
                        // reanudarse, y la barra tiene que empezar con él.
                        <span
                          key={`${actual}-${enPausa}`}
                          className={cn(
                            "absolute inset-0 rounded-full bg-white",
                            !enPausa && "landing-progreso",
                          )}
                        />
                      )}
                    </span>
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
