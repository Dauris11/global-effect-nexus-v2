"use client";

import { useState, useTransition } from "react";
import {
  Building2,
  Calendar,
  Camera,
  CheckCircle2,
  Clock,
  GraduationCap,
  Image as ImageIcon,
  Loader2,
  LocateFixed,
  MapPin,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AccionesFormulario,
  FormularioGuiado,
  PasoFormulario,
} from "@/components/ui/formulario-guiado";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { UbicacionVisita } from "@/components/habitudes/ubicacion-visita";
import type { HabitudesLiceo, HabitudesVisitaEvidencia } from "@/lib/habitudes";
import { distanciaMetros } from "@/lib/la-vega-geografia";
import { cn } from "@/lib/utils";
import { registrarVisitaLiceoAction } from "@/server/habitudes/acciones";

const LIMITE_FOTOS_BYTES = 11 * 1024 * 1024;

interface RegistroVisitaLiceoProps {
  liceos: HabitudesLiceo[];
  onVisitaCreada?: (nuevaVisita: HabitudesVisitaEvidencia) => void;
}

export function RegistroVisitaLiceo({
  liceos,
  onVisitaCreada,
}: RegistroVisitaLiceoProps) {
  const t = useTranslations("habitudes");

  const [liceoId, setLiceoId] = useState<string>(liceos[0]?.id ?? "");
  const [coordenadas, setCoordenadas] = useState<{ lat: number; lng: number } | null>(null);
  const [detectando, setDetectando] = useState(false);
  const [tema, setTema] = useState<string>("");
  const [tanda, setTanda] = useState<string>("matutina");
  const [estudiantes, setEstudiantes] = useState<number>(35);
  const [observaciones, setObservaciones] = useState<string>("");
  const [fotosLocales, setFotosLocales] = useState<string[]>([]);
  const [archivosFotos, setArchivosFotos] = useState<File[]>([]);
  const [errorValidacion, setErrorValidacion] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const liceoSeleccionado = liceos.find((l) => l.id === liceoId);

  const detectarLiceoCercano = () => {
    if (!("geolocation" in navigator)) return;
    setDetectando(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setDetectando(false);
        const pos = { lat: coords.latitude, lng: coords.longitude };
        setCoordenadas(pos);

        let mejorLiceo: HabitudesLiceo | null = null;
        let menorDistancia = Infinity;

        for (const lic of liceos) {
          if (lic.latitud != null && lic.longitud != null) {
            const d = distanciaMetros(pos, { lat: lic.latitud, lng: lic.longitud });
            if (d < menorDistancia) {
              menorDistancia = d;
              mejorLiceo = lic;
            }
          }
        }

        if (mejorLiceo) {
          setLiceoId(mejorLiceo.id);
        }
      },
      () => {
        setDetectando(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  };

  const presetsTemas = [
    t("presetTopicThermostat"),
    t("presetTopicMirrorWindow"),
    t("presetTopicIceberg"),
    t("presetTopicCompass"),
    t("presetTopicBridges"),
  ];

  const agregarFotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivos = e.target.files;
    if (!archivos || archivos.length === 0) return;

    const nuevos = Array.from(archivos);
    // URL de objeto para previsualización inmediata en el móvil; el archivo
    // en sí es lo que se sube.
    setFotosLocales((prev) => [...prev, ...nuevos.map((a) => URL.createObjectURL(a))]);
    setArchivosFotos((prev) => [...prev, ...nuevos]);
    e.target.value = "";
  };

  const eliminarFoto = (indice: number) => {
    setFotosLocales((prev) => prev.filter((_, idx) => idx !== indice));
    setArchivosFotos((prev) => prev.filter((_, idx) => idx !== indice));
  };

  const manejarEnvio = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorValidacion(null);
    setMensajeExito(null);

    if (!liceoId) {
      setErrorValidacion(t("errHighSchoolRequired"));
      return;
    }
    if (!tema.trim()) {
      setErrorValidacion(t("errTopicRequired"));
      return;
    }
    if (estudiantes <= 0) {
      setErrorValidacion(t("errStudentsCountRequired"));
      return;
    }

    const formData = new FormData(e.currentTarget);
    formData.set("liceo_id", liceoId);
    formData.set("tema_impartido", tema.trim());
    formData.set("tanda", tanda);
    formData.set("estudiantes_impactados", String(estudiantes));
    formData.set("observaciones", observaciones.trim());
    if (coordenadas) {
      formData.set("latitud", String(coordenadas.lat));
      formData.set("longitud", String(coordenadas.lng));
    }
    // La acción de servidor admite 12 MB por envío: pasado eso falla antes
    // de llegar a la validación, sin decir por qué.
    const totalFotos = archivosFotos.reduce((suma, f) => suma + f.size, 0);
    if (totalFotos > LIMITE_FOTOS_BYTES) {
      setErrorValidacion(t("errPhotosTooLarge"));
      return;
    }
    formData.delete("fotos");
    for (const foto of archivosFotos) formData.append("fotos", foto);

    startTransition(async () => {
      const res = await registrarVisitaLiceoAction(formData);
      if (res.ok) {
        setMensajeExito(res.mensaje ?? t("visitLoggedSuccess"));
        const liceoSel = liceos.find((l) => l.id === liceoId);
        if (onVisitaCreada && liceoSel) {
          onVisitaCreada({
            id: res.id ?? `visita-${Date.now()}`,
            liceo_id: liceoId,
            liceo_nombre: liceoSel.nombre,
            liceo_codigo: liceoSel.codigo,
            distrito_educativo: liceoSel.distrito_educativo,
            facilitador_id: "me",
            facilitador_nombre: "Tú",
            fecha_visita: new Date().toISOString().slice(0, 10),
            tema_impartido: tema,
            tanda: tanda as any,
            estudiantes_impactados: estudiantes,
            observaciones: observaciones || null,
            fotos_urls: fotosLocales,
            estado: "completada",
            creado_en: new Date().toISOString(),
            latitud: coordenadas?.lat ?? (liceoSel.latitud ? Number(liceoSel.latitud) : null),
            longitud: coordenadas?.lng ?? (liceoSel.longitud ? Number(liceoSel.longitud) : null),
          });
        }
        // Limpiar formulario tras éxito
        setTimeout(() => {
          setTema("");
          setObservaciones("");
          setFotosLocales([]);
          setArchivosFotos([]);
          setCoordenadas(null);
          setMensajeExito(null);
        }, 1500);
      } else {
        setErrorValidacion(res.mensaje ?? t("visitLogError"));
      }
    });
  };

  return (
    <Card className="border-linea-fuerte bg-card shadow-xs">
      <CardHeader className="border-b border-linea pb-4">
        <CardTitle className="flex items-center gap-2 text-base font-bold text-tinta">
          <Camera className="size-5 text-marca-600" />
          <span>{t("registerVisitTitle")}</span>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-4 sm:p-6">
        <form onSubmit={manejarEnvio} className="space-y-5">
          <FormularioGuiado>
          <PasoFormulario titulo={t("pasosVisita.lugar")}>
          {/* 1. Centro Educativo */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="liceo_id" className="text-xs font-semibold">
                {t("highSchoolLabel")}
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={detectarLiceoCercano}
                disabled={detectando}
                className="h-7 gap-1 px-2 text-xs text-marca-700 hover:text-marca-800"
              >
                {detectando ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <LocateFixed className="size-3.5" />
                )}
                <span>{detectando ? t("detectingLocation") : t("detectNearestSchool")}</span>
              </Button>
            </div>
            <div className="relative">
              <select
                id="liceo_id"
                value={liceoId}
                onChange={(e) => setLiceoId(e.target.value)}
                className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-11 w-full rounded-md border bg-card px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
              >
                {liceos.map((lic) => (
                  <option key={lic.id} value={lic.id}>
                    {lic.nombre} ({lic.distrito_educativo})
                  </option>
                ))}
              </select>
            </div>
            {liceoSeleccionado && (
              <UbicacionVisita key={liceoSeleccionado.id} liceo={liceoSeleccionado} />
            )}
          </div>

          </PasoFormulario>

          <PasoFormulario titulo={t("pasosVisita.sesion")}>
          {/* 2. Tema Impartido y Sugerencias Rápidas */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="tema" className="text-xs font-semibold">
                {t("topicLabel")}
              </Label>
              <span className="text-[11px] text-tinta/50">{t("quickSuggestions")}</span>
            </div>
            <Input
              id="tema"
              value={tema}
              onChange={(e) => setTema(e.target.value)}
              placeholder={t("topicPlaceholder")}
              className="h-11 text-sm"
              required
            />
            {/* Chips de Temas Rápidos */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {presetsTemas.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setTema(preset)}
                  className="rounded-full border border-linea-fuerte bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-tinta-2 hover:bg-muted active:scale-95"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Tanda y Conteo de Estudiantes */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t("shiftLabel")}</Label>
              <select
                value={tanda}
                onChange={(e) => setTanda(e.target.value)}
                className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-11 w-full rounded-md border bg-card px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
              >
                <option value="matutina">{t("shiftMorning")}</option>
                <option value="vespertina">{t("shiftAfternoon")}</option>
                <option value="jornada_extendida">{t("shiftExtended")}</option>
                <option value="nocturna">{t("shiftNight")}</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                {t("studentsImpactedLabel")}:{" "}
                <b className="text-marca-700 text-sm font-bold">{estudiantes}</b>
              </Label>
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min={1}
                  max={500}
                  value={estudiantes}
                  onChange={(e) => setEstudiantes(parseInt(e.target.value, 10) || 0)}
                  className="h-11 w-24 text-center font-bold"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEstudiantes((prev) => prev + 5)}
                  className="min-h-11 flex-1 font-semibold text-xs active:scale-95"
                >
                  +5
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEstudiantes((prev) => prev + 15)}
                  className="min-h-11 flex-1 font-semibold text-xs active:scale-95"
                >
                  +15
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEstudiantes((prev) => prev + 30)}
                  className="min-h-11 flex-1 font-semibold text-xs active:scale-95"
                >
                  +30
                </Button>
              </div>
            </div>
          </div>

          </PasoFormulario>

          <PasoFormulario titulo={t("pasosVisita.evidencia")}>
          {/* 4. Evidencias Fotográficas con Soporte Móvil de Cámara */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">
              {t("photoEvidenceLabel")}
            </Label>
            <div className="rounded-xl border-2 border-dashed border-linea-fuerte p-4 text-center">
              <label className="flex flex-col items-center justify-center cursor-pointer gap-2">
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  capture="environment"
                  multiple
                  onChange={agregarFotos}
                  className="sr-only"
                />
                <span className="flex size-12 items-center justify-center rounded-full bg-marca-50 text-marca-600 transition-transform hover:scale-105 active:scale-95">
                  <Camera className="size-6" />
                </span>
                <span className="text-xs font-semibold text-tinta">
                  {t("takePhotoOrUpload")}
                </span>
              </label>

              {/* Previsualización en miniaturas */}
              {fotosLocales.length > 0 && (
                <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {fotosLocales.map((url, idx) => (
                    <div
                      key={idx}
                      className="group relative aspect-square overflow-hidden rounded-lg border border-linea"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`Evidencia ${idx + 1}`}
                        className="size-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => eliminarFoto(idx)}
                        className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-tinta/80 text-white hover:bg-tinta active:scale-90"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 5. Observaciones */}
          <div className="space-y-1.5">
            <Label htmlFor="observaciones" className="text-xs font-semibold">
              {t("observationsLabel")}
            </Label>
            <Textarea
              id="observaciones"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder={t("observationsPlaceholder")}
              rows={2}
              maxLength={1200}
            />
          </div>
          </PasoFormulario>

          {errorValidacion && (
            <p className="rounded-lg bg-marca-50 p-2.5 text-xs font-medium text-tinta">
              {errorValidacion}
            </p>
          )}

          {mensajeExito && (
            <p className="rounded-lg bg-marca-50 p-2.5 text-xs font-semibold text-marca-700 flex items-center gap-1.5">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>{mensajeExito}</span>
            </p>
          )}

          {/* Botón de envío */}
          <AccionesFormulario>
          <Button
            type="submit"
            disabled={isPending}
            className="w-full min-h-12 gap-2 text-sm font-semibold active:scale-95"
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CheckCircle2 className="size-4" />
            )}
            <span>
              {isPending ? t("savingVisit") : t("submitVisitButton")}
            </span>
          </Button>
          </AccionesFormulario>
          </FormularioGuiado>
        </form>
      </CardContent>
    </Card>
  );
}
