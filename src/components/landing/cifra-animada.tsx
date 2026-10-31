"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Número que cuenta desde cero la primera vez que entra en pantalla.
 *
 * El servidor pinta ya la cifra final: sin JavaScript, con un lector de
 * pantalla o con movimiento reducido se lee el dato correcto y nunca un cero.
 * La cuenta solo arranca si el número está fuera de la vista al montar; si ya
 * se ve, contar desde cero sería borrar un dato que la persona ya leyó.
 *
 * El conteo va en un `span` con `aria-hidden` y el valor real en `sr-only`,
 * para que el lector no anuncie cada fotograma.
 */
export function CifraAnimada({ valor, idioma }: { valor: number; idioma: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [mostrado, setMostrado] = useState(valor);
  const formato = new Intl.NumberFormat(idioma);

  useEffect(() => {
    const nodo = ref.current;
    if (!nodo || valor <= 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const caja = nodo.getBoundingClientRect();
    if (caja.top < window.innerHeight && caja.bottom > 0) return;

    let cuadro = 0;
    // Se pone a cero aquí, fuera de la vista: el salto no lo ve nadie.
    setMostrado(0);

    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (!entrada.isIntersecting) return;
        observador.disconnect();

        const inicio = performance.now();
        const DURACION = 1100;

        const paso = (ahora: number) => {
          const t = Math.min(1, (ahora - inicio) / DURACION);
          // Salida cúbica: corre al principio y se posa en el número.
          const avance = 1 - Math.pow(1 - t, 3);
          setMostrado(Math.round(valor * avance));
          if (t < 1) cuadro = requestAnimationFrame(paso);
        };

        cuadro = requestAnimationFrame(paso);
      },
      { threshold: 0.6 },
    );

    observador.observe(nodo);

    return () => {
      observador.disconnect();
      cancelAnimationFrame(cuadro);
    };
  }, [valor]);

  return (
    <span ref={ref}>
      <span aria-hidden>{formato.format(mostrado)}</span>
      <span className="sr-only">{formato.format(valor)}</span>
    </span>
  );
}
