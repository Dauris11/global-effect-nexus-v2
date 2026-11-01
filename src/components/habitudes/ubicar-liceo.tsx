"use client";

import { useState, useTransition } from "react";
import { AlertCircle, CheckCircle2, MapPinned, Save } from "lucide-react";
import { useTranslations } from "next-intl";

import { MapaLaVega } from "@/components/mapa/mapa-la-vega";
import { Button } from "@/components/ui/button";
import type { HabitudesLiceo } from "@/lib/habitudes";
import { buscarMunicipio } from "@/lib/la-vega-geografia";
import { guardarUbicacionLiceoAction } from "@/server/habitudes/acciones";

/**
 * Fija las coordenadas de un liceo. Existía la acción en el servidor pero
 * ninguna pantalla la llamaba, así que todos los liceos salían sin punto y el
 * mapa de la red quedaba vacío. Empieza por los que aún no tienen ubicación.
 */
export function UbicarLiceo({ liceos }: { liceos: HabitudesLiceo[] }) {
  const t = useTranslations("common.mapa.ubicarLiceo");
  const ordenados = [...liceos].sort(
    (a, b) => Number(a.latitud != null) - Number(b.latitud != null) || a.nombre.localeCompare(b.nombre),
  );
  const [liceoId, setLiceoId] = useState(ordenados[0]?.id ?? "");
  const [punto, setPunto] = useState<{ lat: number; lng: number; municipio?: string } | null>(null);
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendiente, startTransition] = useTransition();

  const liceo = liceos.find((l) => l.id === liceoId);
  if (!liceo) return null;

  const guardar = () => {
    if (!punto) return;
    setResultado(null);
    startTransition(async () => {
      const res = await guardarUbicacionLiceoAction({
        liceoId: liceo.id,
        latitud: punto.lat,
        longitud: punto.lng,
        // El municipio deducido del punto manda sobre el guardado: el valor
        // por defecto de la columna es "Concepción de La Vega" para todos.
        municipio: punto.municipio ?? buscarMunicipio(liceo.municipio)?.nombre ?? "Concepción de La Vega",
        distritoMunicipal: liceo.distrito_municipal ?? undefined,
        sector: liceo.sector ?? undefined,
        calle: liceo.calle ?? undefined,
      });
      setResultado({ ok: res.ok, texto: res.ok ? t("guardado") : (res.mensaje ?? t("error")) });
      if (res.ok) setPunto(null);
    });
  };

  return (
    <div className="space-y-4 rounded-card border border-linea bg-card p-4 shadow-card sm:p-6">
      <div>
        <h3 className="texto-titulo-tarjeta flex items-center gap-2">
          <MapPinned className="size-5 text-marca-600" />
          {t("titulo")}
        </h3>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="ubicar-liceo" className="text-sm font-medium text-tinta">
          {t("liceo")}
        </label>
        <select
          id="ubicar-liceo"
          value={liceoId}
          onChange={(e) => {
            setLiceoId(e.target.value);
            setPunto(null);
            setResultado(null);
          }}
          className="h-11 w-full rounded-control border border-linea-fuerte bg-background px-3 text-sm text-tinta outline-none focus-visible:ring-2 focus-visible:ring-marca-500"
        >
          {ordenados.map((l) => (
            <option key={l.id} value={l.id}>
              {l.latitud != null ? l.nombre : t("sinUbicacionOpcion", { nombre: l.nombre })}
            </option>
          ))}
        </select>
      </div>

      {/* `key` rehace el mapa al cambiar de liceo: cada uno trae su propio punto inicial. */}
      <MapaLaVega
        key={liceo.id}
        modo="seleccion"
        lat={liceo.latitud}
        lng={liceo.longitud}
        altura="360px"
        alCambiarCoordenadas={(lat, lng, meta) => setPunto({ lat, lng, municipio: meta?.municipio })}
      />

      {resultado && (
        <p
          role={resultado.ok ? "status" : "alert"}
          className={
            resultado.ok
              ? "flex items-center gap-2 rounded-control bg-marca-50 p-3 text-sm text-marca-700"
              : "flex items-center gap-2 rounded-control bg-tinta p-3 text-sm text-background"
          }
        >
          {resultado.ok ? <CheckCircle2 className="size-4 shrink-0" /> : <AlertCircle className="size-4 shrink-0" />}
          {resultado.texto}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="button" onClick={guardar} disabled={!punto || pendiente} cargando={pendiente}>
          <Save />
          {t("guardar")}
        </Button>
      </div>
    </div>
  );
}
