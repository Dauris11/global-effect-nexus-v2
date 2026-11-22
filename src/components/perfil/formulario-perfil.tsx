"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Camera,
  Check,
  CheckCircle2,
  FileText,
  Globe,
  ImagePlus,
  Loader2,
  Save,
  User,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { guardarPerfil, type EstadoPerfil } from "@/server/perfil/acciones";

/** Lo mismo que impone el bucket y vuelve a comprobar el servidor. */
const MAXIMO_DESCRIPCION = 280;

/**
 * Redimensiona y normaliza cualquier imagen seleccionada por el usuario a un
 * cuadrado o proporción máxima de 360x360 en JPEG (~30–50 KB), evitando que
 * fotografías de cámara (> 2 MB) fallen al subir y garantizando persistencia.
 */
async function normalizarImagenAvatar(archivo: File): Promise<{
  dataUrl: string;
  archivoNormalizado: File;
} | null> {
  return new Promise((resolver) => {
    const lector = new FileReader();
    lector.onload = () => {
      const resultado = typeof lector.result === "string" ? lector.result : null;
      if (!resultado) {
        resolver(null);
        return;
      }

      const img = new Image();
      img.onload = () => {
        const maxLado = 360;
        const escala = Math.min(
          1,
          maxLado / Math.max(img.width || 1, img.height || 1),
        );
        const ancho = Math.max(1, Math.round(img.width * escala));
        const alto = Math.max(1, Math.round(img.height * escala));

        const lienzo = document.createElement("canvas");
        lienzo.width = ancho;
        lienzo.height = alto;
        const ctx = lienzo.getContext("2d");
        if (!ctx) {
          resolver(null);
          return;
        }

        ctx.drawImage(img, 0, 0, ancho, alto);
        const dataUrl = lienzo.toDataURL("image/jpeg", 0.86);
        lienzo.toBlob(
          (blob) => {
            if (!blob) {
              resolver({
                dataUrl,
                archivoNormalizado: archivo,
              });
              return;
            }
            const nuevoArchivo = new File([blob], "avatar.jpg", {
              type: "image/jpeg",
            });
            resolver({ dataUrl, archivoNormalizado: nuevoArchivo });
          },
          "image/jpeg",
          0.86,
        );
      };
      img.onerror = () => resolver(null);
      img.src = resultado;
    };
    lector.onerror = () => resolver(null);
    lector.readAsDataURL(archivo);
  });
}

/**
 * Perfil propio: foto, nombre, presentación e idioma.
 */
export function FormularioPerfil({
  nombre,
  descripcion,
  idioma,
  fotoActual,
}: {
  nombre: string;
  descripcion: string | null;
  idioma: string;
  /** URL pública de la foto, o `null` para dibujar la inicial. */
  fotoActual: string | null;
}) {
  const t = useTranslations("profile");
  const router = useRouter();
  const [enviando, iniciarTransicion] = useTransition();
  const [estado, setEstado] = useState<EstadoPerfil>({ estado: "inicial" });

  const [nombreValor, setNombreValor] = useState(nombre);
  const [idiomaValor, setIdiomaValor] = useState(idioma);
  const [texto, setTexto] = useState(descripcion ?? "");
  const [previa, setPrevia] = useState<string | null>(null);
  const [archivoFoto, setArchivoFoto] = useState<File | null>(null);
  const [fotoDataUrl, setFotoDataUrl] = useState<string | null>(null);

  const inicial = nombreValor.trim().charAt(0).toUpperCase() || "?";

  const porcentajeBio = Math.min(
    100,
    Math.round((texto.length / MAXIMO_DESCRIPCION) * 100),
  );

  const manejarSeleccionFoto = async (
    evento: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const archivo = evento.target.files?.[0];
    if (!archivo) {
      setPrevia(null);
      setArchivoFoto(null);
      setFotoDataUrl(null);
      return;
    }

    setEstado({ estado: "inicial" });
    setPrevia(URL.createObjectURL(archivo));
    setArchivoFoto(archivo);

    const normalizada = await normalizarImagenAvatar(archivo);
    if (normalizada) {
      setPrevia(normalizada.dataUrl);
      setFotoDataUrl(normalizada.dataUrl);
      setArchivoFoto(normalizada.archivoNormalizado);
    }
  };

  const manejarEnvio = (evento: React.FormEvent<HTMLFormElement>) => {
    evento.preventDefault();

    const datos = new FormData();
    datos.set("nombre", nombreValor);
    datos.set("idioma", idiomaValor);
    datos.set("descripcion", texto);
    if (archivoFoto) {
      datos.set("foto", archivoFoto);
    }
    if (fotoDataUrl) {
      datos.set("foto_data_url", fotoDataUrl);
    }

    iniciarTransicion(async () => {
      const resultado = await guardarPerfil(estado, datos);
      setEstado(resultado);
      if (resultado.estado === "ok") {
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={manejarEnvio} className="space-y-6">
      <input type="hidden" name="foto_data_url" value={fotoDataUrl ?? ""} />

      {/* Selector e inspección de Avatar */}
      <div className="flex flex-wrap items-center gap-5 rounded-2xl border border-linea/80 bg-muted/80 p-4 transition-all">
        <label
          htmlFor="perfil-foto"
          className="group relative cursor-pointer focus-within:outline-none"
        >
          <div className="relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-marca-50 text-3xl font-semibold text-marca-700 shadow-card ring-4 ring-marca-500/20 transition-all group-hover:ring-marca-500/40">
            {previa ?? fotoActual ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previa ?? fotoActual ?? ""}
                alt={nombreValor}
                className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <span>{inicial}</span>
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-tinta/50 text-white opacity-0 transition-opacity group-hover:opacity-100">
              <Camera className="size-6" />
            </div>
          </div>
          <span className="absolute -right-1 -bottom-1 rounded-full border-2 border-card bg-marca-500 p-1.5 text-white shadow-card transition-transform group-hover:scale-110">
            <ImagePlus className="size-3.5" />
          </span>
        </label>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <Label
              htmlFor="perfil-foto"
              className="cursor-pointer text-sm font-semibold"
            >
              {t("photo")}
            </Label>
            {previa && (
              <span className="rounded-full bg-marca-500/15 px-2 py-0.5 text-[10px] font-medium text-marca-600">
                {t("preview")}
              </span>
            )}
          </div>
          <Input
            id="perfil-foto"
            name="foto"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="cursor-pointer border-linea text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-marca-500/10 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-marca-600 hover:file:bg-marca-500/20"
            onChange={manejarSeleccionFoto}
          />
        </div>
      </div>

      {/* Nombre e Idioma */}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label
            htmlFor="perfil-nombre"
            className="flex items-center gap-1.5 text-xs font-medium text-tinta-2"
          >
            <User className="size-3.5 text-marca-500" />
            {t("fieldName")}
          </Label>
          <Input
            id="perfil-nombre"
            name="nombre"
            value={nombreValor}
            onChange={(e) => setNombreValor(e.target.value)}
            required
            maxLength={120}
            aria-invalid={estado.estado === "nombre_vacio" || undefined}
            className="h-10 rounded-xl border-linea focus-visible:ring-marca-500/30"
          />
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="perfil-idioma"
            className="flex items-center gap-1.5 text-xs font-medium text-tinta-2"
          >
            <Globe className="size-3.5 text-marca-500" />
            {t("fieldLanguage")}
          </Label>
          <div className="relative">
            <select
              id="perfil-idioma"
              name="idioma"
              value={idiomaValor}
              onChange={(e) => setIdiomaValor(e.target.value)}
              className="h-10 w-full cursor-pointer appearance-none rounded-xl border border-linea bg-card px-3 pr-8 text-sm shadow-xs outline-none transition-all focus-visible:border-marca-500 focus-visible:ring-[3px] focus-visible:ring-marca-500/20"
            >
              <option value="es">🇪🇸 {t("language.es")}</option>
              <option value="en">🇺🇸 {t("language.en")}</option>
            </select>
            <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-tinta-3">
              ▼
            </span>
          </div>
        </div>
      </div>

      {/* Bio / Presentación */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label
            htmlFor="perfil-bio"
            className="flex items-center gap-1.5 text-xs font-medium text-tinta-2"
          >
            <FileText className="size-3.5 text-marca-500" />
            {t("fieldBio")}
          </Label>
          <span className="font-mono text-[11px] text-tinta-3">
            {texto.length} / {MAXIMO_DESCRIPCION}
          </span>
        </div>

        <Textarea
          id="perfil-bio"
          name="descripcion"
          value={texto}
          onChange={(evento) => setTexto(evento.target.value)}
          maxLength={MAXIMO_DESCRIPCION}
          rows={3}
          aria-invalid={estado.estado === "descripcion_larga" || undefined}
          className="resize-none rounded-xl border-linea text-sm focus-visible:ring-marca-500/30"
        />

        {/* Barra de progreso de caracteres */}
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              texto.length > MAXIMO_DESCRIPCION * 0.9
                ? "bg-marca-700"
                : "bg-marca-500"
            }`}
            style={{ width: `${porcentajeBio}%` }}
          />
        </div>
      </div>

      {/* Alerta de estado */}
      {estado.estado !== "inicial" && (
        <div
          role="alert"
          className={`flex items-center gap-2.5 rounded-xl p-3.5 text-xs font-medium transition-all ${
            estado.estado === "ok"
              ? "border border-marca-500/30 bg-marca-500/15 text-marca-600"
              : "border border-linea bg-tinta text-background"
          }`}
        >
          {estado.estado === "ok" ? (
            <CheckCircle2 className="size-4 shrink-0 text-marca-600" />
          ) : (
            <AlertCircle className="size-4 shrink-0 text-background/80" />
          )}
          <span>
            {estado.estado === "ok"
              ? t("saved")
              : estado.estado === "nombre_vacio"
                ? t("errName")
                : estado.estado === "descripcion_larga"
                  ? t("errBio")
                  : estado.estado === "foto_invalida"
                    ? t("errPhotoType")
                    : estado.estado === "foto_grande"
                      ? t("errPhotoSize")
                      : t("errGeneric")}
          </span>
        </div>
      )}

      {/* Botón de Guardar con icono de Save */}
      <div className="pt-2">
        <Button
          type="submit"
          cargando={enviando}
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-marca-500 px-5 py-2.5 font-medium text-white shadow-xs transition-all hover:bg-marca-600 active:scale-[0.99] active:bg-marca-700"
        >
          {enviando ? (
            <Loader2 className="size-4 animate-spin" />
          ) : estado.estado === "ok" ? (
            <Check className="size-4" />
          ) : (
            <Save className="size-4" />
          )}
          <span>{enviando ? t("saving") : t("save")}</span>
        </Button>
      </div>
    </form>
  );
}
