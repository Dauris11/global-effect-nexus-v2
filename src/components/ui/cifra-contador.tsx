"use client";

import { useEffect, useRef } from "react";
import { animate, useInView, useReducedMotion } from "motion/react";

/**
 * Cifra que cuenta desde cero hasta su valor la primera vez que se ve.
 *
 * El servidor pinta el valor final (sin JavaScript, o con «reducir
 * movimiento», eso es lo que queda). La animación escribe directamente en el
 * nodo y no en el estado: son ~50 cuadros y no merece la pena re-renderizar
 * la tarjeta en cada uno.
 */
export function CifraContador({ valor, className }: { valor: number; className?: string }) {
  const nodo = useRef<HTMLParagraphElement>(null);
  const visible = useInView(nodo, { once: true });
  const reducido = useReducedMotion() ?? false;
  const entero = Number.isInteger(valor);

  useEffect(() => {
    if (!visible || reducido || !nodo.current || valor === 0) return;

    const elemento = nodo.current;
    const control = animate(0, valor, {
      duration: Math.min(1.1, 0.4 + Math.log10(Math.abs(valor) + 1) * 0.25),
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (actual) => {
        elemento.textContent = entero ? String(Math.round(actual)) : actual.toFixed(1);
      },
    });

    return () => control.stop();
  }, [visible, reducido, valor, entero]);

  return (
    <p ref={nodo} className={className}>
      {valor}
    </p>
  );
}
