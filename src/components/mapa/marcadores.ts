import * as L from "leaflet";

import { enlaceComoLlegar } from "@/lib/la-vega-geografia";

/**
 * Piezas de Leaflet que no son React: teselas, iconos y el HTML de los popups.
 *
 * Leaflet pinta marcadores y popups fuera del árbol de React, como HTML suelto.
 * Por eso aquí no hay hex: el color sale de clases de Tailwind (`bg-marca-500`,
 * `bg-card`…), que también existen en ese HTML y que con `.dark` cambian solas.
 * Tailwind 4 recorre este archivo al compilar, así que las clases se generan.
 */

/**
 * CARTO Positron / Dark Matter: base gris sin colores de carretera que
 * compitan con el turquesa de los marcadores. La de OSM estándar pintaba el
 * mapa de amarillos y rosas y los liceos se perdían.
 */
export const TESELAS = {
  claro: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  oscuro: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
} as const;

export const ATRIBUCION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>';

/**
 * Trazos de iconos de lucide (ISC), copiados tal cual: un `divIcon` necesita
 * el SVG como texto y montar un árbol de React por marcador sería un derroche.
 */
const TRAZOS = {
  liceo:
    '<path d="M14 21v-3a2 2 0 0 0-4 0v3"/><path d="M18 4.933V21"/><path d="m4 6 7.106-3.79a2 2 0 0 1 1.788 0L20 6"/><path d="m6 11-3.52 2.147a1 1 0 0 0-.48.854V19a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a1 1 0 0 0-.48-.853L18 11"/><path d="M6 4.933V21"/><circle cx="12" cy="9" r="2"/>',
  navegar: '<polygon points="3 11 22 2 13 21 11 13 3 11"/>',
} as const;

const svg = (trazo: string, tamano: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${tamano}" height="${tamano}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${trazo}</svg>`;

/** El HTML de Leaflet no escapa nada; un nombre con `<` rompería el popup o algo peor. */
export function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Marcador de liceo: círculo turquesa con el icono de escuela. El aproximado
 * (sin coordenadas propias, puesto en el centro de su municipio) va hueco y
 * con borde discontinuo, para que no se confunda con un punto verificado aun
 * sin color.
 */
export function iconoLiceo({
  aproximado,
  cantidad,
  activo,
}: {
  aproximado: boolean;
  cantidad: number;
  activo: boolean;
}): L.DivIcon {
  const cuerpo = aproximado
    ? "border-2 border-dashed border-marca-500 bg-card text-marca-600"
    : activo
      ? "border-2 border-white bg-marca-700 text-white ring-4 ring-marca-500/30"
      : "border-2 border-white bg-marca-500 text-white";
  const insignia =
    cantidad > 1
      ? `<span class="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full border-2 border-white bg-tinta text-[10px] font-semibold text-background">${cantidad}</span>`
      : "";
  return L.divIcon({
    className: "mapa-marcador",
    html: `<span class="relative flex size-10 items-center justify-center rounded-full shadow-elevada ${cuerpo}">${svg(TRAZOS.liceo, 20)}${insignia}</span>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -18],
  });
}

/** Chincheta del punto elegido (vivienda, liceo que se está ubicando). */
export function iconoPunto(): L.DivIcon {
  return L.divIcon({
    className: "mapa-marcador",
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" class="text-marca-600 drop-shadow-md" aria-hidden="true"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" fill="currentColor" stroke="white" stroke-width="1.5"/><circle cx="12" cy="10" r="3" fill="white"/></svg>`,
    iconSize: [40, 40],
    iconAnchor: [20, 38],
  });
}

/** Punto azul de "estás aquí", con su halo. */
export function iconoMiUbicacion(): L.DivIcon {
  return L.divIcon({
    className: "mapa-marcador",
    html: '<span class="block size-4 rounded-full border-2 border-white bg-marca-500 shadow-elevada ring-8 ring-marca-500/25"></span>',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

export interface TextosPopup {
  aproximado: string;
  ultimaVisita: (fecha: string) => string;
  sinVisitas: string;
  facilitadores: (n: number) => string;
  estudiantes: (n: number) => string;
  comoLlegar: string;
  formatearFecha: (iso: string) => string;
}

export interface DatosPopupLiceo {
  nombre: string;
  codigo?: string | null;
  municipio?: string | null;
  sector?: string | null;
  direccion?: string | null;
  latitud: number;
  longitud: number;
  aproximado?: boolean;
  ultimaVisita?: string | null;
  profesores?: Array<{ nombre: string; tanda: string }>;
  estudiantesCount?: number;
}

/** Ficha de un liceo dentro del popup. Si varios comparten punto, van apiladas. */
export function htmlFichaLiceo(l: DatosPopupLiceo, t: TextosPopup): string {
  const lugar = [l.codigo, l.municipio, l.sector].filter(Boolean).map((x) => escaparHtml(String(x)));
  const visita = l.ultimaVisita
    ? t.ultimaVisita(t.formatearFecha(l.ultimaVisita))
    : t.sinVisitas;
  const profesores = l.profesores ?? [];
  const nombresProf = profesores
    .map((p) => `${escaparHtml(p.nombre)} <span class="text-tinta-3">· ${escaparHtml(p.tanda)}</span>`)
    .join("<br/>");

  return `
    <div class="space-y-1.5">
      <p class="text-[15px] font-semibold leading-snug text-tinta">${escaparHtml(l.nombre)}</p>
      ${lugar.length ? `<p class="text-[13px] text-tinta-3">${lugar.join(" · ")}</p>` : ""}
      ${l.direccion ? `<p class="text-[13px] text-tinta-2">${escaparHtml(l.direccion)}</p>` : ""}
      ${l.aproximado ? `<p class="inline-flex rounded-full bg-marca-50 px-2 py-0.5 text-[12px] font-medium text-marca-700">${escaparHtml(t.aproximado)}</p>` : ""}
      <p class="text-[13px] text-tinta-2">${escaparHtml(visita)}</p>
      <p class="text-[13px] text-tinta-2">${escaparHtml(t.facilitadores(profesores.length))}${
        l.estudiantesCount != null ? ` · ${escaparHtml(t.estudiantes(l.estudiantesCount))}` : ""
      }</p>
      ${nombresProf ? `<p class="text-[12px] leading-relaxed text-tinta-2">${nombresProf}</p>` : ""}
      ${
        l.aproximado
          ? ""
          : `<a class="mapa-enlace inline-flex min-h-11 items-center gap-1.5 font-medium" href="${enlaceComoLlegar(l.latitud, l.longitud)}" target="_blank" rel="noopener noreferrer">${svg(TRAZOS.navegar, 16)}${escaparHtml(t.comoLlegar)}</a>`
      }
    </div>`;
}

export function htmlPopupGrupo(liceos: DatosPopupLiceo[], t: TextosPopup): string {
  return `<div class="max-h-72 space-y-3 divide-y divide-linea overflow-y-auto [&>*+*]:pt-3">${liceos
    .map((l) => htmlFichaLiceo(l, t))
    .join("")}</div>`;
}
