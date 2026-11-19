import * as L from "leaflet";

import { AZUL, AZUL_OSCURO, BLANCO, SEMAFORO, TINTA } from "@/lib/paleta";
import type { TransporteParada } from "@/lib/transporte";

/**
 * Trazado vial georreferenciado real (OSRM / OpenStreetMap) por las avenidas de
 * Concepción de La Vega conectando:
 * 1. Edificio Fundación Global Effect (Av. Pedro A. Rivera #325)
 * 2. UNPHU — Recinto La Vega (Av. Federico García Godoy #71)
 * 3. UASD — Centro La Vega (Av. Monseñor Panal esq. José Cabrera)
 * 4. UCATECI — Campus Universitario (Av. Universitaria esq. Pedro A. Rivera)
 * 5. UTESA — Recinto / Conexión Universitaria (Av. Pedro A. Rivera esq. Autopista Duarte)
 */
export const GEOMETRIA_CIRCUITO_UNIVERSITARIO: [number, number][] = [
  [19.2248, -70.52551],
  [19.22434, -70.52563],
  [19.22345, -70.52586],
  [19.22286, -70.52602],
  [19.22161, -70.52635],
  [19.22189, -70.52689],
  [19.22199, -70.52708],
  [19.22175, -70.52716],
  [19.22165, -70.52718],
  [19.22158, -70.52719],
  [19.22148, -70.5272],
  [19.22123, -70.52726],
  [19.22158, -70.52719],
  [19.22151, -70.52687],
  [19.22133, -70.52613],
  [19.21968, -70.52676],
  [19.21966, -70.52677],
  [19.21981, -70.5277],
  [19.21999, -70.52877],
  [19.22015, -70.52971],
  [19.2202, -70.53003],
  [19.22029, -70.53054],
  [19.22036, -70.53096],
  [19.22037, -70.53105],
  [19.22028, -70.53106],
  [19.21894, -70.5311],
  [19.2188, -70.53111],
  [19.21827, -70.53114],
  [19.21825, -70.53106],
  [19.21893, -70.53102],
  [19.21966, -70.53099],
  [19.22028, -70.53096],
  [19.22036, -70.53096],
  [19.22152, -70.5307],
  [19.22181, -70.53064],
  [19.22191, -70.53062],
  [19.2224, -70.53052],
  [19.22324, -70.53034],
  [19.22327, -70.53034],
  [19.22385, -70.53021],
  [19.22389, -70.53023],
  [19.22452, -70.53008],
  [19.22528, -70.52989],
  [19.22594, -70.52971],
  [19.22577, -70.52906],
  [19.22567, -70.52868],
  [19.22566, -70.52863],
  [19.22555, -70.52822],
  [19.22541, -70.52748],
  [19.22531, -70.52703],
  [19.2253, -70.52693],
  [19.22531, -70.52679],
  [19.22535, -70.52658],
  [19.22527, -70.52604],
  [19.22524, -70.52539],
  [19.22519, -70.52474],
  [19.22518, -70.52431],
  [19.22517, -70.52392],
  [19.22513, -70.52309],
  [19.22508, -70.52226],
  [19.22504, -70.52181],
  [19.22503, -70.52178],
  [19.22502, -70.52151],
  [19.22501, -70.52136],
  [19.225, -70.52099],
  [19.22499, -70.52059],
  [19.22493, -70.51971],
  [19.22492, -70.51932],
  [19.22491, -70.5189],
  [19.22492, -70.51866],
  [19.22497, -70.51807],
  [19.22583, -70.5181],
  [19.22594, -70.5181],
  [19.22631, -70.51809],
  [19.22675, -70.51807],
  [19.22719, -70.51805],
  [19.22764, -70.51802],
  [19.22811, -70.518],
  [19.22854, -70.51798],
  [19.22902, -70.51796],
  [19.22944, -70.51793],
  [19.2299, -70.51791],
  [19.23036, -70.5179],
  [19.23073, -70.51789],
  [19.23082, -70.51788],
  [19.23089, -70.51789],
  [19.23097, -70.5179],
  [19.23099, -70.51791],
  [19.231, -70.51791],
  [19.23101, -70.51792],
  [19.23101, -70.51793],
  [19.23102, -70.51794],
  [19.23102, -70.51813],
  [19.23102, -70.51833],
  [19.23102, -70.51838],
  [19.23116, -70.51845],
  [19.2312, -70.51858],
  [19.23121, -70.5186],
  [19.23129, -70.51869],
  [19.23142, -70.51869],
  [19.23157, -70.51869],
  [19.23157, -70.51872],
  [19.23157, -70.51873],
  [19.2316, -70.51898],
  [19.23154, -70.51901],
  [19.23146, -70.51904],
  [19.23142, -70.51869],
  [19.23129, -70.51869],
  [19.23121, -70.5186],
  [19.2312, -70.51858],
  [19.23116, -70.51845],
  [19.23102, -70.51838],
  [19.23102, -70.51833],
  [19.23102, -70.51813],
  [19.23102, -70.51794],
  [19.23101, -70.51793],
  [19.23101, -70.51792],
  [19.231, -70.51791],
  [19.23099, -70.51791],
  [19.23097, -70.5179],
  [19.23089, -70.51789],
  [19.23082, -70.51788],
  [19.23073, -70.51789],
  [19.23036, -70.5179],
  [19.23033, -70.51742],
  [19.23029, -70.51692],
  [19.23056, -70.51694],
  [19.23059, -70.51692],
  [19.2306, -70.51688],
  [19.23065, -70.51647],
  [19.2308, -70.51511],
  [19.23086, -70.51456],
  [19.23126, -70.51461],
  [19.23141, -70.51464],
  [19.23207, -70.51473],
  [19.23233, -70.51479],
  [19.2325, -70.51483],
  [19.23279, -70.51486],
  [19.23292, -70.51483],
  [19.23306, -70.51479],
  [19.23339, -70.5147],
  [19.23373, -70.51451],
  [19.23398, -70.51438],
  [19.23415, -70.51427],
  [19.23434, -70.51414],
  [19.23473, -70.51384],
  [19.23511, -70.51358],
  [19.23543, -70.51338],
  [19.23547, -70.51336],
  [19.2355, -70.51334],
  [19.23555, -70.51331],
  [19.23576, -70.51319],
  [19.23582, -70.51314],
  [19.23589, -70.51305],
  [19.23594, -70.513],
  [19.23618, -70.51268],
  [19.23625, -70.51276],
  [19.2363, -70.51287],
  [19.23639, -70.51311],
  [19.23645, -70.51329],
  [19.23656, -70.51344],
  [19.23677, -70.51421],
];

export type CategoriaParadaTimob =
  | "sede"
  | "ucateci"
  | "unphu"
  | "uasd"
  | "utesa"
  | "parada";

export interface ClasificacionParada {
  categoria: CategoriaParadaTimob;
  sigla: string;
  etiquetaCorta: string;
  esSede: boolean;
  esUniversidad: boolean;
}

export interface EtaParadaTimob {
  paradaId: string;
  minutos: number;
  segundos: number;
  distanciaMetros: number;
  enParada: boolean;
}

export interface EstadoTelemetriaTimob {
  lat: number;
  lng: number;
  rumbo: number;
  velocidadKmh: number;
  progreso: number;
  direccion: "ida" | "retorno";
  longitudTotalMetros: number;
  paradaActual: TransporteParada | null;
  proximaParada: TransporteParada | null;
  etaProximaMinutos: number;
  distanciaProximaMetros: number;
  etasPorParada: Record<string, EtaParadaTimob>;
}

/**
 * Fórmula geodésica de Haversine (idéntica a `haversineDistanceMeters` en TIMOB).
 */
export function distanciaHaversineMetros(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const aRad = (grados: number) => (grados * Math.PI) / 180;
  const dLat = aRad(lat2 - lat1);
  const dLng = aRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(aRad(lat1)) *
      Math.cos(aRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Rumbo geodésico en grados (0° = Norte, 90° = Este, 180° = Sur, 270° = Oeste).
 */
export function calcularRumboGrados(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  if (Math.abs(lat1 - lat2) < 1e-7 && Math.abs(lng1 - lng2) < 1e-7) {
    return 0;
  }
  const aRad = (g: number) => (g * Math.PI) / 180;
  const aDeg = (r: number) => (r * 180) / Math.PI;
  const φ1 = aRad(lat1);
  const φ2 = aRad(lat2);
  const Δλ = aRad(lng2 - lng1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (aDeg(Math.atan2(y, x)) + 360) % 360;
}

/**
 * Identifica si una parada corresponde al Edificio Fundación Global Effect
 * o a una de las 4 universidades del convenio (UCATECI, UNPHU, UASD, UTESA).
 */
export function clasificarParadaInstitucional(
  parada: Pick<TransporteParada, "nombre" | "orden">,
): ClasificacionParada {
  const limpio = parada.nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  if (limpio.includes("GLOBAL EFFECT") || limpio.includes("OFICINA CENTRAL") || limpio.includes("EDIFICIO")) {
    return {
      categoria: "sede",
      sigla: "GE",
      etiquetaCorta: "Edificio Global Effect",
      esSede: true,
      esUniversidad: false,
    };
  }
  if (limpio.includes("UCATECI")) {
    return {
      categoria: "ucateci",
      sigla: "UCATECI",
      etiquetaCorta: "UCATECI",
      esSede: false,
      esUniversidad: true,
    };
  }
  if (limpio.includes("UNPHU")) {
    return {
      categoria: "unphu",
      sigla: "UNPHU",
      etiquetaCorta: "UNPHU La Vega",
      esSede: false,
      esUniversidad: true,
    };
  }
  if (limpio.includes("UASD")) {
    return {
      categoria: "uasd",
      sigla: "UASD",
      etiquetaCorta: "UASD La Vega",
      esSede: false,
      esUniversidad: true,
    };
  }
  if (limpio.includes("UTESA")) {
    return {
      categoria: "utesa",
      sigla: "UTESA",
      etiquetaCorta: "UTESA La Vega",
      esSede: false,
      esUniversidad: true,
    };
  }

  return {
    categoria: "parada",
    sigla: `P${parada.orden}`,
    etiquetaCorta: parada.nombre,
    esSede: false,
    esUniversidad: false,
  };
}

/**
 * Devuelve la polilínea vial OSRM si las paradas pertenecen al circuito
 * universitario de La Vega, o los vértices directos si es una ruta distinta.
 */
export function construirGeometriaRuta(
  paradas: TransporteParada[],
): [number, number][] {
  if (paradas.length === 0) return GEOMETRIA_CIRCUITO_UNIVERSITARIO;
  const tieneCircuitoUniversitario = paradas.some((p) => {
    const c = clasificarParadaInstitucional(p).categoria;
    return c === "sede" || c === "ucateci" || c === "unphu" || c === "uasd" || c === "utesa";
  });
  if (tieneCircuitoUniversitario) {
    return GEOMETRIA_CIRCUITO_UNIVERSITARIO;
  }
  return paradas.map((p) => [p.lat, p.lng]);
}

/**
 * Longitud total geodésica del trazado en metros.
 */
export function calcularLongitudRutaMetros(coords: [number, number][]): number {
  let total = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    total += distanciaHaversineMetros(
      coords[i][0],
      coords[i][1],
      coords[i + 1][0],
      coords[i + 1][1],
    );
  }
  return total > 0 ? total : 5975;
}

/**
 * Proyecta una coordenada `[lat, lng]` al progreso fraccional `[0..1]` sobre el trazado.
 */
export function proyectarCoordenadaEnRuta(
  coords: [number, number][],
  lat: number,
  lng: number,
): number {
  if (coords.length < 2) return 0;
  let mejorIdx = 0;
  let menorDistancia = Infinity;
  coords.forEach((c, idx) => {
    const d = distanciaHaversineMetros(lat, lng, c[0], c[1]);
    if (d < menorDistancia) {
      menorDistancia = d;
      mejorIdx = idx;
    }
  });
  return mejorIdx / (coords.length - 1);
}

/**
 * Motor cinemático TIMOB adaptado al circuito universitario de Fundación Global Effect:
 * calcula coordenadas interpoladas, rumbo real de la calle, velocidad comercial
 * y tiempos de llegada (ETAs) exactos a cada universidad y al edificio sede.
 */
export function interpolarEstadoSimulacion({
  geoCoords,
  paradas,
  progreso,
  direccion,
}: {
  geoCoords: [number, number][];
  paradas: TransporteParada[];
  progreso: number;
  direccion: "ida" | "retorno";
}): EstadoTelemetriaTimob {
  const coords = geoCoords.length >= 2 ? geoCoords : GEOMETRIA_CIRCUITO_UNIVERSITARIO;
  const longitudTotalMetros = calcularLongitudRutaMetros(coords);

  const pClamped = Math.max(0, Math.min(1, progreso));
  const indiceEscalado = pClamped * (coords.length - 1);
  const idx = Math.floor(indiceEscalado);
  const sub = indiceEscalado - idx;
  const p1 = coords[idx];
  const p2 = coords[Math.min(idx + 1, coords.length - 1)];

  const lat = p1[0] + (p2[0] - p1[0]) * sub;
  const lng = p1[1] + (p2[1] - p1[1]) * sub;

  const rumbo =
    direccion === "ida"
      ? calcularRumboGrados(p1[0], p1[1], p2[0], p2[1])
      : calcularRumboGrados(p2[0], p2[1], p1[0], p1[1]);

  // Proyectar cada parada sobre el trazado
  const fraccionesParada = paradas.map((parada) => ({
    parada,
    fraccion: proyectarCoordenadaEnRuta(coords, parada.lat, parada.lng),
    distanciaDirecta: distanciaHaversineMetros(lat, lng, parada.lat, parada.lng),
  }));

  // Velocidad comercial urbana (28 km/h en avenida; reduce a 12 km/h al acercarse a una parada)
  const paradaCercana = fraccionesParada.find((fp) => fp.distanciaDirecta < 85);
  const velocidadKmh = paradaCercana ? 14 : 30;
  const velocidadMetrosPorSeg = (26 * 1000) / 3600; // 26 km/h promedio efectivo para ETA

  const etasPorParada: Record<string, EtaParadaTimob> = {};
  let proximaParada: TransporteParada | null = null;
  let menorDeltaFuturo = Infinity;

  fraccionesParada.forEach(({ parada, fraccion, distanciaDirecta }) => {
    let deltaFraccion =
      direccion === "ida" ? fraccion - pClamped : pClamped - fraccion;

    if (deltaFraccion < -0.015) {
      // Ya pasó por esta parada en el sentido actual; sumar el retorno del circuito
      deltaFraccion =
        direccion === "ida"
          ? 1 - pClamped + (1 - fraccion)
          : pClamped + fraccion;
    } else if (deltaFraccion < 0) {
      deltaFraccion = 0;
    }

    const distanciaViaMetros = Math.max(
      Math.round(distanciaDirecta),
      Math.round(deltaFraccion * longitudTotalMetros),
    );
    const enParada = distanciaDirecta < 75;
    const segundos = enParada
      ? 15
      : Math.max(25, Math.round(distanciaViaMetros / velocidadMetrosPorSeg + 25));
    const minutos = enParada ? 0 : Math.max(1, Math.round(segundos / 60));

    etasPorParada[parada.id] = {
      paradaId: parada.id,
      minutos,
      segundos,
      distanciaMetros: distanciaViaMetros,
      enParada,
    };

    if (deltaFraccion >= 0 && deltaFraccion < menorDeltaFuturo) {
      menorDeltaFuturo = deltaFraccion;
      proximaParada = parada;
    }
  });

  if (!proximaParada && paradas.length > 0) {
    proximaParada = direccion === "ida" ? paradas[paradas.length - 1] : paradas[0];
  }

  const etaProxima = proximaParada ? etasPorParada[proximaParada.id] : null;

  return {
    lat,
    lng,
    rumbo,
    velocidadKmh,
    progreso: pClamped,
    direccion,
    longitudTotalMetros,
    paradaActual: paradaCercana?.parada ?? null,
    proximaParada,
    etaProximaMinutos: etaProxima?.minutos ?? 1,
    distanciaProximaMetros: etaProxima?.distanciaMetros ?? 0,
    etasPorParada,
  };
}

/**
 * Marcador Leaflet estilo TIMOB para cada parada institucional (Edificio Global Effect
 * y Universidades UCATECI, UNPHU, UASD, UTESA), con nodo circular y etiqueta flotante.
 */
export function iconoNodoParadaTimob({
  orden,
  sigla,
  etiqueta,
  esSede,
  activa,
  etaTexto,
}: {
  orden: number;
  sigla: string;
  etiqueta: string;
  esSede: boolean;
  activa: boolean;
  etaTexto: string;
}): L.DivIcon {
  const colorBorde = esSede ? TINTA : activa ? SEMAFORO.dentro : AZUL;
  const colorFondoInsignia = esSede ? TINTA : activa ? SEMAFORO.dentro : AZUL;
  const sombraAnillo = activa
    ? `0 0 0 4px color-mix(in srgb, ${SEMAFORO.dentro} 24%, transparent), 0 3px 10px rgba(0, 0, 0, 0.22)`
    : "0 2px 8px rgba(0, 0, 0, 0.18)";

  const html = `
    <div style="
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transform: translate(-12px, -12px);
      pointer-events: auto;
      cursor: pointer;
    ">
      <span style="
        width: 24px;
        height: 24px;
        border-radius: 9999px;
        background: ${BLANCO};
        border: 3px solid ${colorBorde};
        box-shadow: ${sombraAnillo};
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        font-weight: 800;
        color: ${TINTA};
        flex-shrink: 0;
      ">
        ${orden}
      </span>

      <span style="
        display: inline-flex;
        align-items: center;
        gap: 5px;
        background: color-mix(in srgb, ${BLANCO} 96%, transparent);
        border: 1.5px solid ${colorBorde};
        border-radius: 9999px;
        padding: 2px 8px 2px 4px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.14);
        white-space: nowrap;
      ">
        <span style="
          background: ${colorFondoInsignia};
          color: ${BLANCO};
          font-size: 9px;
          font-weight: 800;
          padding: 1px 5px;
          border-radius: 9999px;
          letter-spacing: 0.02em;
        ">${sigla}</span>
        <span style="
          font-size: 11px;
          font-weight: 700;
          color: ${TINTA};
        ">${etiqueta}</span>
        <span style="
          font-size: 10px;
          font-weight: 700;
          color: ${AZUL_OSCURO};
          border-left: 1px solid color-mix(in srgb, ${TINTA} 16%, transparent);
          padding-left: 5px;
        ">${etaTexto}</span>
      </span>
    </div>
  `;

  return L.divIcon({
    className: "mapa-marcador",
    html,
    iconSize: [24, 24],
    iconAnchor: [0, 0],
    popupAnchor: [12, -10],
  });
}

/**
 * Insignia del corredor sobre la polilínea (estilo `omsa-route-badge` de TIMOB).
 */
export function iconoInsigniaCorredorTimob(codigo: string): L.DivIcon {
  const html = `
    <div style="
      background: ${BLANCO};
      color: ${AZUL_OSCURO};
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.03em;
      padding: 1px 8px;
      border-radius: 9999px;
      border: 2px solid ${AZUL};
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.22);
      white-space: nowrap;
      text-align: center;
    ">${codigo}</div>
  `;
  return L.divIcon({
    className: "mapa-marcador",
    html,
    iconSize: [54, 20],
    iconAnchor: [27, 10],
  });
}

/**
 * Marcador pulsante de ubicación GPS ciudadana (estilo `leaflet-user-gps-dot` de TIMOB).
 */
export function iconoUbicacionCiudadanoTimob(): L.DivIcon {
  const html = `
    <div style="
      position: relative;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <span style="
        position: absolute;
        inset: -4px;
        border-radius: 9999px;
        background: color-mix(in srgb, ${AZUL} 28%, transparent);
        animation: guaguaOnda 2s infinite ease-out;
      "></span>
      <span style="
        position: relative;
        width: 12px;
        height: 12px;
        border-radius: 9999px;
        background: ${AZUL};
        border: 2.5px solid ${BLANCO};
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
      "></span>
    </div>
  `;
  return L.divIcon({
    className: "mapa-marcador",
    html,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}
