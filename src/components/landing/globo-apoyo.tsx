"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Globe } from "@/components/landing/globe";

/**
 * El globo de la sección "Dónde estamos": dos puntos y un arco entre ellos,
 * de Estados Unidos a La Vega.
 *
 * Coordenadas [latitud, longitud]. La de La Vega es la de Concepción de La
 * Vega, donde está la Fundación; la de Estados Unidos es el centro geográfico
 * del país continental, porque el punto representa al país entero y no a
 * ninguna ciudad en concreto.
 *
 * Tres cosas que no se ven leyendo el JSX:
 *
 * - `speed={0}`. El globo no gira solo. `cobe` centra la longitud −90° cuando
 *   `phi` vale 0, así que el arco nace ya encarado al visitante; con la
 *   rotación puesta se iría al borde en unos segundos y la única frase que
 *   cuenta esta sección —de allí a aquí— dejaría de leerse. Quien quiera girar
 *   el globo lo arrastra. De paso, sin rotación no hay movimiento que estorbe a
 *   quien pide `prefers-reduced-motion`.
 *
 * - No se monta hasta que la sección entra en pantalla. Es WebGL: compilar los
 *   shaders y dibujar a 60 fps por una sección que está siete pantallas más
 *   abajo se lo cobra la batería de quien nunca llega hasta aquí.
 *
 * - `markers` y `arcs` van memorizados. `Globe` recrea el globo entero cuando
 *   cambia la identidad de esos arrays, y pasarlos como literales lo recrearía
 *   en cada render.
 */

const ESTADOS_UNIDOS: [number, number] = [39.83, -98.58];
const LA_VEGA: [number, number] = [19.22, -70.53];

/** Turquesa institucional #2096BA en el 0–1 que espera WebGL. */
const TURQUESA: [number, number, number] = [0.125, 0.588, 0.729];
/** Slate-600, la tierra sobre el panel oscuro. */
const TIERRA: [number, number, number] = [0.28, 0.33, 0.4];
/** Slate-900, el halo: sobre el panel oscuro un halo claro se vería como un aro. */
const HALO: [number, number, number] = [0.09, 0.11, 0.13];

export function GloboApoyo({
  etiquetaOrigen,
  etiquetaDestino,
}: {
  etiquetaOrigen: string;
  etiquetaDestino: string;
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const nodo = contenedor.current;

    if (!nodo || visible) return;

    // `rootMargin` generoso: que los shaders estén compilados cuando la sección
    // llega de verdad, no cuando ya se está mirando el hueco.
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((entrada) => entrada.isIntersecting)) {
          setVisible(true);
          observador.disconnect();
        }
      },
      { rootMargin: "200px" },
    );

    observador.observe(nodo);

    return () => observador.disconnect();
  }, [visible]);

  const marcadores = useMemo(
    () => [
      { id: "eeuu", location: ESTADOS_UNIDOS, label: etiquetaOrigen },
      { id: "lavega", location: LA_VEGA, label: etiquetaDestino },
    ],
    [etiquetaOrigen, etiquetaDestino],
  );

  const arcos = useMemo(
    () => [{ id: "apoyo", from: ESTADOS_UNIDOS, to: LA_VEGA }],
    [],
  );

  return (
    <div ref={contenedor} className="mx-auto w-full max-w-md">
      {visible ? (
        <Globe
          markers={marcadores}
          arcs={arcos}
          dark={1}
          diffuse={1.2}
          mapBrightness={5}
          baseColor={TIERRA}
          markerColor={TURQUESA}
          arcColor={TURQUESA}
          glowColor={HALO}
          markerSize={0.045}
          markerElevation={0.02}
          arcWidth={0.8}
          arcHeight={0.3}
          theta={0.35}
          speed={0}
        />
      ) : (
        // Reserva el hueco exacto del globo para que la sección no salte
        // cuando se monta.
        <div className="aspect-square" aria-hidden />
      )}
    </div>
  );
}
