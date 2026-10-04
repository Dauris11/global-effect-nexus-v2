"use client";

import { useEffect, useRef, useCallback } from "react";
import type { PointerEvent as PointerEventReact } from "react";
import createGlobe from "cobe";

import { BLANCO, TINTA } from "@/lib/paleta";

/**
 * Globo terráqueo de WebGL sobre `cobe`, con marcadores y arcos.
 *
 * Está en `ui/` y en inglés, como el resto de las primitivas de esta carpeta:
 * no sabe nada de la Fundación ni de sus textos. Quien le da sentido es
 * `landing/globo-apoyo.tsx`, que le pasa los dos puntos y el arco ya
 * traducidos.
 *
 * Tres decisiones que no se ven en el código:
 *
 * - El globo se crea una sola vez por montaje y después solo se le llama
 *   `update()` en cada fotograma. Volver a crearlo cuesta compilar los shaders
 *   otra vez, así que el efecto no debe reejecutarse: quien lo use tiene que
 *   pasarle `markers` y `arcs` estables (memorizados), no literales.
 *
 * - No arranca hasta que el `canvas` tiene ancho. En el primer render dentro de
 *   una rejilla el ancho es 0 y `cobe` dibujaría un lienzo vacío; de ahí el
 *   `ResizeObserver`.
 *
 * - La rotación se detiene mientras se arrastra y sigue con inercia al soltar,
 *   frenando un 5 % por fotograma. La inclinación se limita a ±0,4 radianes
 *   para que no se llegue a ver el globo por el polo.
 *
 * Las etiquetas flotantes se colocan con anclaje CSS (`position-anchor`), que
 * es lo que `cobe` 2 expone: publica `anchor-name: --cobe-<id>` en la posición
 * de cada marcador y una variable `--cobe-visible-<id>` que vale 0 cuando el
 * punto está en la cara oculta. Donde el navegador no implementa el anclaje
 * —hoy, todo lo que no es Chromium— la etiqueta queda invisible; por eso quien
 * lo usa debe nombrar los lugares también fuera del globo.
 */

interface Marker {
  id: string;
  location: [number, number];
  label: string;
}

interface Arc {
  id: string;
  from: [number, number];
  to: [number, number];
  label?: string;
}

interface GlobeProps {
  markers?: Marker[];
  arcs?: Arc[];
  className?: string;
  markerColor?: [number, number, number];
  baseColor?: [number, number, number];
  arcColor?: [number, number, number];
  glowColor?: [number, number, number];
  dark?: number;
  mapBrightness?: number;
  markerSize?: number;
  markerElevation?: number;
  arcWidth?: number;
  arcHeight?: number;
  speed?: number;
  theta?: number;
  diffuse?: number;
  mapSamples?: number;
}

export function Globe({
  markers = [],
  arcs = [],
  className = "",
  markerColor = [0.3, 0.45, 0.85],
  baseColor = [1, 1, 1],
  arcColor = [0.3, 0.45, 0.85],
  glowColor = [0.94, 0.93, 0.91],
  dark = 0,
  mapBrightness = 10,
  markerSize = 0.025,
  markerElevation = 0.01,
  arcWidth = 0.5,
  arcHeight = 0.25,
  speed = 0.003,
  theta = 0.2,
  diffuse = 1.5,
  mapSamples = 16000,
}: GlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerInteracting = useRef<{ x: number; y: number } | null>(null);
  const lastPointer = useRef<{ x: number; y: number; t: number } | null>(null);
  const dragOffset = useRef({ phi: 0, theta: 0 });
  const velocity = useRef({ phi: 0, theta: 0 });
  const phiOffsetRef = useRef(0);
  const thetaOffsetRef = useRef(0);
  const isPausedRef = useRef(false);

  const handlePointerDown = useCallback((e: PointerEventReact) => {
    pointerInteracting.current = { x: e.clientX, y: e.clientY };
    if (canvasRef.current) canvasRef.current.style.cursor = "grabbing";
    isPausedRef.current = true;
  }, []);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (pointerInteracting.current === null) return;

    const deltaX = e.clientX - pointerInteracting.current.x;
    const deltaY = e.clientY - pointerInteracting.current.y;

    dragOffset.current = { phi: deltaX / 300, theta: deltaY / 1000 };

    const now = Date.now();

    if (lastPointer.current) {
      const dt = Math.max(now - lastPointer.current.t, 1);
      const maxVelocity = 0.15;

      velocity.current = {
        phi: Math.max(
          -maxVelocity,
          Math.min(
            maxVelocity,
            ((e.clientX - lastPointer.current.x) / dt) * 0.3,
          ),
        ),
        theta: Math.max(
          -maxVelocity,
          Math.min(
            maxVelocity,
            ((e.clientY - lastPointer.current.y) / dt) * 0.08,
          ),
        ),
      };
    }

    lastPointer.current = { x: e.clientX, y: e.clientY, t: now };
  }, []);

  const handlePointerUp = useCallback(() => {
    if (pointerInteracting.current !== null) {
      phiOffsetRef.current += dragOffset.current.phi;
      thetaOffsetRef.current += dragOffset.current.theta;
      dragOffset.current = { phi: 0, theta: 0 };
      lastPointer.current = null;
    }

    pointerInteracting.current = null;
    if (canvasRef.current) canvasRef.current.style.cursor = "grab";
    isPausedRef.current = false;
  }, []);

  useEffect(() => {
    window.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });
    window.addEventListener("pointerup", handlePointerUp, { passive: true });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    let globe: ReturnType<typeof createGlobe> | null = null;
    let animationId = 0;
    let phi = 0;

    function init() {
      const width = canvas.offsetWidth;

      if (width === 0 || globe) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      globe = createGlobe(canvas, {
        devicePixelRatio: dpr,
        width,
        height: width,
        phi: 0,
        theta,
        dark,
        diffuse,
        mapSamples,
        mapBrightness,
        baseColor,
        markerColor,
        glowColor,
        markerElevation,
        markers: markers.map((m) => ({
          location: m.location,
          size: markerSize,
          id: m.id,
        })),
        arcs: arcs.map((a) => ({ from: a.from, to: a.to, id: a.id })),
        arcColor,
        arcWidth,
        arcHeight,
        opacity: 0.7,
      });

      function animate() {
        if (!isPausedRef.current) {
          phi += speed;

          if (
            Math.abs(velocity.current.phi) > 0.0001 ||
            Math.abs(velocity.current.theta) > 0.0001
          ) {
            phiOffsetRef.current += velocity.current.phi;
            thetaOffsetRef.current += velocity.current.theta;
            velocity.current.phi *= 0.95;
            velocity.current.theta *= 0.95;
          }

          const thetaMin = -0.4;
          const thetaMax = 0.4;

          if (thetaOffsetRef.current < thetaMin) {
            thetaOffsetRef.current += (thetaMin - thetaOffsetRef.current) * 0.1;
          } else if (thetaOffsetRef.current > thetaMax) {
            thetaOffsetRef.current += (thetaMax - thetaOffsetRef.current) * 0.1;
          }
        }

        globe!.update({
          phi: phi + phiOffsetRef.current + dragOffset.current.phi,
          theta: theta + thetaOffsetRef.current + dragOffset.current.theta,
          dark,
          mapBrightness,
          markerColor,
          baseColor,
          arcColor,
          markerElevation,
          markers: markers.map((m) => ({
            location: m.location,
            size: markerSize,
            id: m.id,
          })),
          arcs: arcs.map((a) => ({ from: a.from, to: a.to, id: a.id })),
        });

        animationId = requestAnimationFrame(animate);
      }

      animate();
      setTimeout(() => {
        canvas.style.opacity = "1";
      });
    }

    let observador: ResizeObserver | null = null;

    if (canvas.offsetWidth > 0) {
      init();
    } else {
      observador = new ResizeObserver((entries) => {
        if ((entries[0]?.contentRect.width ?? 0) > 0) {
          observador?.disconnect();
          init();
        }
      });
      observador.observe(canvas);
    }

    return () => {
      observador?.disconnect();
      if (animationId) cancelAnimationFrame(animationId);
      if (globe) globe.destroy();
    };
  }, [
    markers,
    arcs,
    markerColor,
    baseColor,
    arcColor,
    glowColor,
    dark,
    mapBrightness,
    markerSize,
    markerElevation,
    arcWidth,
    arcHeight,
    speed,
    theta,
    diffuse,
    mapSamples,
  ]);

  return (
    <div className={`relative aspect-square select-none ${className}`}>
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        style={{
          width: "100%",
          height: "100%",
          cursor: "grab",
          opacity: 0,
          transition: "opacity 1.2s ease",
          borderRadius: "50%",
          touchAction: "none",
        }}
      />

      {markers.map((m) => (
        <div
          key={m.id}
          style={{
            position: "absolute",
            positionAnchor: `--cobe-${m.id}`,
            bottom: "anchor(top)",
            left: "anchor(center)",
            translate: "-50% 0",
            marginBottom: 8,
            padding: "2px 6px",
            background: TINTA,
            color: BLANCO,
            fontSize: "0.6rem",
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            borderRadius: 4,
            opacity: `var(--cobe-visible-${m.id}, 0)`,
            filter: `blur(calc((1 - var(--cobe-visible-${m.id}, 0)) * 8px))`,
            transition: "opacity 0.8s, filter 0.8s",
          }}
        >
          {m.label}
          <span
            style={{
              position: "absolute",
              top: "100%",
              left: "50%",
              transform: "translate3d(-50%, -1px, 0)",
              border: "5px solid transparent",
              borderTopColor: TINTA,
            }}
          />
        </div>
      ))}

      {arcs
        .filter((a) => a.label)
        .map((a) => (
          <div
            key={a.id}
            style={{
              position: "absolute",
              positionAnchor: `--cobe-arc-${a.id}`,
              bottom: "anchor(top)",
              left: "anchor(center)",
              translate: "-50% 0",
              marginBottom: 8,
              padding: "2px 6px",
              background: BLANCO,
              color: TINTA,
              fontSize: "0.6rem",
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
              pointerEvents: "none",
              borderRadius: 4,
              boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
              opacity: `var(--cobe-visible-arc-${a.id}, 0)`,
              filter: `blur(calc((1 - var(--cobe-visible-arc-${a.id}, 0)) * 8px))`,
              transition: "opacity 0.8s, filter 0.8s",
            }}
          >
            {a.label}
            <span
              style={{
                position: "absolute",
                top: "100%",
                left: "50%",
                transform: "translate3d(-50%, -1px, 0)",
                border: "5px solid transparent",
                borderTopColor: BLANCO,
              }}
            />
          </div>
        ))}
    </div>
  );
}
