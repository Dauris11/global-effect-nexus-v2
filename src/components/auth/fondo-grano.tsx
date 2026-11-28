"use client";

import { useEffect, useRef } from "react";

/**
 * Fondo gráfico animado con efecto de grano / partículas sutiles.
 *
 * Utiliza HTML5 Canvas con un buffer de ruido procedural offscreen en patrón
 * para máximo rendimiento sin sobrecargar CPU ni batería (~15 fps para textura
 * orgánica de grano cinematográfico).
 *
 * Incluye partículas sutiles flotantes con los colores institucionales.
 * Respeta `prefers-reduced-motion` pausando el movimiento.
 */
interface FondoGranoProps {
  className?: string;
  opacidadGrano?: number;
  cantidadParticulas?: number;
}

export function FondoGrano({
  className = "",
  opacidadGrano = 0.05,
  cantidadParticulas = 25,
}: FondoGranoProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animacionId: number;
    let ultimoTiempo = 0;
    const fps = 18;
    const intervalo = 1000 / fps;

    // Canvas auxiliar offscreen para generar el grano repetible (100x100)
    const tamanoPatron = 100;
    const patronCanvas = document.createElement("canvas");
    patronCanvas.width = tamanoPatron;
    patronCanvas.height = tamanoPatron;
    const patronCtx = patronCanvas.getContext("2d");

    let ancho = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
    let alto = (canvas.height = canvas.parentElement?.clientHeight || window.innerHeight);

    const reajustar = () => {
      if (!canvas) return;
      ancho = canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
      alto = canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;
    };

    window.addEventListener("resize", reajustar);

    const prefiereMovimientoReducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Partículas flotantes sutiles con tono turquesa institucional (#2096BA)
    const particulas = Array.from({ length: cantidadParticulas }, () => ({
      x: Math.random() * ancho,
      y: Math.random() * alto,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      radio: Math.random() * 1.5 + 0.8,
      alfa: Math.random() * 0.25 + 0.15,
    }));

    const generarGrano = () => {
      if (!patronCtx) return;
      const datosImagen = patronCtx.createImageData(tamanoPatron, tamanoPatron);
      const buffer = new Uint32Array(datosImagen.data.buffer);
      const largo = buffer.length;

      for (let i = 0; i < largo; i++) {
        if (Math.random() < 0.35) {
          // Grano en escala de grises suave
          const val = Math.floor(Math.random() * 255);
          buffer[i] = (255 << 24) | (val << 16) | (val << 8) | val;
        } else {
          buffer[i] = 0;
        }
      }
      patronCtx.putImageData(datosImagen, 0, 0);
    };

    generarGrano();

    const render = (tiempo: number) => {
      animacionId = requestAnimationFrame(render);

      const delta = tiempo - ultimoTiempo;
      if (delta < intervalo) return;
      ultimoTiempo = tiempo - (delta % intervalo);

      ctx.clearRect(0, 0, ancho, alto);

      // 1. Dibujar partículas flotantes suaves
      for (const p of particulas) {
        if (!prefiereMovimientoReducido) {
          p.x += p.vx;
          p.y += p.vy;

          if (p.x < 0) p.x = ancho;
          else if (p.x > ancho) p.x = 0;
          if (p.y < 0) p.y = alto;
          else if (p.y > alto) p.y = 0;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radio, 0, Math.PI * 2);
        // Turquesa institucional con alfa suave
        ctx.fillStyle = `rgba(32, 150, 186, ${p.alfa})`;
        ctx.fill();
      }

      // 2. Generar y dibujar grano animado
      generarGrano();
      const patron = ctx.createPattern(patronCanvas, "repeat");
      if (patron) {
        ctx.save();
        ctx.globalAlpha = opacidadGrano;
        ctx.fillStyle = patron;
        ctx.fillRect(0, 0, ancho, alto);
        ctx.restore();
      }
    };

    animacionId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", reajustar);
      cancelAnimationFrame(animacionId);
    };
  }, [cantidadParticulas, opacidadGrano]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 z-0 size-full ${className}`}
    />
  );
}
