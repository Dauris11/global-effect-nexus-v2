import * as L from "leaflet";

import {
  type DatosGuagua,
  etiquetaVelocidad,
  htmlGuagua3D,
  variablesGuagua,
} from "./guagua-3d-html";

/**
 * La guagua en 3D de verdad: un prisma con ocho caras reales (techo, frente,
 * trasera, dos costados con ventanas) y cuatro ruedas, armado con transformaciones
 * CSS 3D (`preserve-3d`) sobre un marcador de Leaflet. Sin librería nueva.
 *
 * Vista inclinada (`rotateX`) fija en pantalla y giro sobre el eje vertical
 * según el rumbo: al doblar, la guagua gira sobre sí misma como un modelo. Está
 * animada: las ruedas giran más rápido cuanto más corre, el chasis se balancea
 * en marcha, las luces delanteras se encienden y, si está averiada, parpadean
 * las intermitentes. Parada, todo se detiene.
 *
 * Los estilos están en `components/mapa/mapa.css` (`.guagua3d*`). El marcador se
 * crea UNA vez y luego se actualiza con `actualizarGuagua3D`: sustituir el icono
 * en cada lectura reiniciaría las animaciones y las ruedas «saltarían».
 */
export type { DatosGuagua };

export function iconoGuagua3D(datos: DatosGuagua): L.DivIcon {
  return L.divIcon({
    html: htmlGuagua3D(datos),
    className: "marcador-guagua-3d",
    iconSize: [104, 104],
    iconAnchor: [52, 52],
  });
}

/** Actualiza la guagua que ya está en el mapa sin reconstruirla. */
export function actualizarGuagua3D(marcador: L.Marker, datos: DatosGuagua): void {
  const raiz = marcador.getElement()?.querySelector<HTMLElement>(".guagua3d");

  if (!raiz) return;

  raiz.dataset.estado = datos.estado ?? "en_curso";
  raiz.dataset.mov = (datos.velocidadKmh ?? 0) > 0 ? "1" : "0";
  raiz.setAttribute("style", variablesGuagua(datos));

  const giro = raiz.querySelector<HTMLElement>(".guagua3d-giro");
  if (giro) giro.style.transform = `rotateZ(${datos.rumbo ?? 0}deg)`;

  const etiqueta = raiz.querySelector<HTMLElement>(".guagua3d-etiqueta");
  if (etiqueta) etiqueta.textContent = etiquetaVelocidad(datos);
}

const ANIMACIONES = new WeakMap<L.Marker, { cuadro: number; ultima: number }>();

/**
 * Desliza el marcador hasta la nueva posición en vez de saltar: la guagua avanza
 * por la calle entre dos lecturas de GPS. La duración sigue al tiempo real entre
 * lecturas (acotado), para que llegue justo cuando llega la siguiente.
 */
export function moverGuaguaSuave(marcador: L.Marker, lat: number, lng: number): void {
  const previa = ANIMACIONES.get(marcador);
  const ahora = performance.now();

  if (previa) cancelAnimationFrame(previa.cuadro);

  const desde = marcador.getLatLng();
  const duracion = previa ? Math.min(5000, Math.max(400, ahora - previa.ultima)) : 0;

  if (duracion === 0 || (desde.lat === lat && desde.lng === lng)) {
    marcador.setLatLng([lat, lng]);
    ANIMACIONES.set(marcador, { cuadro: 0, ultima: ahora });

    return;
  }

  const inicio = ahora;
  const paso = (momento: number) => {
    const avance = Math.min(1, (momento - inicio) / duracion);

    marcador.setLatLng([
      desde.lat + (lat - desde.lat) * avance,
      desde.lng + (lng - desde.lng) * avance,
    ]);

    if (avance < 1) {
      const estado = ANIMACIONES.get(marcador);

      if (estado) estado.cuadro = requestAnimationFrame(paso);
    }
  };

  ANIMACIONES.set(marcador, { cuadro: requestAnimationFrame(paso), ultima: ahora });
}
