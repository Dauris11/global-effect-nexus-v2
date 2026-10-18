"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Building2,
  CheckCircle2,
  Home,
  LocateFixed,
  MapPin,
  Navigation,
  School,
  ShieldAlert,
} from "lucide-react";

import {
  BOUNDS_LEAFLET_LA_VEGA,
  CENTRO_LA_VEGA,
  estaEnLaVega,
  MUNICIPIOS_LA_VEGA,
} from "@/lib/la-vega-geografia";

export interface LiceoMapaItem {
  id: string;
  nombre: string;
  codigo?: string | null;
  municipio?: string | null;
  sector?: string | null;
  direccion?: string | null;
  latitud: number;
  longitud: number;
  profesores?: Array<{
    nombre: string;
    tanda: string;
  }>;
  estudiantesCount?: number;
}

interface PropsMapaLaVega {
  /** Modo de interacción: 'seleccion' para ubicar una coordenada, o 'liceos' para visualizar red de liceos */
  modo?: "seleccion" | "liceos" | "vista_vivienda";
  /** Coordenadas iniciales para el modo selección o vista_vivienda */
  lat?: number | null;
  lng?: number | null;
  /** Callback al seleccionar un punto en el mapa (modo selección) */
  alCambiarCoordenadas?: (lat: number, lng: number, meta?: { municipio?: string; sector?: string }) => void;
  /** Lista de liceos para renderizar en modo 'liceos' */
  liceos?: LiceoMapaItem[];
  /** Callback al pulsar un liceo */
  alSeleccionarLiceo?: (liceoId: string) => void;
  /** Altura del mapa (ej. '400px', '500px') */
  altura?: string;
  /** Título o descripción contextual */
  etiqueta?: string;
  soloLectura?: boolean;
}

export function MapaLaVega({
  modo = "seleccion",
  lat,
  lng,
  alCambiarCoordenadas,
  liceos = [],
  alSeleccionarLiceo,
  altura = "420px",
  etiqueta,
  soloLectura = false,
}: PropsMapaLaVega) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapaInstanciaRef = useRef<L.Map | null>(null);
  const marcadorRef = useRef<L.Marker | null>(null);
  const capaLiceosRef = useRef<L.LayerGroup | null>(null);

  const [coordsLocales, setCoordsLocales] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  // Coordenadas activas: locales si hubo interacción, o props si vinieron dadas
  const coordsSeleccionadas =
    coordsLocales ?? (lat && lng && estaEnLaVega(lat, lng) ? { lat, lng } : null);

  const [municipioActivo, setMunicipioActivo] = useState<string>("Concepción de La Vega");
  const [sectorActivo, setSectorActivo] = useState<string>("");
  const [errorLimite, setErrorLimite] = useState<string | null>(null);

  const alCambiarCoordenadasRef = useRef(alCambiarCoordenadas);
  const municipioActivoRef = useRef(municipioActivo);
  const sectorActivoRef = useRef(sectorActivo);
  const coordsSeleccionadasRef = useRef(coordsSeleccionadas);

  // Mantener refs sincronizadas fuera de la fase de render para cumplir con React 19
  useEffect(() => {
    alCambiarCoordenadasRef.current = alCambiarCoordenadas;
    municipioActivoRef.current = municipioActivo;
    sectorActivoRef.current = sectorActivo;
    coordsSeleccionadasRef.current = coordsSeleccionadas;
  });

  // Sincronizar marcador si cambian lat/lng por props externamente (sin setState en efecto)
  useEffect(() => {
    if (lat && lng && estaEnLaVega(lat, lng) && marcadorRef.current) {
      marcadorRef.current.setLatLng([lat, lng]);
    }
  }, [lat, lng]);

  // Inicialización del mapa Leaflet
  useEffect(() => {
    if (!contenedorRef.current) return;
    if (mapaInstanciaRef.current) return;

    const initialCoords = coordsSeleccionadasRef.current;

    // Crear mapa Leaflet acotado estrictamente a la provincia de La Vega
    const map = L.map(contenedorRef.current, {
      center: initialCoords
        ? [initialCoords.lat, initialCoords.lng]
        : [CENTRO_LA_VEGA.lat, CENTRO_LA_VEGA.lng],
      zoom: initialCoords ? 14 : 12,
      minZoom: 10,
      maxZoom: 18,
      maxBounds: BOUNDS_LEAFLET_LA_VEGA,
      maxBoundsViscosity: 1.0, // Impide arrastrar el mapa fuera de La Vega
    });

    // Capa de teselas OpenStreetMap estándar con atribución
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | Provincia de La Vega',
      maxZoom: 19,
    }).addTo(map);

    // Grupo para marcadores de liceos
    const capaLiceos = L.layerGroup().addTo(map);
    capaLiceosRef.current = capaLiceos;

    // Marcador interactivo SVG personalizado para evitar 404 de assets
    const crearIconoPin = (color: string) =>
      L.divIcon({
        className: "custom-map-pin",
        html: `
          <div style="transform: translate(-50%, -100%);">
            <svg width="34" height="42" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 0C7.58 0 4 3.58 4 8C4 13.54 11.24 21.38 11.55 21.71C11.79 21.97 12.21 21.97 12.45 21.71C12.76 21.38 20 13.54 20 8C20 3.58 16.42 0 12 0Z" fill="${color}"/>
              <circle cx="12" cy="8" r="3.5" fill="#FFFFFF"/>
            </svg>
          </div>
        `,
        iconSize: [34, 42],
        iconAnchor: [17, 42],
      });

    // Si ya hay coordenadas válidas, situar el marcador inicial
    if (initialCoords) {
      const marker = L.marker([initialCoords.lat, initialCoords.lng], {
        icon: crearIconoPin("#2096BA"),
        draggable: !soloLectura && modo === "seleccion",
      }).addTo(map);

      if (!soloLectura && modo === "seleccion") {
        marker.on("dragend", () => {
          const pos = marker.getLatLng();
          if (estaEnLaVega(pos.lat, pos.lng)) {
            setErrorLimite(null);
            setCoordsLocales({ lat: pos.lat, lng: pos.lng });
            alCambiarCoordenadasRef.current?.(pos.lat, pos.lng);
          } else {
            setErrorLimite("La ubicación debe estar dentro de la provincia de La Vega.");
            const revertCoords = coordsSeleccionadasRef.current;
            if (revertCoords) {
              marker.setLatLng([revertCoords.lat, revertCoords.lng]);
            }
          }
        });
      }

      marcadorRef.current = marker;
    }

    // Evento de clic en mapa para modo selección
    if (!soloLectura && modo === "seleccion") {
      map.on("click", (e: L.LeafletMouseEvent) => {
        const { lat: clickLat, lng: clickLng } = e.latlng;
        if (estaEnLaVega(clickLat, clickLng)) {
          setErrorLimite(null);
          setCoordsLocales({ lat: clickLat, lng: clickLng });

          if (marcadorRef.current) {
            marcadorRef.current.setLatLng([clickLat, clickLng]);
          } else {
            const marker = L.marker([clickLat, clickLng], {
              icon: crearIconoPin("#2096BA"),
              draggable: true,
            }).addTo(map);

            marker.on("dragend", () => {
              const pos = marker.getLatLng();
              if (estaEnLaVega(pos.lat, pos.lng)) {
                setErrorLimite(null);
                setCoordsLocales({ lat: pos.lat, lng: pos.lng });
                alCambiarCoordenadasRef.current?.(pos.lat, pos.lng);
              } else {
                setErrorLimite("Ubicación fuera de la provincia de La Vega.");
                marker.setLatLng([clickLat, clickLng]);
              }
            });

            marcadorRef.current = marker;
          }

          alCambiarCoordenadasRef.current?.(clickLat, clickLng, {
            municipio: municipioActivoRef.current,
            sector: sectorActivoRef.current,
          });
        } else {
          setErrorLimite("Punto fuera de los límites de la provincia de La Vega.");
        }
      });
    }

    mapaInstanciaRef.current = map;

    return () => {
      map.remove();
      mapaInstanciaRef.current = null;
    };
  }, [soloLectura, modo]);

  // Actualizar marcadores de liceos en modo 'liceos'
  useEffect(() => {
    const map = mapaInstanciaRef.current;
    const capaLiceos = capaLiceosRef.current;
    if (!map || !capaLiceos) return;

    capaLiceos.clearLayers();

    if (modo === "liceos" && liceos.length > 0) {
      const iconoLiceo = L.divIcon({
        className: "custom-liceo-pin",
        html: `
          <div style="transform: translate(-50%, -100%);">
            <div style="background-color: #0a6a8a; color: white; padding: 6px; border-radius: 9999px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.2); border: 2px solid white; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 22v-4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v4"/>
                <path d="M18 10h4l-10-7-10 7h4v12h12V10z"/>
              </svg>
            </div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
      });

      liceos.forEach((lic) => {
        if (!estaEnLaVega(lic.latitud, lic.longitud)) return;

        const m = L.marker([lic.latitud, lic.longitud], { icon: iconoLiceo }).addTo(capaLiceos);

        const profesoresHtml = lic.profesores && lic.profesores.length > 0
          ? `<div style="margin-top: 6px; font-size: 11px;">
              <strong>Profesores Habitudes:</strong>
              <ul style="margin: 2px 0 0 14px; padding: 0;">
                ${lic.profesores.map((p) => `<li>${p.nombre} (${p.tanda})</li>`).join("")}
              </ul>
            </div>`
          : `<p style="margin: 4px 0 0; font-size: 11px; opacity: 0.7;">Sin profesores asignados aún</p>`;

        m.bindPopup(`
          <div style="font-family: inherit; font-size: 12px; min-width: 200px;">
            <h4 style="margin: 0 0 4px; font-size: 13px; font-weight: 700; color: #0a6a8a;">${lic.nombre}</h4>
            <p style="margin: 0; opacity: 0.85;">${lic.direccion ?? ""}</p>
            <p style="margin: 2px 0 0; font-weight: 600; color: #2096BA;">${lic.municipio ?? "La Vega"} ${lic.sector ? `· ${lic.sector}` : ""}</p>
            ${profesoresHtml}
            ${lic.estudiantesCount != null ? `<p style="margin: 6px 0 0; font-size: 11px; font-weight: 600;">Estudiantes en Habitudes: ${lic.estudiantesCount}</p>` : ""}
          </div>
        `);

        m.on("click", () => {
          alSeleccionarLiceo?.(lic.id);
        });
      });
    }
  }, [modo, liceos, alSeleccionarLiceo]);

  // Centrar en un municipio seleccionado
  const irAMunicipio = (nombreMun: string) => {
    const mun = MUNICIPIOS_LA_VEGA.find((m) => m.nombre === nombreMun);
    if (!mun || !mapaInstanciaRef.current) return;
    setMunicipioActivo(nombreMun);
    setSectorActivo("");
    mapaInstanciaRef.current.flyTo(mun.centro, 13, { duration: 1.2 });
  };

  // Centrar en La Vega Capital
  const reajustarVista = () => {
    if (!mapaInstanciaRef.current) return;
    mapaInstanciaRef.current.flyTo([CENTRO_LA_VEGA.lat, CENTRO_LA_VEGA.lng], 12, { duration: 1 });
  };

  const munActual = MUNICIPIOS_LA_VEGA.find((m) => m.nombre === municipioActivo);

  return (
    <div className="space-y-3">
      {/* Barra de Controles y Selector de Municipios de La Vega */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
            <MapPin className="size-3.5 text-[#2096BA]" />
            <span>Provincia La Vega:</span>
          </div>

          {/* Selector de Municipios de La Vega */}
          <select
            value={municipioActivo}
            onChange={(e) => irAMunicipio(e.target.value)}
            className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 font-medium text-slate-800 dark:text-slate-200 outline-none focus:border-[#2096BA]"
          >
            {MUNICIPIOS_LA_VEGA.map((m) => (
              <option key={m.nombre} value={m.nombre}>
                {m.nombre}
              </option>
            ))}
          </select>

          {/* Selector de Distritos / Sectores del Municipio */}
          {munActual && (
            <select
              value={sectorActivo}
              onChange={(e) => setSectorActivo(e.target.value)}
              className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 font-medium text-slate-700 dark:text-slate-300 outline-none focus:border-[#2096BA] max-w-[200px]"
            >
              <option value="">Todos los distritos/sectores</option>
              {munActual.distritos.flatMap((d) =>
                d.sectores.map((s) => (
                  <option key={`${d.nombre}-${s.nombre}`} value={s.nombre}>
                    {d.nombre} — {s.nombre}
                  </option>
                )),
              )}
            </select>
          )}
        </div>

        <button
          type="button"
          onClick={reajustarVista}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-[#2096BA] transition-colors font-medium cursor-pointer"
        >
          <LocateFixed className="size-3.5 text-[#2096BA]" />
          Centrar La Vega
        </button>
      </div>

      {/* Alerta de Límite Estricto si se intentó salir */}
      {errorLimite && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[#B4342B]/10 text-[#B4342B] text-xs border border-[#B4342B]/30 animate-shake">
          <ShieldAlert className="size-4 shrink-0 text-[#B4342B]" />
          <span>{errorLimite}</span>
        </div>
      )}

      {/* Contenedor del Mapa Leaflet */}
      <div
        ref={contenedorRef}
        style={{ height: altura }}
        className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs relative z-0"
      />

      {/* Pie con Coordenadas y Estado */}
      <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2 px-1">
        <div className="flex items-center gap-1.5">
          {coordsSeleccionadas ? (
            <>
              <CheckCircle2 className="size-3.5 text-[#1E9E6A]" />
              <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300">
                Lat: {coordsSeleccionadas.lat.toFixed(6)}, Lng: {coordsSeleccionadas.lng.toFixed(6)}
              </span>
              <span className="text-[#1E9E6A] font-medium bg-[#1E9E6A]/15 px-2 py-0.5 rounded-full text-[10px] border border-[#1E9E6A]/30">
                ✓ Ubicación en La Vega
              </span>
            </>
          ) : (
            <span className="text-slate-500 italic">
              {modo === "seleccion"
                ? "Haz clic sobre el mapa o arrastra el marcador para fijar la ubicación en La Vega."
                : `Visualizando ${liceos.length} liceos registrados en la provincia.`}
            </span>
          )}
        </div>

        {etiqueta && <span className="font-medium text-slate-600 dark:text-slate-400">{etiqueta}</span>}
      </div>
    </div>
  );
}
