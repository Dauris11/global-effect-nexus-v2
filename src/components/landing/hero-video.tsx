"use client";

import { useEffect, useState } from "react";

/**
 * Video del hero, solo en escritorio.
 *
 * Por qué se monta desde JavaScript y no con un `<video>` siempre presente: un
 * `<video preload="metadata">` oculto con CSS en el móvil igual pide el archivo,
 * y el celular de un estudiante con datos limitados no tiene por qué bajarse 1 MB
 * de video que no va a ver. Aquí el elemento ni existe hasta que se cumplen las
 * tres condiciones: pantalla ancha, sin «reducir movimiento» y sin «ahorro de
 * datos». Mientras tanto (y en todo el móvil) lo que se ve es la imagen del
 * servidor, así que no hay hueco ni salto al montarse.
 */

const ANCHO_ESCRITORIO = "(min-width: 1024px)";
const MENOS_MOVIMIENTO = "(prefers-reduced-motion: reduce)";

type ConexionAhorro = { connection?: { saveData?: boolean } };

export function HeroVideo({ mp4, webm, poster }: { mp4: string; webm: string; poster: string }) {
  const [montar, setMontar] = useState(false);

  useEffect(() => {
    const ancha = window.matchMedia(ANCHO_ESCRITORIO);
    const quieta = window.matchMedia(MENOS_MOVIMIENTO);
    const ahorro = (navigator as Navigator & ConexionAhorro).connection?.saveData === true;

    const evaluar = () => setMontar(ancha.matches && !quieta.matches && !ahorro);

    evaluar();
    ancha.addEventListener("change", evaluar);
    quieta.addEventListener("change", evaluar);

    return () => {
      ancha.removeEventListener("change", evaluar);
      quieta.removeEventListener("change", evaluar);
    };
  }, []);

  if (!montar) return null;

  return (
    <video
      muted
      autoPlay
      loop
      playsInline
      preload="metadata"
      poster={poster}
      aria-hidden
      tabIndex={-1}
      // -z-20 como la imagen y después de ella en el DOM: queda sobre la foto y bajo el velo (-z-10).
      className="absolute inset-0 -z-20 size-full object-cover"
    >
      {/* WebM primero: pesa parecido pero decodifica mejor en Chrome y Firefox. */}
      <source src={webm} type="video/webm" />
      <source src={mp4} type="video/mp4" />
    </video>
  );
}
