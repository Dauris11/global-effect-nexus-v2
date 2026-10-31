"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, LocateFixed, Map as IconoMapa, MapPinOff, Navigation } from "lucide-react";
import { useTranslations } from "next-intl";

import { MapaLaVega } from "@/components/mapa/mapa-la-vega";
import { Button } from "@/components/ui/button";
import type { HabitudesLiceo } from "@/lib/habitudes";
import { distanciaMetros, enlaceComoLlegar } from "@/lib/la-vega-geografia";

/** Hasta aquí se da por hecho que el facilitador está en el plantel (patio y parqueo incluidos). */
const RADIO_EN_LICEO_M = 200;

type Comprobacion =
  | { tipo: "dentro" | "lejos"; metros: number }
  | { tipo: "error"; texto: string };

/**
 * Ubicación del liceo en el registro de visita: cómo llegar y comprobar que
 * se está allí. La visita no guarda coordenadas —`habitudes_visita_evidencia`
 * no tiene columnas para ello—, así que la comprobación es solo orientativa.
 */
export function UbicacionVisita({ liceo }: { liceo: HabitudesLiceo }) {
  const t = useTranslations("common.mapa.visita");
  const [verMapa, setVerMapa] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [comprobacion, setComprobacion] = useState<Comprobacion | null>(null);

  const lat = liceo.latitud;
  const lng = liceo.longitud;

  if (lat == null || lng == null) {
    return (
      <p className="flex items-start gap-2 rounded-control bg-muted p-3 text-sm text-tinta-2">
        <MapPinOff className="mt-0.5 size-4 shrink-0" />
        {t("sinCoordenadas")}
      </p>
    );
  }

  const comprobar = () => {
    if (!("geolocation" in navigator)) {
      setComprobacion({ tipo: "error", texto: t("sinGeolocalizacion") });
      return;
    }
    setBuscando(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setBuscando(false);
        const metros = Math.round(
          distanciaMetros({ lat: coords.latitude, lng: coords.longitude }, { lat, lng }),
        );
        setComprobacion({ tipo: metros <= RADIO_EN_LICEO_M ? "dentro" : "lejos", metros });
      },
      (error) => {
        setBuscando(false);
        setComprobacion({
          tipo: "error",
          texto: error.code === error.PERMISSION_DENIED ? t("permisoDenegado") : t("noDisponible"),
        });
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  };

  const distancia = (m: number) => (m >= 1000 ? t("km", { km: (m / 1000).toFixed(1) }) : t("m", { m }));

  return (
    <div className="space-y-3 rounded-control border border-linea p-3">
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="secondary" size="sm" className="min-h-11">
          <a href={enlaceComoLlegar(lat, lng)} target="_blank" rel="noopener noreferrer">
            <Navigation />
            {t("comoLlegar")}
          </a>
        </Button>
        <Button type="button" variant="secondary" size="sm" className="min-h-11" onClick={comprobar} cargando={buscando}>
          <LocateFixed />
          {t("comprobar")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-11"
          aria-expanded={verMapa}
          onClick={() => setVerMapa((v) => !v)}
        >
          <IconoMapa />
          {verMapa ? t("ocultarMapa") : t("verMapa")}
        </Button>
      </div>

      {comprobacion && (
        <p
          role="status"
          className={
            comprobacion.tipo === "error"
              ? "flex items-center gap-2 rounded-control bg-tinta p-2.5 text-sm text-background"
              : "flex items-center gap-2 rounded-control bg-marca-50 p-2.5 text-sm text-marca-700"
          }
        >
          {comprobacion.tipo === "dentro" ? (
            <CheckCircle2 className="size-4 shrink-0" />
          ) : (
            <AlertCircle className="size-4 shrink-0" />
          )}
          {comprobacion.tipo === "error"
            ? comprobacion.texto
            : comprobacion.tipo === "dentro"
              ? t("dentro", { distancia: distancia(comprobacion.metros) })
              : t("lejos", { distancia: distancia(comprobacion.metros) })}
        </p>
      )}

      {verMapa && (
        <MapaLaVega
          modo="liceos"
          compacto
          altura="280px"
          liceoActivoId={liceo.id}
          liceos={[
            {
              id: liceo.id,
              nombre: liceo.nombre,
              codigo: liceo.codigo,
              direccion: liceo.direccion,
              municipio: liceo.municipio,
              sector: liceo.sector,
              latitud: lat,
              longitud: lng,
              ultimaVisita: liceo.ultimaVisita,
              estudiantesCount: liceo.totalEstudiantes,
            },
          ]}
        />
      )}
    </div>
  );
}
