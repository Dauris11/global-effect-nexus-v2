/**
 * Geografía Oficial y Delimitación Estricta de la Provincia de La Vega, República Dominicana.
 *
 * Contiene los 4 municipios, distritos municipales, sectores, barrios y avenidas principales.
 * La regla de negocio exige que toda ubicación en mapa de liceos o vivienda de estudiantes
 * se encuentre estrictamente dentro de los límites provinciales de La Vega.
 */

export const LIMITES_LA_VEGA = {
  minLat: 18.7000,
  maxLat: 19.4500,
  minLng: -70.9500,
  maxLng: -70.3500,
} as const;

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
    centro: [19.2220, -70.5290],
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
    centro: [19.1210, -70.6420],
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
    centro: [18.9095, -70.7450],
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
    centro: [19.1320, -70.3750],
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
