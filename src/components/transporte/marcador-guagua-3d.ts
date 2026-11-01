import * as L from "leaflet";

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
  etiquetaParada = "Parada",
}: {
  rumbo?: number;
  estado?: EstadoViaje;
  velocidadKmh?: number;
  etiquetaParada?: string;
}): L.DivIcon {
  const esAveriado = estado === "averiado";

  const colorChasis = esAveriado ? "#B4342B" : "#2096BA";
  const colorBorde = esAveriado ? "#171A1D" : "#0A6A8A";
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
        background: ${esAveriado ? "rgba(180, 52, 43, 0.25)" : "rgba(32, 150, 186, 0.25)"};
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
          background: rgba(23, 26, 29, 0.35);
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
          box-shadow: 0 8px 16px -2px rgba(23, 26, 29, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.35);
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
            background: #171A1D;
            border-radius: 3px 3px 1px 1px;
            box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.4);
          "></div>

          <!-- Techo institucional con logo GE -->
          <div style="
            font-size: 8px;
            font-weight: 800;
            color: #FFFFFF;
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
            <span style="width: 4px; height: 3px; background: #B4342B; border-radius: 1px;"></span>
            <span style="width: 4px; height: 3px; background: #B4342B; border-radius: 1px;"></span>
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
          <span style="width: 4px; height: 4px; background: #FFFFFF; border-radius: 50%; box-shadow: 0 -4px 6px #FFFFFF;"></span>
          <span style="width: 4px; height: 4px; background: #FFFFFF; border-radius: 50%; box-shadow: 0 -4px 6px #FFFFFF;"></span>
        </div>
      </div>

      <!-- Etiqueta de velocidad flotante superior -->
      <div style="
        position: absolute;
        top: -10px;
        background: #171A1D;
        color: #FFFFFF;
        font-size: 9px;
        font-weight: 700;
        padding: 1px 5px;
        border-radius: 10px;
        border: 1px solid rgba(255, 255, 255, 0.2);
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
