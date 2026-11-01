/**
 * Geografía Oficial y Delimitación Estricta de la Provincia de La Vega, República Dominicana.
 *
 * Contiene los 4 municipios, distritos municipales, sectores, barrios y avenidas principales.
 * La regla de negocio exige que toda ubicación en mapa de liceos o vivienda de estudiantes
 * se encuentre estrictamente dentro de los límites provinciales de La Vega.
 */

/**
 * Rectángulo que envuelve la provincia. No es el contorno real: deja fuera
 * parte de Valle Nuevo y mete trozos de Santiago y Monseñor Nouel, pero es la
 * misma caja que valida la base de datos (`chk_habitudes_liceo_bounds_la_vega`
 * y `chk_perfil_vivienda_bounds_la_vega`, migración 0045). Si se cambia aquí
 * sin una migración, el mapa dejaría elegir puntos que Postgres rechaza.
 */
export const LIMITES_LA_VEGA = {
  minLat: 18.7000,
  maxLat: 19.4500,
  minLng: -70.9500,
  maxLng: -70.3500,
} as const;

/** Parque Duarte de Concepción de La Vega, frente a la catedral. */
export const CENTRO_LA_VEGA = {
  lat: 19.2220,
  lng: -70.5290,
} as const;

export const BOUNDS_LEAFLET_LA_VEGA: [[number, number], [number, number]] = [
  [LIMITES_LA_VEGA.minLat, LIMITES_LA_VEGA.minLng],
  [LIMITES_LA_VEGA.maxLat, LIMITES_LA_VEGA.maxLng],
];

export interface SectorLaVega {
  nombre: string;
  callesPrincipales: string[];
}

export interface DistritoLaVega {
  nombre: string;
  sectores: SectorLaVega[];
}

export interface MunicipioLaVega {
  nombre: string;
  centro: [number, number];
  distritos: DistritoLaVega[];
}

export const MUNICIPIOS_LA_VEGA: MunicipioLaVega[] = [
  {
    nombre: "Concepción de La Vega",
    centro: [CENTRO_LA_VEGA.lat, CENTRO_LA_VEGA.lng],
    distritos: [
      {
        nombre: "Cabecera Urbana (La Vega Centro)",
        sectores: [
          {
            nombre: "Centro Ciudad",
            callesPrincipales: ["Calle Colón", "Calle Las Carreras", "Calle Padre Adolfo", "Calle Sánchez", "Calle Mella", "Calle Restauración", "Av. Monseñor Panal"],
          },
          {
            nombre: "Los Pomos",
            callesPrincipales: ["Av. Pedro A. Rivera", "Calle Principal Los Pomos", "Calle Los Pinos"],
          },
          {
            nombre: "Las Carmelitas",
            callesPrincipales: ["Calle Las Carmelitas", "Calle 3", "Calle Las Flores", "Av. Imbert"],
          },
          {
            nombre: "Villa Rosa",
            callesPrincipales: ["Calle Baldomero Brea", "Calle 5", "Calle Libertad"],
          },
          {
            nombre: "Palmarito",
            callesPrincipales: ["Calle Manuel Ubaldo Gómez", "Calle San Antonio", "Callejon Los Suárez"],
          },
          {
            nombre: "La Primavera",
            callesPrincipales: ["Calle 27 de Febrero", "Callejon La Primavera", "Av. Riva"],
          },
          {
            nombre: "Pontón",
            callesPrincipales: ["Autopista Duarte Vieja", "Calle Principal Pontón", "Entrada Don Fausto"],
          },
          {
            nombre: "Arenoso",
            callesPrincipales: ["Carretera Arenoso", "Calle Central", "Callejón Los Maestros"],
          },
          {
            nombre: "Soto",
            callesPrincipales: ["Carretera Soto", "Calle La Ceiba", "Entrada Los Robles"],
          },
        ],
      },
      {
        nombre: "Río Verde Arriba (Cutupú)",
        sectores: [
          {
            nombre: "Cutupú Centro",
            callesPrincipales: ["Carretera Ramón Cáceres", "Calle San Lorenzo", "Calle El Play"],
          },
          {
            nombre: "Río Verde",
            callesPrincipales: ["Carretera Río Verde", "Camino Real", "Entrada Los Pepines"],
          },
        ],
      },
      {
        nombre: "El Ranchito",
        sectores: [
          {
            nombre: "El Ranchito",
            callesPrincipales: ["Carretera La Vega - San Francisco", "Calle El Mango", "Calle La Iglesia"],
          },
        ],
      },
      {
        nombre: "Tavera",
        sectores: [
          {
            nombre: "Presa de Tavera",
            callesPrincipales: ["Carretera La Presa", "Camino Tavera", "El Anón"],
          },
        ],
      },
    ],
  },
  {
    nombre: "Jarabacoa",
    // Aproximado: parque central del pueblo. El valor anterior caía ~500 m al
    // oeste, ya fuera del casco urbano.
    centro: [19.1190, -70.6375],
    distritos: [
      {
        nombre: "Jarabacoa Urbano",
        sectores: [
          {
            nombre: "Centro Jarabacoa",
            callesPrincipales: ["Av. Víctor Méndez Capellán", "Calle Norberto Martínez", "Calle Independencia", "Calle Duarte"],
          },
          {
            nombre: "Pinar Dorado",
            callesPrincipales: ["Av. La Confluencia", "Calle Los Pinos", "Calle Los Helechos"],
          },
          {
            nombre: "Yerba Buena",
            callesPrincipales: ["Carretera Manabao", "Camino Yerba Buena", "Callejón El Río"],
          },
        ],
      },
      {
        nombre: "Buena Vista",
        sectores: [
          {
            nombre: "Buena Vista",
            callesPrincipales: ["Carretera Federico Basilis", "Callejon Los Cajuiles", "Entrada El Salto"],
          },
        ],
      },
      {
        nombre: "Manabao",
        sectores: [
          {
            nombre: "Manabao Centro",
            callesPrincipales: ["Carretera Hacia Pico Duarte", "Calle Los Guázaras", "La Ciénaga"],
          },
        ],
      },
    ],
  },
  {
    nombre: "Constanza",
    // Aproximado: centro del pueblo (calle Luperón).
    centro: [18.9095, -70.7445],
    distritos: [
      {
        nombre: "Constanza Urbano",
        sectores: [
          {
            nombre: "Centro Constanza",
            callesPrincipales: ["Calle Luperón", "Calle Sánchez", "Calle Matilde Viñas", "Calle Rufino Espinosa"],
          },
          {
            nombre: "Colonia Española",
            callesPrincipales: ["Av. Los Colonos", "Calle Las Hortensias", "Calle Los Pinos"],
          },
          {
            nombre: "El Cercado",
            callesPrincipales: ["Carretera Palero", "Calle Central El Cercado"],
          },
        ],
      },
      {
        nombre: "Tireo",
        sectores: [
          {
            nombre: "Tireo al Medio",
            callesPrincipales: ["Carretera Tireo", "Calle Los Vegetales", "Entrada La Loma"],
          },
        ],
      },
      {
        nombre: "La Sabina",
        sectores: [
          {
            nombre: "La Sabina",
            callesPrincipales: ["Carretera La Sabina", "Calle Los Profesores", "Entrada El Valle"],
          },
        ],
      },
    ],
  },
  {
    nombre: "Jima Abajo",
    // Aproximado: cabecera municipal. El valor anterior quedaba ~800 m al este,
    // en pleno arrozal.
    centro: [19.1330, -70.3800],
    distritos: [
      {
        nombre: "Jima Abajo Urbano",
        sectores: [
          {
            nombre: "Centro Jima",
            callesPrincipales: ["Calle Duarte", "Calle Mella", "Calle San Bartolo", "Carretera Principal"],
          },
          {
            nombre: "La Frontera",
            callesPrincipales: ["Calle El Canal", "Calle Los Parceleros"],
          },
        ],
      },
      {
        nombre: "Rincón",
        sectores: [
          {
            nombre: "Rincón Centro",
            callesPrincipales: ["Carretera Autopista Duarte - Rincón", "Calle El Play", "Entrada La Iglesia"],
          },
        ],
      },
    ],
  },
];

/**
 * Valida de forma estricta si las coordenadas geográficas caen dentro de la provincia de La Vega.
 */
export function estaEnLaVega(lat: number | null | undefined, lng: number | null | undefined): boolean {
  if (lat == null || lng == null) return false;
  return (
    lat >= LIMITES_LA_VEGA.minLat &&
    lat <= LIMITES_LA_VEGA.maxLat &&
    lng >= LIMITES_LA_VEGA.minLng &&
    lng <= LIMITES_LA_VEGA.maxLng
  );
}

const sinAcentos = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

/**
 * Busca un municipio por nombre tolerando cómo se escribió en la base: "La
 * Vega", "concepcion de la vega" y "Concepción de La Vega" son el mismo.
 */
export function buscarMunicipio(nombre: string | null | undefined): MunicipioLaVega | null {
  if (!nombre) return null;
  const buscado = sinAcentos(nombre);
  return (
    MUNICIPIOS_LA_VEGA.find((m) => sinAcentos(m.nombre) === buscado) ??
    MUNICIPIOS_LA_VEGA.find(
      (m) => sinAcentos(m.nombre).includes(buscado) || buscado.includes(sinAcentos(m.nombre)),
    ) ??
    null
  );
}

/** Distancia en metros entre dos puntos (haversine; sobra precisión para una provincia). */
export function distanciaMetros(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Municipio cuyo centro queda más cerca del punto. Es una aproximación —los
 * municipios no son círculos—, pero acierta mucho más que fiarse de lo que
 * diga el selector, que el usuario casi nunca cambia antes de pinchar.
 */
export function municipioMasCercano(lat: number, lng: number): MunicipioLaVega {
  let mejor = MUNICIPIOS_LA_VEGA[0];
  let menor = Infinity;
  for (const m of MUNICIPIOS_LA_VEGA) {
    const d = distanciaMetros({ lat, lng }, { lat: m.centro[0], lng: m.centro[1] });
    if (d < menor) {
      menor = d;
      mejor = m;
    }
  }
  return mejor;
}

/** Enlace de Google Maps con la ruta hasta el punto desde donde esté el usuario. */
export function enlaceComoLlegar(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat.toFixed(6)},${lng.toFixed(6)}`;
}
