import { AZUL, AZUL_OSCURO, BLANCO, SEMAFORO, TINTA } from "@/lib/paleta";
import type { EstadoViaje } from "@/lib/transporte";

/**
 * El HTML de la guagua 3D, sin Leaflet: así se puede dibujar fuera del mapa
 * (pruebas, capturas). Los estilos están en `components/mapa/mapa.css`.
 */
export type DatosGuagua = {
  rumbo?: number;
  estado?: EstadoViaje;
  velocidadKmh?: number;
  /** Texto cuando está detenida; llega traducido, aquí no hay literales. */
  etiquetaParada: string;
};

/** Colores como variables CSS: el CSS no repite ningún valor de la marca. */
export function variablesGuagua(datos: DatosGuagua): string {
  const averiada = datos.estado === "averiado";
  const velocidad = datos.velocidadKmh ?? 0;

  return [
    `--g-color:${averiada ? SEMAFORO.alerta : AZUL}`,
    `--g-borde:${averiada ? TINTA : AZUL_OSCURO}`,
    `--g-tinta:${TINTA}`,
    `--g-blanco:${BLANCO}`,
    `--g-alerta:${SEMAFORO.alerta}`,
    // Vuelta de rueda: más corta cuanto más corre.
    `--g-giro:${Math.max(0.2, 1.4 - velocidad / 45).toFixed(2)}s`,
  ].join(";");
}

export function etiquetaVelocidad(datos: DatosGuagua): string {
  const velocidad = datos.velocidadKmh ?? 0;

  return velocidad > 0 ? `${Math.round(velocidad)} km/h` : datos.etiquetaParada;
}

const costado = (lado: "izq" | "der") => `
  <div class="guagua3d-cara guagua3d-costado guagua3d-${lado}">
    <div class="guagua3d-ventanas"></div>
    <span class="guagua3d-puerta"></span>
    <span class="guagua3d-franja"></span>
  </div>`;

const rueda = (lado: "izq" | "der", pos: "del" | "tras") => `
  <div class="guagua3d-rueda guagua3d-rueda-${lado} guagua3d-rueda-${pos}">
    <div class="guagua3d-rueda-giro"><span></span><span></span></div>
  </div>`;

export function htmlGuagua3D(datos: DatosGuagua): string {
  const estado = datos.estado ?? "en_curso";
  const movimiento = (datos.velocidadKmh ?? 0) > 0 ? "1" : "0";

  return `
    <div class="guagua3d" data-estado="${estado}" data-mov="${movimiento}" style="${variablesGuagua(datos)}">
      <div class="guagua3d-onda"></div>
      <div class="guagua3d-escena">
        <div class="guagua3d-giro" style="transform:rotateZ(${datos.rumbo ?? 0}deg)">
          <div class="guagua3d-sombra"></div>
          <div class="guagua3d-bus">
            <div class="guagua3d-cara guagua3d-techo"><b>GE</b></div>
            <div class="guagua3d-cara guagua3d-frente">
              <span class="guagua3d-parabrisas"></span>
              <span class="guagua3d-parachoques"></span>
              <i class="guagua3d-faro guagua3d-faro-izq"></i>
              <i class="guagua3d-faro guagua3d-faro-der"></i>
            </div>
            <div class="guagua3d-cara guagua3d-trasera">
              <span class="guagua3d-luneta"></span>
              <i class="guagua3d-luz guagua3d-luz-izq"></i>
              <i class="guagua3d-luz guagua3d-luz-der"></i>
            </div>
            ${costado("izq")}
            ${costado("der")}
            ${rueda("izq", "del")}${rueda("der", "del")}
            ${rueda("izq", "tras")}${rueda("der", "tras")}
          </div>
        </div>
      </div>
      <div class="guagua3d-etiqueta">${etiquetaVelocidad(datos)}</div>
    </div>
  `;
}
