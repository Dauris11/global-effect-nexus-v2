import * as L from "leaflet";

import { AZUL, AZUL_OSCURO, BLANCO, SEMAFORO, TINTA } from "@/lib/paleta";
import type { EstadoViaje } from "@/lib/transporte";

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
export type DatosGuagua = {
  rumbo?: number;
  estado?: EstadoViaje;
  velocidadKmh?: number;
  /** Texto cuando está detenida; llega traducido, aquí no hay literales. */
  etiquetaParada: string;
};

/** Colores como variables CSS: el CSS no repite ningún valor de la marca. */
function variables(estado: EstadoViaje): string {
  const averiada = estado === "averiado";

  return [
    `--g-color:${averiada ? SEMAFORO.alerta : AZUL}`,
    `--g-borde:${averiada ? TINTA : AZUL_OSCURO}`,
    `--g-tinta:${TINTA}`,
    `--g-blanco:${BLANCO}`,
    `--g-alerta:${SEMAFORO.alerta}`,
  ].join(";");
}

const CARAS_COSTADO = (lado: "izq" | "der") => `
  <div class="guagua3d-cara guagua3d-costado guagua3d-${lado}">
    <div class="guagua3d-ventanas"></div>
    <span class="guagua3d-puerta"></span>
  </div>`;

const RUEDA = (lado: "izq" | "der", pos: "del" | "tras") => `
  <div class="guagua3d-rueda guagua3d-rueda-${lado} guagua3d-rueda-${pos}">
    <div class="guagua3d-rueda-giro"><span></span></div>
  </div>`;

function etiquetaVelocidad(datos: DatosGuagua): string {
  const velocidad = datos.velocidadKmh ?? 0;

  return velocidad > 0 ? `${Math.round(velocidad)} km/h` : datos.etiquetaParada;
}

export function iconoGuagua3D(datos: DatosGuagua): L.DivIcon {
  const estado = datos.estado ?? "en_curso";
  const velocidad = datos.velocidadKmh ?? 0;
  const html = `
    <div class="guagua3d" data-estado="${estado}" data-mov="${velocidad > 0 ? "1" : "0"}"
         style="${variables(estado)};--g-giro:${Math.max(0.25, 1.6 - velocidad / 40).toFixed(2)}s">
      <div class="guagua3d-onda"></div>
      <div class="guagua3d-escena">
        <div class="guagua3d-giro" style="transform:rotateZ(${datos.rumbo ?? 0}deg)">
          <div class="guagua3d-sombra"></div>
          <div class="guagua3d-bus">
            <div class="guagua3d-cara guagua3d-techo"><b>GE</b></div>
            <div class="guagua3d-cara guagua3d-frente">
              <span class="guagua3d-parabrisas"></span>
              <i class="guagua3d-faro guagua3d-faro-izq"></i>
              <i class="guagua3d-faro guagua3d-faro-der"></i>
            </div>
            <div class="guagua3d-cara guagua3d-trasera">
              <i class="guagua3d-luz guagua3d-luz-izq"></i>
              <i class="guagua3d-luz guagua3d-luz-der"></i>
            </div>
            ${CARAS_COSTADO("izq")}
            ${CARAS_COSTADO("der")}
            ${RUEDA("izq", "del")}${RUEDA("der", "del")}
            ${RUEDA("izq", "tras")}${RUEDA("der", "tras")}
          </div>
        </div>
      </div>
      <div class="guagua3d-etiqueta">${etiquetaVelocidad(datos)}</div>
    </div>
  `;

  return L.divIcon({
    html,
    className: "marcador-guagua-3d",
    iconSize: [72, 72],
    iconAnchor: [36, 36],
  });
}

/** Actualiza la guagua que ya está en el mapa sin reconstruirla. */
export function actualizarGuagua3D(marcador: L.Marker, datos: DatosGuagua): void {
  const raiz = marcador.getElement()?.querySelector<HTMLElement>(".guagua3d");

  if (!raiz) return;

  const estado = datos.estado ?? "en_curso";
  const velocidad = datos.velocidadKmh ?? 0;

  raiz.dataset.estado = estado;
  raiz.dataset.mov = velocidad > 0 ? "1" : "0";
  raiz.setAttribute(
    "style",
    `${variables(estado)};--g-giro:${Math.max(0.25, 1.6 - velocidad / 40).toFixed(2)}s`,
  );

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
