"use client";

import { useEffect } from "react";

/**
 * Revela los elementos `.rv` de la portada al entrar en pantalla.
 *
 * El CSS (`landing.css`) solo los oculta bajo `<html class="js">`, así que esto es una MEJORA: sin
 * JavaScript, o si este hook nunca corre, todo se ve. Tres garantías contra los huecos en blanco:
 *   1. Lo que ya está en pantalla al cargar se marca visible al instante y SIN animar (`rv-ya`):
 *      nadie ve un parpadeo de contenido que ya tenía delante.
 *   2. Red de seguridad a los 2,5 s: todo `.rv` que ya esté en pantalla o por encima de ella se
 *      revela aunque el observador no haya avisado. Se vuelve a comprobar al rodar y al
 *      redimensionar. Lo que sigue más abajo espera a que llegue su turno: revelarlo todo a los
 *      2,5 s gastaría la animación de las secciones antes de que alguien las vea.
 *   3. `prefers-reduced-motion` y navegadores sin `IntersectionObserver`: se revela todo y no se
 *      anima nada.
 */
const RED_DE_SEGURIDAD_MS = 2500;

export function useReveal() {
  useEffect(() => {
    const elementos = Array.from(document.querySelectorAll<HTMLElement>(".rv"));
    if (elementos.length === 0) return;

    const revelar = (el: HTMLElement, animar: boolean) => {
      if (!animar) el.classList.add("rv-ya");
      el.classList.add("rv-in");
    };

    const sinMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (sinMovimiento || typeof IntersectionObserver === "undefined") {
      elementos.forEach((el) => revelar(el, false));
      return;
    }

    // `top < altura` cubre también lo que quedó por encima (recarga con scroll restaurado).
    const yaEnPantalla = (el: HTMLElement) => el.getBoundingClientRect().top < window.innerHeight;

    const pendientes = new Set<HTMLElement>();
    for (const el of elementos) {
      if (el.classList.contains("rv-in")) continue;
      if (yaEnPantalla(el)) revelar(el, false);
      else pendientes.add(el);
    }

    const observador = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          const el = entrada.target as HTMLElement;
          if (!entrada.isIntersecting && !(entrada.boundingClientRect.top < 0)) continue;

          revelar(el, true);
          pendientes.delete(el);
          observador.unobserve(el);
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    pendientes.forEach((el) => observador.observe(el));

    const barrer = () => {
      for (const el of pendientes) {
        if (!yaEnPantalla(el)) continue;
        revelar(el, true);
        pendientes.delete(el);
        observador.unobserve(el);
      }
    };

    const temporizador = window.setTimeout(barrer, RED_DE_SEGURIDAD_MS);
    window.addEventListener("scroll", barrer, { passive: true });
    window.addEventListener("resize", barrer);

    return () => {
      window.clearTimeout(temporizador);
      window.removeEventListener("scroll", barrer);
      window.removeEventListener("resize", barrer);
      observador.disconnect();
    };
  }, []);
}
