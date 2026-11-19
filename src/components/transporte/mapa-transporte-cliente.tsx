"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import "../mapa/mapa.css";
import {
  AlertCircle,
  Building2,
  Bus,
  Clock,
  GraduationCap,
  LocateFixed,
  MapPin,
  Maximize2,
  Minimize2,
  Navigation,
  Radio,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CENTRO_LA_VEGA } from "@/lib/la-vega-geografia";
import { AZUL, BLANCO, TINTA } from "@/lib/paleta";
import type { TransporteParada, TransporteViaje } from "@/lib/transporte";
import { cn } from "@/lib/utils";
import {
  clasificarParadaInstitucional,
  construirGeometriaRuta,
  iconoInsigniaCorredorTimob,
  iconoNodoParadaTimob,
  iconoUbicacionCiudadanoTimob,
  interpolarEstadoSimulacion,
  proyectarCoordenadaEnRuta,
} from "./cinematica-timob";
import { iconoGuagua3D } from "./marcador-guagua-3d";

export interface PropsMapaTransporte {
  viajeInicial: (TransporteViaje & { paradas: TransporteParada[] }) | null;
  paradas: TransporteParada[];
  vivienda?: { lat: number; lng: number; direccion: string | null } | null;
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
  vivienda = null,
}: PropsMapaTransporte) {
  const t = useTranslations("transport");
  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<L.Map | null>(null);
  const marcadorGuaguaRef = useRef<L.Marker | null>(null);
  const capaRutaCasingRef = useRef<L.Polyline | null>(null);
  const capaRutaLineaRef = useRef<L.Polyline | null>(null);
  const marcadorInsigniaRutaRef = useRef<L.Marker | null>(null);
  const marcadoresParadasRef = useRef<Map<string, L.Marker>>(new Map());
  const marcadorUsuarioRef = useRef<L.Marker | null>(null);
  const circuloPrecisionRef = useRef<L.Circle | null>(null);

  const [viaje, setViaje] = useState(viajeInicial);
  const [ampliado, setAmpliado] = useState(false);
  const [seguirGuagua, setSeguirGuagua] = useState(false);
  const [filtroActivo, setFiltroActivo] = useState<string>("all");
  const [estadoGpsUsuario, setEstadoGpsUsuario] = useState<
    "inactivo" | "buscando" | "activo"
  >("inactivo");

  // Estado cinemático continuo estilo TIMOB (progreso 0..1 y sentido ida/retorno)
  const [simulacion, setSimulacion] = useState<{
    progreso: number;
    direccion: "ida" | "retorno";
  }>({
    progreso: 0.08,
    direccion: "ida",
  });

  const geoCoords = useMemo(() => construirGeometriaRuta(paradas), [paradas]);

  const tieneGpsChoferEnVivo = Boolean(
    viaje?.estado === "en_curso" &&
      typeof viaje?.lat_actual === "number" &&
      typeof viaje?.lng_actual === "number",
  );

  // Si el chofer reporta GPS real, proyectamos su coordenada sobre el trazado
  const progresoEfectivo = useMemo(() => {
    if (
      tieneGpsChoferEnVivo &&
      typeof viaje?.lat_actual === "number" &&
      typeof viaje?.lng_actual === "number"
    ) {
      return proyectarCoordenadaEnRuta(
        geoCoords,
        viaje.lat_actual,
        viaje.lng_actual,
      );
    }
    return simulacion.progreso;
  }, [
    tieneGpsChoferEnVivo,
    viaje?.lat_actual,
    viaje?.lng_actual,
    geoCoords,
    simulacion.progreso,
  ]);

  const telemetria = useMemo(() => {
    const base = interpolarEstadoSimulacion({
      geoCoords,
      paradas,
      progreso: progresoEfectivo,
      direccion: simulacion.direccion,
    });

    if (
      tieneGpsChoferEnVivo &&
      typeof viaje?.lat_actual === "number" &&
      typeof viaje?.lng_actual === "number"
    ) {
      return {
        ...base,
        lat: viaje.lat_actual,
        lng: viaje.lng_actual,
        rumbo: viaje.rumbo ?? base.rumbo,
        velocidadKmh:
          typeof viaje.velocidad_kmh === "number" && viaje.velocidad_kmh > 0
            ? viaje.velocidad_kmh
            : base.velocidadKmh,
      };
    }

    return base;
  }, [
    geoCoords,
    paradas,
    progresoEfectivo,
    simulacion.direccion,
    tieneGpsChoferEnVivo,
    viaje,
  ]);

  // Encuadrar todo el circuito universitario
  const encuadrarCircuito = useCallback(() => {
    const mapa = mapaRef.current;
    if (!mapa) return;
    const puntos: [number, number][] =
      paradas.length > 0
        ? paradas.map((p) => [p.lat, p.lng])
        : geoCoords;
    if (puntos.length > 0) {
      mapa.fitBounds(L.latLngBounds(puntos), {
        padding: [48, 48],
        maxZoom: 15,
      });
    }
  }, [paradas, geoCoords]);

  // Enfocar una parada específica (Edificio Global Effect o Universidad) como en TIMOB
  const enfocarParada = useCallback(
    (paradaId: string) => {
      const mapa = mapaRef.current;
      if (!mapa) return;
      setSeguirGuagua(false);

      if (paradaId === "all") {
        setFiltroActivo("all");
        encuadrarCircuito();
        mapa.closePopup();
        return;
      }

      const parada = paradas.find((p) => p.id === paradaId);
      if (!parada) return;

      setFiltroActivo(parada.id);
      mapa.flyTo([parada.lat, parada.lng], 16, { duration: 0.85 });
      const marcador = marcadoresParadasRef.current.get(parada.id);
      if (marcador) {
        setTimeout(() => {
          marcador.openPopup();
        }, 400);
      }
    },
    [paradas, encuadrarCircuito],
  );

  // Alternar tamaño del mapa con recalibración escalonada igual que `RadarMapEngine.resize()` en TIMOB
  const alternarTamanoMapa = useCallback(() => {
    setAmpliado((prev) => !prev);
    const ticks = [40, 120, 220, 350];
    ticks.forEach((ms) => {
      setTimeout(() => {
        mapaRef.current?.invalidateSize();
      }, ms);
    });
  }, []);

  // Geolocalización ciudadana estilo TIMOB (`initCitizenGpsControl`)
  const localizarMiUbicacion = useCallback(() => {
    const mapa = mapaRef.current;
    if (!mapa) return;

    const pintarPosicion = (lat: number, lng: number, precision: number) => {
      const coords: [number, number] = [lat, lng];
      const radio = Math.min(Math.max(precision || 35, 18), 250);

      if (!circuloPrecisionRef.current) {
        circuloPrecisionRef.current = L.circle(coords, {
          radius: radio,
          color: AZUL,
          weight: 1,
          opacity: 0.35,
          fillColor: AZUL,
          fillOpacity: 0.12,
        }).addTo(mapa);
      } else {
        circuloPrecisionRef.current.setLatLng(coords);
        circuloPrecisionRef.current.setRadius(radio);
      }

      if (!marcadorUsuarioRef.current) {
        marcadorUsuarioRef.current = L.marker(coords, {
          icon: iconoUbicacionCiudadanoTimob(),
          zIndexOffset: 4000,
        })
          .addTo(mapa)
          .bindTooltip(
            `<strong>${escapar(t("timob.yourLocation"))}</strong>`,
          );
      } else {
        marcadorUsuarioRef.current.setLatLng(coords);
      }

      setEstadoGpsUsuario("activo");
      setSeguirGuagua(false);
      mapa.flyTo(coords, 16, { duration: 1.0 });
    };

    setEstadoGpsUsuario("buscando");

    if (typeof navigator !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          pintarPosicion(
            pos.coords.latitude,
            pos.coords.longitude,
            pos.coords.accuracy,
          );
        },
        () => {
          // Respaldo en PC de escritorio sin sensor GPS: centrar en Edificio Fundación Global Effect
          const sede = paradas[0];
          pintarPosicion(
            sede?.lat ?? CENTRO_LA_VEGA.lat,
            sede?.lng ?? CENTRO_LA_VEGA.lng,
            40,
          );
        },
        { enableHighAccuracy: true, timeout: 5000 },
      );
    } else {
      const sede = paradas[0];
      pintarPosicion(
        sede?.lat ?? CENTRO_LA_VEGA.lat,
        sede?.lng ?? CENTRO_LA_VEGA.lng,
        40,
      );
    }
  }, [paradas, t]);

  // 1. Inicialización del mapa de Leaflet con cartografía OpenStreetMap libre (como en TIMOB)
  useEffect(() => {
    if (!contenedorRef.current || mapaRef.current) return;

    const mapa = L.map(contenedorRef.current, {
      center: [19.2268, -70.5235],
      zoom: 14,
      minZoom: 9,
      maxZoom: 19,
      maxBounds: [
        [17.8, -72.05], // Suroeste RD
        [20.1, -68.3], // Noreste RD
      ],
      maxBoundsViscosity: 0.85,
      zoomControl: false,
    });

    // Capa de mapa limpia OpenStreetMap (100 % libre sin marcas de agua ni API keys)
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(mapa);

    L.control.zoom({ position: "bottomright" }).addTo(mapa);

    mapaRef.current = mapa;

    const observadorResize =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            mapa.invalidateSize();
          })
        : null;
    if (observadorResize && contenedorRef.current) {
      observadorResize.observe(contenedorRef.current);
    }

    return () => {
      observadorResize?.disconnect();
      mapa.remove();
      mapaRef.current = null;
    };
  }, []);

  // 2. Trazado vial estilo TIMOB (doble polilínea con halo blanco + insignia de corredor + paradas)
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || paradas.length === 0) return;

    if (capaRutaCasingRef.current) {
      mapa.removeLayer(capaRutaCasingRef.current);
    }
    if (capaRutaLineaRef.current) {
      mapa.removeLayer(capaRutaLineaRef.current);
    }
    if (marcadorInsigniaRutaRef.current) {
      mapa.removeLayer(marcadorInsigniaRutaRef.current);
    }
    marcadoresParadasRef.current.forEach((m) => mapa.removeLayer(m));
    marcadoresParadasRef.current.clear();

    // Halo blanco exterior de vía (estilo `casing` de TIMOB `drawGeoRoutes`)
    const casing = L.polyline(geoCoords, {
      color: BLANCO,
      weight: 9,
      opacity: 0.92,
      lineCap: "round",
      lineJoin: "round",
    }).addTo(mapa);

    // Línea principal del corredor institucional
    const polyline = L.polyline(geoCoords, {
      color: AZUL,
      weight: 5,
      opacity: 0.96,
      lineCap: "round",
      lineJoin: "round",
    }).addTo(mapa);

    const kmTotal = (telemetria.longitudTotalMetros / 1000).toFixed(1);
    const listaParadasHtml = paradas
      .map(
        (p) =>
          `<li class="py-0.5"><span class="font-semibold text-tinta">${p.orden}. ${escapar(p.nombre)}</span></li>`,
      )
      .join("");

    const popupCorredorHtml = `
      <div class="space-y-2 font-sans text-xs">
        <div class="flex items-center gap-2">
          <span class="inline-flex items-center rounded-full bg-marca-500 px-2 py-0.5 text-[10px] font-bold text-white">
            ${escapar(t("timob.corridorBadge"))}
          </span>
          <div>
            <strong class="block text-sm font-bold text-tinta">
              ${escapar(t("timob.corridorTitle"))}
            </strong>
            <span class="text-[11px] text-tinta-2">
              ${escapar(t("timob.corridorMeta", { km: kmTotal, count: paradas.length }))}
            </span>
          </div>
        </div>
        <ol class="divide-y divide-linea/60 border-t border-linea pt-1.5 text-tinta-2">
          ${listaParadasHtml}
        </ol>
      </div>
    `;

    polyline.bindPopup(popupCorredorHtml);

    // Insignia del corredor en el punto medio del trazado (estilo TIMOB `omsa-route-badge`)
    const puntoMedio = geoCoords[Math.floor(geoCoords.length * 0.52)] ?? geoCoords[0];
    if (puntoMedio) {
      const badgeMarker = L.marker(puntoMedio, {
        icon: iconoInsigniaCorredorTimob(t("timob.corridorBadge")),
        keyboard: false,
      }).addTo(mapa);
      badgeMarker.on("click", () => {
        polyline.openPopup(puntoMedio);
      });
      marcadorInsigniaRutaRef.current = badgeMarker;
    }

    capaRutaCasingRef.current = casing;
    capaRutaLineaRef.current = polyline;

    // Marcadores de paradas (Edificio Global Effect y Universidades UCATECI, UNPHU, UASD, UTESA)
    paradas.forEach((parada) => {
      const info = clasificarParadaInstitucional(parada);
      const eta = telemetria.etasPorParada[parada.id];
      const etaTexto = eta?.enParada
        ? t("timob.atStopNow")
        : t("timob.etaMinutes", { minutes: eta?.minutos ?? parada.minutos_estimados });

      const marker = L.marker([parada.lat, parada.lng], {
        icon: iconoNodoParadaTimob({
          orden: parada.orden,
          sigla: info.sigla,
          etiqueta: info.etiquetaCorta,
          esSede: info.esSede,
          activa: telemetria.proximaParada?.id === parada.id,
          etaTexto,
        }),
        zIndexOffset: info.esSede ? 600 : 450,
      }).addTo(mapa);

      const tipoParadaTexto = info.esSede
        ? t("timob.stopTypeHq")
        : info.esUniversidad
          ? t("timob.stopTypeUniversity")
          : t("timob.stopTypeCorridor");

      marker.bindPopup(`
        <div class="space-y-1.5 font-sans text-xs">
          <div class="flex items-center gap-1.5">
            <span class="inline-flex items-center rounded-full bg-marca-50 px-2 py-0.5 text-[10px] font-bold text-marca-700">
              ${escapar(info.sigla)} · ${escapar(tipoParadaTexto)}
            </span>
          </div>
          <strong class="block text-sm font-bold text-tinta">
            ${parada.orden}. ${escapar(parada.nombre)}
          </strong>
          ${parada.referencia ? `<p class="text-tinta-2">${escapar(parada.referencia)}</p>` : ""}
          <p class="border-t border-linea pt-1 font-semibold text-marca-600">
            ${escapar(etaTexto)} · ${escapar(t("timob.distanceAway", { meters: eta?.distanciaMetros ?? 0 }))}
          </p>
        </div>
      `);

      marker.on("click", () => {
        setFiltroActivo(parada.id);
      });

      marcadoresParadasRef.current.set(parada.id, marker);
    });

    if (vivienda) {
      const homeHtml = `
        <div style="
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: ${TINTA};
          border: 2px solid ${BLANCO};
          color: ${BLANCO};
          font-size: 11px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
        ">
          ⌂
        </div>
      `;

      const homeMarker = L.marker([vivienda.lat, vivienda.lng], {
        icon: L.divIcon({
          html: homeHtml,
          className: "parada-icono-circulo",
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        }),
      }).addTo(mapa);

      homeMarker.bindPopup(`
        <div class="space-y-1 font-sans text-xs">
          <strong class="block text-sm font-semibold text-tinta">
            ${escapar(t("popup.studentHome"))}
          </strong>
          ${vivienda.direccion ? `<p class="text-tinta-2">${escapar(vivienda.direccion)}</p>` : ""}
        </div>
      `);
    }

    const puntosEncuadre: [number, number][] = paradas.map((p) => [p.lat, p.lng]);
    if (puntosEncuadre.length > 0) {
      mapa.fitBounds(L.latLngBounds(puntosEncuadre), {
        padding: [48, 48],
        maxZoom: 15,
      });
    }
    // Solo re-creamos capas base cuando cambian las paradas o la vivienda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paradas, vivienda, geoCoords]);

  // 3. Actualizar dinámicamente las etiquetas de ETA en los nodos de parada cada segundo
  useEffect(() => {
    paradas.forEach((parada) => {
      const marker = marcadoresParadasRef.current.get(parada.id);
      if (!marker) return;

      const info = clasificarParadaInstitucional(parada);
      const eta = telemetria.etasPorParada[parada.id];
      const etaTexto = eta?.enParada
        ? t("timob.atStopNow")
        : t("timob.etaMinutes", { minutes: eta?.minutos ?? parada.minutos_estimados });

      marker.setIcon(
        iconoNodoParadaTimob({
          orden: parada.orden,
          sigla: info.sigla,
          etiqueta: info.etiquetaCorta,
          esSede: info.esSede,
          activa:
            telemetria.proximaParada?.id === parada.id ||
            filtroActivo === parada.id,
          etaTexto,
        }),
      );
    });
  }, [paradas, telemetria, filtroActivo, t]);

  // 4. Actualización del marcador 3D de la guagua institucional
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa) return;

    const estadoVisual =
      viaje?.estado === "averiado" ? "averiado" : "en_curso";

    const icono = iconoGuagua3D({
      rumbo: telemetria.rumbo,
      estado: estadoVisual,
      velocidadKmh: telemetria.velocidadKmh,
      etiquetaParada: t("popup.stopped"),
    });

    const popupGuaguaHtml = `
      <div class="space-y-1 font-sans text-xs">
        <div class="flex items-center justify-between gap-2">
          <strong class="block text-sm font-bold text-marca-600">
            ${escapar(t("timob.unitCode"))} · ${escapar(t("popup.title"))}
          </strong>
        </div>
        <p class="text-tinta">
          <span class="font-semibold">${escapar(t("popup.driver"))}:</span> ${escapar(viaje?.chofer_nombre ?? t("popup.assigned"))}
        </p>
        <p class="text-tinta">
          <span class="font-semibold">${escapar(t("approaching"))}:</span> ${escapar(telemetria.proximaParada?.nombre ?? "--")} (${escapar(t("timob.etaMinutes", { minutes: telemetria.etaProximaMinutos }))})
        </p>
        <p class="text-tinta-2">
          <span class="font-semibold">${escapar(t("timob.speedLabel"))}:</span> ${Math.round(telemetria.velocidadKmh)} km/h
        </p>
      </div>
    `;

    if (marcadorGuaguaRef.current) {
      marcadorGuaguaRef.current.setLatLng([telemetria.lat, telemetria.lng]);
      marcadorGuaguaRef.current.setIcon(icono);
      marcadorGuaguaRef.current.setPopupContent(popupGuaguaHtml);
    } else {
      const marcador = L.marker([telemetria.lat, telemetria.lng], {
        icon: icono,
        zIndexOffset: 2500,
      }).addTo(mapa);

      marcador.bindPopup(popupGuaguaHtml);
      marcadorGuaguaRef.current = marcador;
    }

    if (seguirGuagua) {
      mapa.panTo([telemetria.lat, telemetria.lng], { animate: true });
    }
  }, [telemetria, viaje, seguirGuagua, t]);

  // 5. Bucle de simulación cinemática continua (1 segundo) estilo `ActiveFleetSimulator` de TIMOB
  useEffect(() => {
    if (tieneGpsChoferEnVivo || viaje?.estado === "averiado") {
      return;
    }

    const intervalo = setInterval(() => {
      setSimulacion((prev) => {
        const delta = 0.0045; // Avance suave sobre los 162 vértices viales de La Vega
        if (prev.direccion === "ida") {
          const siguiente = prev.progreso + delta;
          if (siguiente >= 1) {
            return { progreso: 0.995, direccion: "retorno" };
          }
          return { progreso: siguiente, direccion: "ida" };
        } else {
          const siguiente = prev.progreso - delta;
          if (siguiente <= 0) {
            return { progreso: 0.005, direccion: "ida" };
          }
          return { progreso: siguiente, direccion: "retorno" };
        }
      });
    }, 1000);

    return () => clearInterval(intervalo);
  }, [tieneGpsChoferEnVivo, viaje?.estado]);

  // 6. Sondeo periódico al servidor cada 4 segundos cuando existe un viaje activo en BD
  useEffect(() => {
    if (
      !viaje?.id ||
      (viaje.estado !== "en_curso" && viaje.estado !== "averiado")
    ) {
      return;
    }

    const intervalo = setInterval(async () => {
      try {
        const respuesta = await fetch(
          `/api/transporte/posicion?viajeId=${viaje.id}`,
        );
        if (respuesta.ok) {
          const datos = await respuesta.json();
          if (datos && datos.id) {
            setViaje((prev) => (prev ? { ...prev, ...datos } : datos));
          }
        }
      } catch {
        // Ante corte momentáneo de red, el motor cinemático mantiene la posición
      }
    }, 4000);

    return () => clearInterval(intervalo);
  }, [viaje?.id, viaje?.estado]);

  const incidenciaActiva = viaje?.incidencias?.[0];
  const nombreProximaParada =
    viaje?.parada_actual_nombre ?? telemetria.proximaParada?.nombre ?? null;

  return (
    <div className="relative w-full space-y-4">
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

      {/* Marco Principal del Mapa en Vivo estilo TIMOB (`map-main-card`) */}
      <div className="overflow-hidden rounded-card border border-linea bg-card shadow-card">
        {/* Cabecera TIMOB con título, insignia EN VIVO y píldoras de enfoque por Universidad / Edificio GE */}
        <div className="border-b border-linea bg-card px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="flex items-center gap-2 text-sm font-bold text-tinta">
                <Navigation className="size-4 text-marca-500" />
                {t("timob.radarTitle")}
              </span>

              <span className="inline-flex items-center gap-1.5 rounded-full border border-semaforo-verde/30 bg-semaforo-verde/10 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-semaforo-verde">
                <span className="size-2 animate-pulse rounded-full bg-semaforo-verde" />
                {t("timob.liveBadge")}
              </span>

              <Badge variant="marca" className="gap-1 text-[11px]">
                <Radio className="size-3" />
                {tieneGpsChoferEnVivo
                  ? t("timob.gpsLiveTag")
                  : t("timob.kinematicTag")}
              </Badge>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant={seguirGuagua ? "default" : "outline"}
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => {
                  const nuevo = !seguirGuagua;
                  setSeguirGuagua(nuevo);
                  if (nuevo && mapaRef.current) {
                    mapaRef.current.flyTo(
                      [telemetria.lat, telemetria.lng],
                      16,
                      { duration: 0.8 },
                    );
                  }
                }}
              >
                <Bus className="size-3.5" />
                {seguirGuagua ? t("timob.followingBus") : t("timob.followBus")}
              </Button>

              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8"
                onClick={alternarTamanoMapa}
                title={ampliado ? t("timob.collapseMap") : t("timob.expandMap")}
                aria-label={
                  ampliado ? t("timob.collapseMap") : t("timob.expandMap")
                }
              >
                {ampliado ? (
                  <Minimize2 className="size-4" />
                ) : (
                  <Maximize2 className="size-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Fila de filtros rápidos por Edificio Global Effect y Universidades (UCATECI, UNPHU, UASD, UTESA) */}
          <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <button
              type="button"
              onClick={() => enfocarParada("all")}
              className={cn(
                "inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                filtroActivo === "all"
                  ? "border-tinta bg-tinta text-background"
                  : "border-linea bg-muted/40 text-tinta-2 hover:border-marca-500 hover:text-marca-600",
              )}
            >
              {t("timob.filterAll")}
            </button>

            {paradas.map((parada) => {
              const info = clasificarParadaInstitucional(parada);
              const activo = filtroActivo === parada.id;
              const Icono = info.esSede
                ? Building2
                : info.esUniversidad
                  ? GraduationCap
                  : MapPin;

              return (
                <button
                  key={parada.id}
                  type="button"
                  onClick={() => enfocarParada(parada.id)}
                  className={cn(
                    "inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                    activo
                      ? "border-marca-600 bg-marca-500 text-white"
                      : "border-linea bg-card text-tinta hover:border-marca-500 hover:bg-marca-50/60",
                  )}
                >
                  <Icono className="size-3.5" />
                  <span>{info.etiquetaCorta}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Lienzo del Mapa Leaflet */}
        <div className="relative">
          <div
            ref={contenedorRef}
            className={cn(
              "mapa-la-vega w-full transition-all duration-300",
              ampliado
                ? "h-[min(680px,78svh)] min-h-[480px]"
                : "h-[min(480px,62svh)] min-h-[340px]",
            )}
          />

          {/* Tarjeta flotante de telemetría en vivo (esquina superior izquierda) */}
          <div className="pointer-events-none absolute top-3 left-3 z-[400] max-w-xs">
            <Card className="pointer-events-auto border-linea/70 bg-card/95 p-3 shadow-elevada backdrop-blur-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs font-bold text-tinta">
                  <Bus className="size-3.5 text-marca-500" />
                  {viaje?.horario_nombre ?? t("timob.unitCode")}
                </span>
                <Badge
                  variant={
                    viaje?.estado === "averiado" ? "destructive" : "marca"
                  }
                >
                  {viaje?.estado === "averiado"
                    ? t("status.averiado")
                    : t("status.en_curso")}
                </Badge>
              </div>

              <div className="mt-2 space-y-1 text-xs text-tinta-2">
                <p className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1">
                    <Clock className="size-3 shrink-0" />
                    {t("departure")}: {viaje?.hora_salida ?? "06:00"}
                  </span>
                  <span className="font-semibold text-marca-700">
                    {Math.round(telemetria.velocidadKmh)} km/h
                  </span>
                </p>

                {nombreProximaParada && (
                  <p className="flex items-center gap-1 text-tinta">
                    <MapPin className="size-3 shrink-0 text-marca-600" />
                    <span className="truncate">
                      {t("approaching")}:{" "}
                      <strong>{nombreProximaParada}</strong> (
                      {t("timob.etaMinutes", {
                        minutes: telemetria.etaProximaMinutos,
                      })}
                      )
                    </span>
                  </p>
                )}
              </div>
            </Card>
          </div>

          {/* Botón flotante de Mi Ubicación GPS ciudadana estilo TIMOB (`map-locate-floating-btn`) */}
          <button
            type="button"
            onClick={localizarMiUbicacion}
            className={cn(
              " absolute bottom-3.5 left-3 z-[400] inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold shadow-elevada backdrop-blur-sm transition-colors",
              estadoGpsUsuario === "activo"
                ? "border-semaforo-verde bg-card text-semaforo-verde"
                : "border-linea bg-card/95 text-marca-700 hover:border-marca-500 hover:bg-marca-50",
            )}
          >
            <LocateFixed className="size-3.5" />
            <span>
              {estadoGpsUsuario === "buscando"
                ? t("timob.locating")
                : estadoGpsUsuario === "activo"
                  ? t("timob.located")
                  : t("timob.locateMe")}
            </span>
          </button>
        </div>

        {/* Barra inferior de marco estilo TIMOB (`map-frame-footer`) */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-linea bg-muted/30 px-4 py-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-marca-500/30 bg-marca-50 px-2.5 py-0.5 font-semibold text-marca-700">
              {ampliado ? t("timob.expandedView") : t("timob.compactView")}
            </span>
            <span className="text-tinta-2">
              {t("timob.corridorMeta", {
                km: (telemetria.longitudTotalMetros / 1000).toFixed(1),
                count: paradas.length,
              })}
            </span>
          </div>

          <button
            type="button"
            onClick={alternarTamanoMapa}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-control border border-linea bg-card px-2.5 py-1 font-semibold text-marca-700 transition-colors hover:border-marca-500 hover:bg-marca-50"
          >
            {ampliado ? (
              <>
                <Minimize2 className="size-3.5" />
                {t("timob.collapseMap")}
              </>
            ) : (
              <>
                <Maximize2 className="size-3.5" />
                {t("timob.expandMap")}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Relojes de Parada e Información del Circuito Universitario en Vivo (estilo TIMOB Andenes / ETAs) */}
      <div className="rounded-card border border-linea bg-card p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="texto-titulo-tarjeta flex items-center gap-2">
              <Bus className="size-4 text-marca-500" />
              {t("routeStopsTitle")}
            </h3>
            <p className="mt-1 text-xs text-tinta-2">
              {t("routeStopsSubtitle")}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {paradas.map((p) => {
            const info = clasificarParadaInstitucional(p);
            const eta = telemetria.etasPorParada[p.id];
            const esProxima = telemetria.proximaParada?.id === p.id;
            const seleccionada = filtroActivo === p.id;
            const Icono = info.esSede
              ? Building2
              : info.esUniversidad
                ? GraduationCap
                : MapPin;

            return (
              <button
                key={p.id}
                type="button"
                onClick={() => enfocarParada(p.id)}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-control border p-3.5 text-left text-sm transition-all",
                  seleccionada || esProxima
                    ? "border-marca-500 bg-marca-50/40 shadow-card"
                    : "border-linea bg-muted/30 hover:border-marca-500/60 hover:bg-card",
                )}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    info.esSede
                      ? "bg-tinta text-background"
                      : "bg-marca-500 text-white",
                  )}
                >
                  {p.orden}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-marca-50 px-2 py-0.5 text-[10px] font-bold text-marca-700">
                      <Icono className="size-3" />
                      {info.sigla}
                    </span>

                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold",
                        eta?.enParada
                          ? "bg-semaforo-verde/15 text-semaforo-verde"
                          : "bg-marca-500/15 text-marca-700",
                      )}
                    >
                      <Clock className="size-3" />
                      {eta?.enParada
                        ? t("timob.atStopNow")
                        : t("timob.etaMinutes", {
                            minutes: eta?.minutos ?? p.minutos_estimados,
                          })}
                    </span>
                  </div>

                  <p className="mt-1.5 font-semibold text-tinta">{p.nombre}</p>
                  {p.referencia && (
                    <p className="texto-meta mt-0.5 line-clamp-2">
                      {p.referencia}
                    </p>
                  )}

                  <div className="mt-2 flex items-center justify-between text-[11px] text-tinta-3">
                    <span>
                      {t("timob.distanceAway", {
                        meters: eta?.distanciaMetros ?? 0,
                      })}
                    </span>
                    <span className="font-semibold text-marca-600">
                      {t("timob.focusOnMap")} →
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
