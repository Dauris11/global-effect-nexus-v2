"use client";

import { useRef, useState, useTransition } from "react";
import { AlertCircle, Camera, Check, ImagePlus, LocateFixed, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { useToast } from "@/components/app/toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import type { HabitudesLiceo } from "@/lib/habitudes";
import { distanciaMetros } from "@/lib/la-vega-geografia";
import { cn } from "@/lib/utils";
import { registrarVisitaLiceoAction } from "@/server/habitudes/acciones";

const LIMITE_BYTES = 11 * 1024 * 1024;
const LADO_MAXIMO = 1600;

/**
 * Una foto de celular pesa 4–8 MB y la acción admite 11 MB por envío: con tres
 * fotos la visita fallaba. Se reduce aquí a 1600 px y JPEG al 80 % (unos 300 KB),
 * que sobra para evidencia. Si el navegador no puede, se sube la original.
 */
async function reducirFoto(archivo: File): Promise<File> {
  try {
    const mapa = await createImageBitmap(archivo);
    const escala = Math.min(1, LADO_MAXIMO / Math.max(mapa.width, mapa.height));
    const lienzo = document.createElement("canvas");

    lienzo.width = Math.round(mapa.width * escala);
    lienzo.height = Math.round(mapa.height * escala);
    lienzo.getContext("2d")?.drawImage(mapa, 0, 0, lienzo.width, lienzo.height);
    const blob = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, "image/jpeg", 0.8));

    return blob && blob.size < archivo.size
      ? new File([blob], archivo.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" })
      : archivo;
  } catch {
    return archivo;
  }
}

type Foto = { archivo: File; vista: string };

/**
 * Registrar visita en cuatro campos: Liceo, Fecha (hoy), Nº de estudiantes y
 * Fotos. Tema, tanda y observaciones van en «Más detalles». Pensado para el
 * celular: controles de 44 px, teclado numérico y la cámara directa
 * (`capture="environment"`) además de la galería.
 */
export function FormularioVisita({ liceos, hoy }: { liceos: HabitudesLiceo[]; hoy: string }) {
  const t = useTranslations("habitudes.visitForm");
  const router = useRouter();
  const avisar = useToast();
  const camara = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);

  const [liceoId, setLiceoId] = useState(liceos[0]?.id ?? "");
  const [coordenadas, setCoordenadas] = useState<{ lat: number; lng: number } | null>(null);
  const [detectando, setDetectando] = useState(false);
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [masDetalles, setMasDetalles] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const detectar = () => {
    if (!("geolocation" in navigator)) return;
    setDetectando(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const pos = { lat: coords.latitude, lng: coords.longitude };
        let mejor: HabitudesLiceo | null = null;
        let menor = Infinity;

        for (const l of liceos) {
          if (l.latitud != null && l.longitud != null) {
            const d = distanciaMetros(pos, { lat: l.latitud, lng: l.longitud });

            if (d < menor) {
              menor = d;
              mejor = l;
            }
          }
        }
        setCoordenadas(pos);
        if (mejor) setLiceoId(mejor.id);
        setDetectando(false);
      },
      () => setDetectando(false),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  };

  const agregar = async (lista: FileList | null) => {
    if (!lista || lista.length === 0) return;
    const reducidas = await Promise.all(Array.from(lista).map(reducirFoto));

    setFotos((previas) => [...previas, ...reducidas.map((archivo) => ({ archivo, vista: URL.createObjectURL(archivo) }))]);
  };

  const enviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!liceoId) return setError(t("errSchool"));
    const datos = new FormData(e.currentTarget);

    if (Number(datos.get("estudiantes_impactados")) <= 0) return setError(t("errStudents"));
    if (fotos.reduce((n, f) => n + f.archivo.size, 0) > LIMITE_BYTES) return setError(t("errPhotos"));
    datos.set("liceo_id", liceoId);
    datos.delete("fotos");
    for (const f of fotos) datos.append("fotos", f.archivo);
    if (coordenadas) {
      datos.set("latitud", String(coordenadas.lat));
      datos.set("longitud", String(coordenadas.lng));
    }

    iniciar(async () => {
      const res = await registrarVisitaLiceoAction(datos);

      if (res.ok) {
        avisar({ titulo: t("saved"), accion: { etiqueta: t("seeEvidences"), href: "/habitudes/evidencias" } });
        router.push("/habitudes");
      } else {
        setError(res.mensaje ?? t("errGeneric"));
      }
    });
  };

  return (
    <form onSubmit={enviar} className="space-y-6 pb-24 md:pb-0">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="liceo">{t("school")}</Label>
          <Button type="button" variant="ghost" size="sm" onClick={detectar} cargando={detectando}>
            <LocateFixed aria-hidden />
            {t("detect")}
          </Button>
        </div>
        <select
          id="liceo"
          value={liceoId}
          onChange={(e) => setLiceoId(e.target.value)}
          className="h-11 w-full rounded-control border border-linea-fuerte bg-card px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
        >
          {liceos.map((l) => (
            <option key={l.id} value={l.id}>
              {l.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="fecha">{t("date")}</Label>
          <Input id="fecha" name="fecha_visita" type="date" defaultValue={hoy} max={hoy} required className="h-11 text-base sm:text-sm" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="n">{t("students")}</Label>
          <Input
            id="n"
            name="estudiantes_impactados"
            type="number"
            inputMode="numeric"
            min={1}
            max={2000}
            required
            className="h-11 text-base sm:text-sm"
          />
        </div>
      </div>

      <div className="space-y-3">
        <Label>{t("photos")}</Label>
        <div className="grid grid-cols-2 gap-3">
          <Button type="button" size="lg" variant="secondary" onClick={() => camara.current?.click()}>
            <Camera aria-hidden />
            {t("takePhoto")}
          </Button>
          <Button type="button" size="lg" variant="secondary" onClick={() => galeria.current?.click()}>
            <ImagePlus aria-hidden />
            {t("fromGallery")}
          </Button>
        </div>
        <input
          ref={camara}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            void agregar(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={galeria}
          type="file"
          accept="image/jpeg,image/png"
          multiple
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            void agregar(e.target.files);
            e.target.value = "";
          }}
        />
        {fotos.length > 0 && (
          <ul className="grid grid-cols-3 gap-2">
            {fotos.map((f, i) => (
              <li key={f.vista} className="relative aspect-square overflow-hidden rounded-control bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element -- vista previa local (blob:), next/image no aplica */}
                <img src={f.vista} alt={t("photoN", { n: i + 1 })} className="size-full object-cover" />
                <button
                  type="button"
                  aria-label={t("removePhoto", { n: i + 1 })}
                  onClick={() => setFotos((p) => p.filter((_, k) => k !== i))}
                  className="absolute top-1 right-1 flex size-8 items-center justify-center rounded-full bg-tinta text-background"
                >
                  <X aria-hidden className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-linea pt-4">
        <button
          type="button"
          aria-expanded={masDetalles}
          onClick={() => setMasDetalles((v) => !v)}
          className="text-label flex min-h-11 w-full items-center justify-between text-tinta-2"
        >
          {t("moreDetails")}
        </button>
        <div className={cn("mt-3 space-y-4", !masDetalles && "hidden")}>
          <div className="space-y-2">
            <Label htmlFor="tema">{t("topic")}</Label>
            <Input id="tema" name="tema_impartido" maxLength={180} className="h-11 text-base sm:text-sm" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tanda">{t("shift")}</Label>
            <select id="tanda" name="tanda" defaultValue="matutina" className="h-11 w-full rounded-control border border-linea-fuerte bg-card px-3 text-base sm:text-sm">
              <option value="matutina">{t("shifts.matutina")}</option>
              <option value="vespertina">{t("shifts.vespertina")}</option>
              <option value="jornada_extendida">{t("shifts.jornada_extendida")}</option>
              <option value="nocturna">{t("shifts.nocturna")}</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="obs">{t("notes")}</Label>
            <Textarea id="obs" name="observaciones" rows={3} maxLength={1200} />
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-body flex items-start gap-2 rounded-control bg-tinta p-3 text-background">
          <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      {/* En el celular el botón queda fijo sobre la barra de pestañas (h-16). */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-linea bg-background/95 p-3 backdrop-blur-md md:static md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <Button type="submit" size="lg" className="w-full md:w-auto" cargando={pendiente}>
          <Check aria-hidden />
          {t("save")}
        </Button>
      </div>
    </form>
  );
}
