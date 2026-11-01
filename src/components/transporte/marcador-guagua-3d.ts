import * as L from "leaflet";

import { AZUL, AZUL_OSCURO, BLANCO, SEMAFORO, TINTA } from "@/lib/paleta";
import type { EstadoViaje } from "@/lib/transporte";

/**
 * Genera el icono 3D animado del autobús institucional para Leaflet.
 * Utiliza perspectiva isométrica CSS, orientación dinámica según el rumbo (heading),
 * sombra proyectada y efectos de pulso en ruta o intermitentes de emergencia si está averiado.
 */
export function iconoGuagua3D({
  rumbo = 0,
  estado = "en_curso",
  velocidadKmh = 0,
  etiquetaParada,
}: {
  rumbo?: number;
  estado?: EstadoViaje;
  velocidadKmh?: number;
  /** Texto cuando está detenida; llega traducido, aquí no hay literales. */
  etiquetaParada: string;
}): L.DivIcon {
  const esAveriado = estado === "averiado";

  // Averiada = estado de la entidad: usa el rojo del semáforo; el resto, marca.
  const colorChasis = esAveriado ? SEMAFORO.alerta : AZUL;
  const colorBorde = esAveriado ? TINTA : AZUL_OSCURO;
  const textoVelocidad =
    velocidadKmh > 0 ? `${Math.round(velocidadKmh)} km/h` : etiquetaParada;

  const html = `
    <div class="guagua-marcador-raiz" style="position: relative; width: 64px; height: 64px; display: flex; align-items: center; justify-content: center;">
      <!-- Pulso radial o alarma -->
      <div class="guagua-pulso ${esAveriado ? "guagua-pulso-averia" : "guagua-pulso-activo"}" style="
        position: absolute;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: color-mix(in srgb, ${colorChasis} 25%, transparent);
        animation: guaguaOnda 2s infinite ease-out;
        pointer-events: none;
      "></div>

      <!-- Contenedor giratorio según el rumbo -->
      <div class="guagua-cuerpo-rotativo" style="
        position: relative;
        width: 44px;
        height: 44px;
        transform: rotate(${rumbo}deg);
        transition: transform 0.8s cubic-bezier(0.2, 0, 0, 1);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <!-- Sombra 3D en el suelo -->
        <div style="
          position: absolute;
          bottom: -4px;
          width: 28px;
          height: 14px;
          background: color-mix(in srgb, ${TINTA} 35%, transparent);
          border-radius: 50%;
          filter: blur(3px);
          transform: perspective(300px) rotateX(40deg);
        "></div>

        <!-- Chasis 3D del Autobús -->
        <div style="
          position: relative;
          width: 26px;
          height: 42px;
          background: ${colorChasis};
          border: 2px solid ${colorBorde};
          border-radius: 7px;
          box-shadow: 0 8px 16px -2px color-mix(in srgb, ${TINTA} 40%, transparent), inset 0 2px 4px color-mix(in srgb, ${BLANCO} 35%, transparent);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          padding: 3px 2px;
          transform: perspective(250px) rotateX(15deg);
        ">
          <!-- Parabrisas frontal -->
          <div style="
            width: 18px;
            height: 7px;
            background: ${TINTA};
            border-radius: 3px 3px 1px 1px;
            box-shadow: inset 0 1px 2px color-mix(in srgb, ${BLANCO} 40%, transparent);
          "></div>

          <!-- Techo institucional con logo GE -->
          <div style="
            font-size: 8px;
            font-weight: 800;
            color: ${BLANCO};
            letter-spacing: -0.5px;
            user-select: none;
            opacity: 0.95;
          ">
            GE
          </div>

          <!-- Luces o intermitentes traseros -->
          <div style="
            display: flex;
            justify-content: space-between;
            width: 18px;
          ">
            <span style="width: 4px; height: 3px; background: ${SEMAFORO.alerta}; border-radius: 1px;"></span>
            <span style="width: 4px; height: 3px; background: ${SEMAFORO.alerta}; border-radius: 1px;"></span>
          </div>
        </div>

        <!-- Luces delanteras proyectadas -->
        <div style="
          position: absolute;
          top: -8px;
          width: 20px;
          height: 8px;
          display: flex;
          justify-content: space-between;
        ">
          <span style="width: 4px; height: 4px; background: ${BLANCO}; border-radius: 50%; box-shadow: 0 -4px 6px ${BLANCO};"></span>
          <span style="width: 4px; height: 4px; background: ${BLANCO}; border-radius: 50%; box-shadow: 0 -4px 6px ${BLANCO};"></span>
        </div>
      </div>

      <!-- Etiqueta de velocidad flotante superior -->
      <div style="
        position: absolute;
        top: -10px;
        background: ${TINTA};
        color: ${BLANCO};
        font-size: 9px;
        font-weight: 700;
        padding: 1px 5px;
        border-radius: 10px;
        border: 1px solid color-mix(in srgb, ${BLANCO} 20%, transparent);
        white-space: nowrap;
        pointer-events: none;
      ">
        ${textoVelocidad}
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: "marcador-guagua-3d",
    iconSize: [64, 64],
    iconAnchor: [32, 32],
  });
}
