"use client";

import { Pause, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * Video de fondo del hero (WCAG 2.2.2: movimiento de más de 5 s ⇒ control de pausa).
 *
 * Reglas, en orden de importancia:
 *  1. Móvil y ahorro de datos: el video NO existe. Ni `<source>` ni `preload`: el celular de un
 *     estudiante no se baja un archivo que no va a ver. Lo que se ve es la imagen del servidor.
 *  2. Escritorio (≥ 1024 px), sin «reducir movimiento» y sin `saveData`: los `src` se asignan
 *     DESPUÉS de `requestIdleCallback`, para que el póster (que es el LCP) pinte primero.
 *  3. Se pausa solo cuando el hero sale de la pantalla o la pestaña se oculta: gasta CPU en vano.
 *  4. El botón de pausa es de la persona: si lo pulsa, el scroll no lo reanuda.
 */
const ANCHO_ESCRITORIO = "(min-width: 1024px)";
const MENOS_MOVIMIENTO = "(prefers-reduced-motion: reduce)";

type ConConexion = { connection?: { saveData?: boolean } };

export function HeroMedia({ mp4, webm, poster }: { mp4: string; webm: string; poster: string }) {
  const t = useTranslations("landing");
  const video = useRef<HTMLVideoElement>(null);
  const [activo, setActivo] = useState(false);
  const [listo, setListo] = useState(false);
  const [pausadoPorPersona, setPausadoPorPersona] = useState(false);
  const [enPantalla, setEnPantalla] = useState(true);
  const [pestanaVisible, setPestanaVisible] = useState(true);

  // 1 y 2: ¿corresponde montar el video? Se decide en el cliente y tras quedar libre el hilo.
  useEffect(() => {
    const ancha = window.matchMedia(ANCHO_ESCRITORIO);
    const quieta = window.matchMedia(MENOS_MOVIMIENTO);
    const ahorro = (navigator as Navigator & ConConexion).connection?.saveData === true;
    let identificador: number | undefined;
    let plazo: ReturnType<typeof setTimeout> | undefined;

    const evaluar = () => {
      const corresponde = ancha.matches && !quieta.matches && !ahorro;

      if (!corresponde) {
        setActivo(false);
        setListo(false);

        return;
      }

      const montar = () => setActivo(true);

      if ("requestIdleCallback" in window) identificador = window.requestIdleCallback(montar, { timeout: 1500 });
      else plazo = setTimeout(montar, 300);
    };

    evaluar();
    ancha.addEventListener("change", evaluar);
    quieta.addEventListener("change", evaluar);

    return () => {
      ancha.removeEventListener("change", evaluar);
      quieta.removeEventListener("change", evaluar);
      if (identificador !== undefined) window.cancelIdleCallback(identificador);
      if (plazo) clearTimeout(plazo);
    };
  }, []);

  // 3: pausa fuera de la pantalla y con la pestaña oculta.
  useEffect(() => {
    const contenedor = video.current?.parentElement;

    if (!activo || !contenedor) return;

    const observador = new IntersectionObserver(([entrada]) => setEnPantalla(entrada.isIntersecting), { threshold: 0.1 });
    const alCambiarPestana = () => setPestanaVisible(!document.hidden);

    observador.observe(contenedor);
    document.addEventListener("visibilitychange", alCambiarPestana);

    return () => {
      observador.disconnect();
      document.removeEventListener("visibilitychange", alCambiarPestana);
    };
  }, [activo]);

  const reproducir = activo && !pausadoPorPersona && enPantalla && pestanaVisible;

  useEffect(() => {
    const elemento = video.current;

    if (!elemento) return;
    // `play()` devuelve una promesa que se rechaza si el navegador lo impide: no es un error de la página.
    if (reproducir) void elemento.play().catch(() => {});
    else elemento.pause();
  }, [reproducir, activo]);

  const alMontar = useCallback((elemento: HTMLVideoElement | null) => {
    video.current = elemento;
    // Los `<source>` llegan con el render: hay que pedirle al video que los lea.
    elemento?.load();
  }, []);

  if (!activo) return null;

  return (
    <>
      <video
        ref={alMontar}
        muted
        loop
        playsInline
        preload="none"
        poster={poster}
        aria-hidden
        tabIndex={-1}
        data-listo={listo}
        onCanPlay={() => setListo(true)}
        // -z-20 como la imagen y después de ella en el DOM: queda sobre la foto y bajo el velo (-z-10).
        className="hero-video absolute inset-0 -z-20 size-full object-cover"
      >
        {/* WebM primero: pesa menos y decodifica bien en Chrome y Firefox; el MP4 es para Safari. */}
        <source src={webm} type="video/webm" />
        <source src={mp4} type="video/mp4" />
      </video>

      <Button
        type="button"
        variant="secondary"
        size="icon-lg"
        onClick={() => setPausadoPorPersona((p) => !p)}
        aria-label={pausadoPorPersona ? t("heroPlay") : t("heroPause")}
        title={pausadoPorPersona ? t("heroPlay") : t("heroPause")}
        className="absolute right-4 bottom-4 z-10 rounded-full"
      >
        {pausadoPorPersona ? <Play aria-hidden /> : <Pause aria-hidden />}
      </Button>
    </>
  );
}
