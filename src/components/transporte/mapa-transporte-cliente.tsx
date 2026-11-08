"use client";

import { useEffect, useRef, useState } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import "../mapa/mapa.css";
import { AlertCircle, Bus, Clock, MapPin, Navigation } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { BOUNDS_LEAFLET_LA_VEGA, CENTRO_LA_VEGA } from "@/lib/la-vega-geografia";
import { AZUL, AZUL_OSCURO, TINTA, BLANCO } from "@/lib/paleta";
import type { TransporteParada, TransporteViaje } from "@/lib/transporte";
import { iconoGuagua3D } from "./marcador-guagua-3d";

export interface PropsMapaTransporte {
  viajeInicial: (TransporteViaje & { paradas: TransporteParada[] }) | null;
  paradas: TransporteParada[];
}

/** Leaflet pinta los popups como HTML: todo texto de la BD pasa por aquí. */
function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function MapaTransporteCliente({
  viajeInicial,
  paradas,
}: PropsMapaTransporte) {
  const t = useTranslations("transport");
  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<L.Map | null>(null);
  const marcadorGuaguaRef = useRef<L.Marker | null>(null);
  const capaRutaRef = useRef<L.Polyline | null>(null);

  const [viaje, setViaje] = useState(viajeInicial);

  // Inicialización del mapa de Leaflet
  useEffect(() => {
    if (!contenedorRef.current || mapaRef.current) return;

    const mapa = L.map(contenedorRef.current, {
      center: [CENTRO_LA_VEGA.lat, CENTRO_LA_VEGA.lng],
      zoom: 12,
      minZoom: 10,
      maxZoom: 17,
      maxBounds: BOUNDS_LEAFLET_LA_VEGA,
      maxBoundsViscosity: 0.8,
      zoomControl: true,
    });

    const obtenerUrlTeselas = () =>
      document.documentElement.classList.contains("dark")
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

    const teselas = L.tileLayer(obtenerUrlTeselas(), {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(mapa);

    const observador = new MutationObserver(() => {
      teselas.setUrl(obtenerUrlTeselas());
    });
    observador.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    mapaRef.current = mapa;

    return () => {
      observador.disconnect();
      mapa.remove();
      mapaRef.current = null;
    };
  }, []);

  // Trazado de ruta y marcadores de paradas
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || paradas.length === 0) return;

    // 1. Trazado de la polilínea de la ruta
    const coordenadasRuta: [number, number][] = paradas.map((p) => [
      p.lat,
      p.lng,
    ]);

    if (capaRutaRef.current) {
      mapa.removeLayer(capaRutaRef.current);
    }

    const polyline = L.polyline(coordenadasRuta, {
      color: AZUL,
      weight: 4,
      opacity: 0.8,
      dashArray: "6, 8",
    }).addTo(mapa);

    capaRutaRef.current = polyline;

    // 2. Marcadores numerados de cada parada
    paradas.forEach((parada) => {
      const iconHtml = `
        <div style="
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: var(--card, #ffffff);
          border: 2px solid var(--color-marca-500, #2096BA);
          color: var(--color-marca-600, #0a6a8a);
          font-size: 11px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        ">
          ${parada.orden}
        </div>
      `;

      const marker = L.marker([parada.lat, parada.lng], {
        icon: L.divIcon({
          html: iconHtml,
          className: "parada-icono-circulo",
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        }),
      }).addTo(mapa);

      marker.bindPopup(`
        <div class="space-y-1 font-sans text-xs">
          <strong class="block text-sm font-semibold text-marca-600 dark:text-marca-300">
            ${parada.orden}. ${escapar(parada.nombre)}
          </strong>
          ${parada.referencia ? `<p class="text-tinta-2">${escapar(parada.referencia)}</p>` : ""}
          <p class="pt-0.5 font-medium text-tinta">
            ${t("popup.estimated", { minutes: parada.minutos_estimados })}
          </p>
        </div>
      `);
    });

    if (coordenadasRuta.length > 0) {
      mapa.fitBounds(L.latLngBounds(coordenadasRuta), { padding: [35, 35] });
    }
  }, [paradas, t]);

  // Actualización del marcador 3D de la guagua
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa) return;

    // Coordenadas actuales o primera parada de referencia
    const lat = viaje?.lat_actual ?? paradas[0]?.lat;
    const lng = viaje?.lng_actual ?? paradas[0]?.lng;

    if (!lat || !lng) return;

    const icono = iconoGuagua3D({
      rumbo: viaje?.rumbo ?? 0,
      estado: viaje?.estado ?? "programado",
      velocidadKmh: viaje?.velocidad_kmh ?? 0,
      etiquetaParada: t("popup.stopped"),
    });

    if (marcadorGuaguaRef.current) {
      marcadorGuaguaRef.current.setLatLng([lat, lng]);
      marcadorGuaguaRef.current.setIcon(icono);
    } else {
      const marcador = L.marker([lat, lng], {
        icon: icono,
        zIndexOffset: 1000,
      }).addTo(mapa);

      marcador.bindPopup(`
        <div class="space-y-1 font-sans text-xs">
          <strong class="block text-sm font-semibold text-marca-600 dark:text-marca-300">
            ${t("popup.title")}
          </strong>
          <p class="text-tinta">
            <span class="font-semibold">${t("popup.driver")}:</span> ${escapar(viaje?.chofer_nombre ?? t("popup.assigned"))}
          </p>
          <p class="text-tinta">
            <span class="font-semibold">${t("popup.status")}:</span> ${t(`status.${viaje?.estado ?? "programado"}`)}
          </p>
        </div>
      `);

      marcadorGuaguaRef.current = marcador;
    }
  }, [viaje, paradas, t]);

  // Sondeo periódico liviano en vivo cada 4 segundos cuando el viaje está en curso o averiado
  useEffect(() => {
    if (!viaje?.id || (viaje.estado !== "en_curso" && viaje.estado !== "averiado")) {
      return;
    }

    const intervalo = setInterval(async () => {
      try {
        const respuesta = await fetch(`/api/transporte/posicion?viajeId=${viaje.id}`);
        if (respuesta.ok) {
          const datos = await respuesta.json();
          if (datos && datos.id) {
            setViaje((prev) => (prev ? { ...prev, ...datos } : datos));
          }
        }
      } catch {
        // En caso de corte momentáneo de red, se mantiene la última posición
      }
    }, 4000);

    return () => clearInterval(intervalo);
  }, [viaje?.id, viaje?.estado]);

  const incidenciaActiva = viaje?.incidencias?.[0];

  return (
    <div className="relative w-full space-y-3">
      {/* Alerta de incidencia / avería si existe */}
      {incidenciaActiva && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-card bg-tinta p-4 text-background"
        >
          <AlertCircle className="size-5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold">{t("breakdownAlert")}</p>
            <p className="text-background/80">{incidenciaActiva.descripcion}</p>
          </div>
        </div>
      )}

      {/* Contenedor del Mapa Leaflet */}
      <div className="relative overflow-hidden rounded-card border border-linea shadow-card">
        <div
          ref={contenedorRef}
          className="mapa-la-vega h-[min(480px,65svh)] min-h-[320px] w-full"
        />

        {/* Tarjeta flotante con estado del transporte en la esquina superior */}
        <div className="pointer-events-none absolute top-3 left-3 z-[400] max-w-xs">
          <Card className="pointer-events-auto border-linea/60 bg-card/95 p-3 shadow-elevada backdrop-blur-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-tinta">
                <Navigation className="size-3.5 text-marca-500" />
                {viaje?.horario_nombre ?? t("scheduledTrip")}
              </span>
              <Badge
                variant={
                  viaje?.estado === "en_curso"
                    ? "marca"
                    : viaje?.estado === "averiado"
                      ? "destructive"
                      : "neutra"
                }
              >
                {t(`status.${viaje?.estado ?? "programado"}`)}
              </Badge>
            </div>

            <div className="mt-2 space-y-1 text-xs text-tinta-2">
              <p className="flex items-center gap-1">
                <Clock className="size-3 shrink-0" />
                <span>
                  {t("departure")}: {viaje?.hora_salida ?? "--:--"}
                </span>
              </p>
              {viaje?.parada_actual_nombre && (
                <p className="flex items-center gap-1 text-tinta">
                  <MapPin className="size-3 shrink-0 text-marca-600" />
                  <span className="truncate">
                    {t("approaching")}: <strong>{viaje.parada_actual_nombre}</strong>
                  </span>
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
