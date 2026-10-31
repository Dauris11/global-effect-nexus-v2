"use client";

import "leaflet/dist/leaflet.css";
import "./mapa.css";

import * as L from "leaflet";
import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  LocateFixed,
  Loader2,
  Maximize,
  Minus,
  Navigation,
  Plus,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import {
  BOUNDS_LEAFLET_LA_VEGA,
  CENTRO_LA_VEGA,
  enlaceComoLlegar,
  estaEnLaVega,
  municipioMasCercano,
  MUNICIPIOS_LA_VEGA,
} from "@/lib/la-vega-geografia";
import { cn } from "@/lib/utils";

import { LeyendaMapa } from "./leyenda-mapa";
import {
  ATRIBUCION,
  htmlPopupGrupo,
  iconoLiceo,
  iconoMiUbicacion,
  iconoPunto,
  TESELAS,
  type TextosPopup,
} from "./marcadores";

export interface LiceoMapaItem {
  id: string;
  nombre: string;
  codigo?: string | null;
  municipio?: string | null;
  sector?: string | null;
  direccion?: string | null;
  latitud: number;
  longitud: number;
  /** Sin coordenadas propias: se pinta en el centro de su municipio. */
  aproximado?: boolean;
  ultimaVisita?: string | null;
  profesores?: Array<{ nombre: string; tanda: string }>;
  estudiantesCount?: number;
}

export interface PropsMapaLaVega {
  /** 'seleccion' fija un punto; 'liceos' muestra la red; 'vista_vivienda' solo enseña el punto. */
  modo?: "seleccion" | "liceos" | "vista_vivienda";
  lat?: number | null;
  lng?: number | null;
  alCambiarCoordenadas?: (
    lat: number,
    lng: number,
    meta?: { municipio?: string; sector?: string },
  ) => void;
  liceos?: LiceoMapaItem[];
  alSeleccionarLiceo?: (liceoId: string) => void;
  /** Liceo resaltado y centrado (p. ej. el elegido en un formulario). */
  liceoActivoId?: string | null;
  /** Altura máxima en escritorio; en móvil se recorta a un 65 % de la pantalla. */
  altura?: string;
  etiqueta?: string;
  soloLectura?: boolean;
  /** Oculta filtros y selector de municipio: para mapas pequeños de consulta. */
  compacto?: boolean;
}

type Filtro = "todos" | "conFacilitador" | "sinFacilitador" | "aproximados";
const FILTROS: Filtro[] = ["todos", "conFacilitador", "sinFacilitador", "aproximados"];

function pasaFiltro(l: LiceoMapaItem, filtro: Filtro) {
  const conProfes = (l.profesores?.length ?? 0) > 0;
  if (filtro === "conFacilitador") return conProfes;
  if (filtro === "sinFacilitador") return !conProfes;
  if (filtro === "aproximados") return Boolean(l.aproximado);
  return true;
}

const esOscuro = () => document.documentElement.classList.contains("dark");

const BOTON_MAPA =
  "flex size-11 items-center justify-center rounded-control border border-linea bg-card text-tinta shadow-card transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-500 disabled:opacity-60";

export function MapaLaVegaCliente({
  modo = "seleccion",
  lat,
  lng,
  alCambiarCoordenadas,
  liceos = [],
  alSeleccionarLiceo,
  liceoActivoId = null,
  altura = "420px",
  etiqueta,
  soloLectura = false,
  compacto = false,
}: PropsMapaLaVega) {
  const t = useTranslations("common.mapa");
  const locale = useLocale();
  const editable = modo === "seleccion" && !soloLectura;

  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<L.Map | null>(null);
  const capaLiceosRef = useRef<L.LayerGroup | null>(null);
  const marcadorPuntoRef = useRef<L.Marker | null>(null);
  const marcadorYoRef = useRef<L.Marker | null>(null);
  const puntosVisiblesRef = useRef<L.LatLngExpression[]>([]);

  const [puntoLocal, setPuntoLocal] = useState<{ lat: number; lng: number } | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [municipio, setMunicipio] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [localizando, setLocalizando] = useState(false);
  const [interactivo, setInteractivo] = useState(false);

  const puntoProp = lat != null && lng != null && estaEnLaVega(lat, lng) ? { lat, lng } : null;
  const punto = puntoLocal ?? puntoProp;

  const textosPopup: TextosPopup = {
    aproximado: t("aproximado"),
    ultimaVisita: (fecha) => t("ultimaVisita", { fecha }),
    sinVisitas: t("sinVisitas"),
    facilitadores: (n) => t("facilitadores", { n }),
    estudiantes: (n) => t("estudiantes", { n }),
    comoLlegar: t("comoLlegar"),
    formatearFecha: (iso) =>
      new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(
        new Date(`${iso}T00:00:00Z`),
      ),
  };

  // Leaflet vive fuera de React: sus manejadores leen siempre la versión
  // actual de props y textos a través de refs, sin reconstruir el mapa.
  const vivo = useRef({ alCambiarCoordenadas, alSeleccionarLiceo, textosPopup, punto, t });
  useEffect(() => {
    vivo.current = { alCambiarCoordenadas, alSeleccionarLiceo, textosPopup, punto, t };
  });

  /** Coloca (o mueve) la chincheta y avisa al formulario. Rechaza lo que caiga fuera de La Vega. */
  const fijarPunto = (latitud: number, longitud: number) => {
    const map = mapaRef.current;
    if (!map) return;
    if (!estaEnLaVega(latitud, longitud)) {
      setAviso(vivo.current.t("fueraDeLaVega"));
      const anterior = vivo.current.punto;
      if (anterior) marcadorPuntoRef.current?.setLatLng([anterior.lat, anterior.lng]);
      return;
    }
    setAviso(null);
    if (marcadorPuntoRef.current) {
      marcadorPuntoRef.current.setLatLng([latitud, longitud]);
    } else {
      marcadorPuntoRef.current = crearChincheta(map, latitud, longitud, true);
    }
    setPuntoLocal({ lat: latitud, lng: longitud });
    vivo.current.alCambiarCoordenadas?.(latitud, longitud, {
      municipio: municipioMasCercano(latitud, longitud).nombre,
    });
  };
  const fijarPuntoRef = useRef(fijarPunto);
  useEffect(() => {
    fijarPuntoRef.current = fijarPunto;
  });

  function crearChincheta(map: L.Map, latitud: number, longitud: number, arrastrable: boolean) {
    const m = L.marker([latitud, longitud], {
      icon: iconoPunto(),
      draggable: arrastrable,
      keyboard: true,
      title: vivo.current.t("puntoElegido"),
      alt: vivo.current.t("puntoElegido"),
    }).addTo(map);
    if (arrastrable) {
      m.on("dragend", () => {
        const pos = m.getLatLng();
        fijarPuntoRef.current(pos.lat, pos.lng);
      });
    }
    return m;
  }

  /** Encuadra todo lo visible; sin puntos, la provincia entera. */
  const encuadrar = () => {
    const map = mapaRef.current;
    if (!map) return;
    const puntos = [...puntosVisiblesRef.current];
    const p = vivo.current.punto;
    if (p) puntos.push([p.lat, p.lng]);
    if (puntos.length === 0) {
      map.fitBounds(BOUNDS_LEAFLET_LA_VEGA, { padding: [8, 8] });
    } else if (puntos.length === 1) {
      map.setView(puntos[0], 15);
    } else {
      map.fitBounds(L.latLngBounds(puntos), { padding: [48, 48], maxZoom: 15 });
    }
  };

  // Montaje del mapa. Este módulo solo se carga en el navegador (ver
  // mapa-la-vega.tsx), así que Leaflet puede importarse arriba sin `window`.
  useEffect(() => {
    const el = contenedorRef.current;
    if (!el || mapaRef.current) return;
    const inicial = vivo.current.punto;

    const map = L.map(el, {
      center: inicial ? [inicial.lat, inicial.lng] : [CENTRO_LA_VEGA.lat, CENTRO_LA_VEGA.lng],
      zoom: inicial ? 15 : 10,
      minZoom: 9,
      maxZoom: 19,
      zoomControl: false,
      // Que la rueda y el arrastre con un dedo no secuestren el scroll de la
      // página: se activan al pulsar el mapa.
      scrollWheelZoom: false,
      dragging: !L.Browser.mobile,
      maxBounds: L.latLngBounds(BOUNDS_LEAFLET_LA_VEGA).pad(0.15),
      maxBoundsViscosity: 0.8,
    });
    el.classList.add("mapa-la-vega");

    const teselas = L.tileLayer(esOscuro() ? TESELAS.oscuro : TESELAS.claro, {
      attribution: ATRIBUCION,
      subdomains: "abcd",
      maxZoom: 20,
    }).addTo(map);

    capaLiceosRef.current = L.layerGroup().addTo(map);
    if (inicial) {
      marcadorPuntoRef.current = crearChincheta(map, inicial.lat, inicial.lng, editable);
    }

    map.on("click", (e: L.LeafletMouseEvent) => {
      map.scrollWheelZoom.enable();
      map.dragging.enable();
      setInteractivo(true);
      if (editable) fijarPuntoRef.current(e.latlng.lat, e.latlng.lng);
    });
    map.on("mouseout", () => {
      map.scrollWheelZoom.disable();
      setInteractivo(false);
    });

    // El tema se cambia con la clase `.dark` en <html>; las teselas no la ven.
    const observador = new MutationObserver(() => {
      teselas.setUrl(esOscuro() ? TESELAS.oscuro : TESELAS.claro);
    });
    observador.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    mapaRef.current = map;
    if (!inicial) map.fitBounds(BOUNDS_LEAFLET_LA_VEGA, { padding: [8, 8] });

    return () => {
      observador.disconnect();
      map.remove();
      mapaRef.current = null;
      marcadorPuntoRef.current = null;
      marcadorYoRef.current = null;
      capaLiceosRef.current = null;
    };
    // El mapa solo se rehace si cambia el modo; lo demás llega por refs.
  }, [editable]);

  // Si el formulario trae otra coordenada (p. ej. al cargar el expediente), mover la chincheta.
  useEffect(() => {
    const map = mapaRef.current;
    if (!map || puntoLocal || lat == null || lng == null || !estaEnLaVega(lat, lng)) return;
    if (marcadorPuntoRef.current) marcadorPuntoRef.current.setLatLng([lat, lng]);
    else marcadorPuntoRef.current = crearChincheta(map, lat, lng, editable);
  }, [lat, lng, puntoLocal, editable]);

  // Marcadores de liceos, agrupados cuando comparten punto (los aproximados
  // de un mismo municipio caen todos en su centro).
  useEffect(() => {
    const map = mapaRef.current;
    const capa = capaLiceosRef.current;
    if (!map || !capa) return;
    capa.clearLayers();
    puntosVisiblesRef.current = [];
    if (modo !== "liceos") return;

    const grupos = new Map<string, LiceoMapaItem[]>();
    for (const l of liceos) {
      if (!estaEnLaVega(l.latitud, l.longitud) || !pasaFiltro(l, filtro)) continue;
      const clave = `${l.latitud.toFixed(5)},${l.longitud.toFixed(5)}`;
      grupos.set(clave, [...(grupos.get(clave) ?? []), l]);
    }

    let activo: L.Marker | null = null;
    for (const grupo of grupos.values()) {
      const [primero] = grupo;
      const esActivo = grupo.some((g) => g.id === liceoActivoId);
      const nombres = grupo.map((g) => g.nombre).join(", ");
      const m = L.marker([primero.latitud, primero.longitud], {
        icon: iconoLiceo({
          aproximado: grupo.every((g) => g.aproximado),
          cantidad: grupo.length,
          activo: esActivo,
        }),
        title: nombres,
        alt: nombres,
        keyboard: true,
        riseOnHover: true,
        zIndexOffset: esActivo ? 1000 : 0,
      }).addTo(capa);
      m.bindPopup(htmlPopupGrupo(grupo, vivo.current.textosPopup), {
        maxWidth: 300,
        autoPanPadding: [16, 16],
      });
      m.on("click", () => vivo.current.alSeleccionarLiceo?.(primero.id));
      puntosVisiblesRef.current.push([primero.latitud, primero.longitud]);
      if (esActivo) activo = m;
    }

    if (activo) {
      map.setView((activo as L.Marker).getLatLng(), Math.max(map.getZoom(), 14));
    } else {
      encuadrar();
    }
  }, [modo, liceos, filtro, liceoActivoId]);

  const irAMunicipio = (nombre: string) => {
    setMunicipio(nombre);
    const mun = MUNICIPIOS_LA_VEGA.find((m) => m.nombre === nombre);
    if (mun) mapaRef.current?.flyTo(mun.centro, 13, { duration: 0.8 });
    else encuadrar();
  };

  const localizarme = () => {
    if (!("geolocation" in navigator)) {
      setAviso(t("sinGeolocalizacion"));
      return;
    }
    setLocalizando(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocalizando(false);
        const map = mapaRef.current;
        if (!map) return;
        if (!estaEnLaVega(coords.latitude, coords.longitude)) {
          setAviso(t("tuUbicacionFuera"));
          return;
        }
        setAviso(null);
        const yo: L.LatLngExpression = [coords.latitude, coords.longitude];
        if (marcadorYoRef.current) marcadorYoRef.current.setLatLng(yo);
        else
          marcadorYoRef.current = L.marker(yo, {
            icon: iconoMiUbicacion(),
            title: t("tuUbicacion"),
            alt: t("tuUbicacion"),
            interactive: false,
          }).addTo(map);
        map.flyTo(yo, 16, { duration: 0.8 });
        if (editable) fijarPunto(coords.latitude, coords.longitude);
      },
      (error) => {
        setLocalizando(false);
        setAviso(error.code === error.PERMISSION_DENIED ? t("permisoDenegado") : t("ubicacionNoDisponible"));
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  };

  const conteo = (f: Filtro) => liceos.filter((l) => pasaFiltro(l, f)).length;
  const hayAproximados = liceos.some((l) => l.aproximado);

  return (
    <section aria-label={t("region")} className="space-y-3">
      {!compacto && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="mapa-municipio">
            {t("municipio")}
          </label>
          <select
            id="mapa-municipio"
            value={municipio}
            onChange={(e) => irAMunicipio(e.target.value)}
            className="h-11 rounded-control border border-linea-fuerte bg-background px-3 text-sm text-tinta outline-none focus-visible:ring-2 focus-visible:ring-marca-500"
          >
            <option value="">{t("todaLaProvincia")}</option>
            {MUNICIPIOS_LA_VEGA.map((m) => (
              <option key={m.nombre} value={m.nombre}>
                {m.nombre}
              </option>
            ))}
          </select>

          {modo === "liceos" &&
            FILTROS.filter((f) => f !== "aproximados" || hayAproximados).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filtro === f}
                onClick={() => setFiltro(f)}
                className={cn(
                  "inline-flex h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-500",
                  filtro === f
                    ? "border-marca-500 bg-marca-50 text-marca-700"
                    : "border-linea-fuerte text-tinta-2 hover:border-tinta hover:text-tinta",
                )}
              >
                {t(`filtro.${f}`)}
                <span className="text-xs text-tinta-3">{conteo(f)}</span>
              </button>
            ))}
        </div>
      )}

      {aviso && (
        <div role="alert" className="flex items-start gap-2 rounded-control bg-tinta p-3 text-sm text-background">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{aviso}</span>
        </div>
      )}

      <div className="relative">
        <div
          ref={contenedorRef}
          style={{ height: `min(${altura}, 65svh)` }}
          className="relative z-0 min-h-64 w-full overflow-hidden rounded-card border border-linea"
        />

        <div className="absolute top-3 right-3 z-[500] flex flex-col gap-2">
          <button type="button" aria-label={t("acercar")} title={t("acercar")} className={BOTON_MAPA} onClick={() => mapaRef.current?.zoomIn()}>
            <Plus className="size-5" />
          </button>
          <button type="button" aria-label={t("alejar")} title={t("alejar")} className={BOTON_MAPA} onClick={() => mapaRef.current?.zoomOut()}>
            <Minus className="size-5" />
          </button>
          <button type="button" aria-label={t("verTodo")} title={t("verTodo")} className={BOTON_MAPA} onClick={encuadrar}>
            <Maximize className="size-5" />
          </button>
          <button
            type="button"
            aria-label={editable ? t("usarMiUbicacion") : t("miUbicacion")}
            title={editable ? t("usarMiUbicacion") : t("miUbicacion")}
            className={BOTON_MAPA}
            onClick={localizarme}
            disabled={localizando}
          >
            {localizando ? <Loader2 className="size-5 animate-spin" /> : <LocateFixed className="size-5 text-marca-600" />}
          </button>
        </div>

        {!interactivo && (
          <p className="pointer-events-none absolute top-3 left-3 z-[500] max-w-[calc(100%-5rem)] rounded-full bg-tinta/80 px-3 py-1.5 text-xs text-background">
            {L.Browser.mobile ? t("tocaParaMover") : t("clicParaZoom")}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <LeyendaMapa modo={modo} hayAproximados={hayAproximados} />
        {etiqueta && <span className="texto-meta">{etiqueta}</span>}
      </div>

      {modo !== "liceos" && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {punto ? (
            <>
              <CheckCircle2 className="size-4 text-marca-600" />
              <span className="font-mono text-xs text-tinta-2">
                {punto.lat.toFixed(6)}, {punto.lng.toFixed(6)}
              </span>
              <span className="text-tinta-3">
                {t("cercaDe", { municipio: municipioMasCercano(punto.lat, punto.lng).nombre })}
              </span>
              <a
                href={enlaceComoLlegar(punto.lat, punto.lng)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-1.5 font-medium text-marca-600 hover:underline dark:text-marca-300"
              >
                <Navigation className="size-4" />
                {t("comoLlegar")}
              </a>
            </>
          ) : (
            <span className="text-tinta-3">{editable ? t("ayudaSeleccion") : t("sinUbicacion")}</span>
          )}
        </div>
      )}
    </section>
  );
}
