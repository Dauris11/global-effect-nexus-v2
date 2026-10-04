"use client";

import { useActionState, useState } from "react";
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
  Sparkles,
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
  const [estado, enviar, enviando] = useActionState<EstadoPerfil, FormData>(
    guardarPerfil,
    { estado: "inicial" },
  );

  const [texto, setTexto] = useState(descripcion ?? "");
  const [previa, setPrevia] = useState<string | null>(null);
  const inicial = nombre.trim().charAt(0).toUpperCase() || "?";

  const porcentajeBio = Math.min(100, Math.round((texto.length / MAXIMO_DESCRIPCION) * 100));

  return (
    <form action={enviar} className="space-y-6">
      {/* Selector e inspección de Avatar */}
      <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center gap-5 transition-all">
        <label
          htmlFor="perfil-foto"
          className="group relative cursor-pointer focus-within:outline-none"
        >
          <div className="relative size-24 shrink-0 rounded-2xl overflow-hidden ring-4 ring-[#2096BA]/20 group-hover:ring-[#2096BA]/50 transition-all shadow-md bg-gradient-to-br from-[#2096BA]/20 to-[#187a99]/30 flex items-center justify-center text-3xl font-extrabold text-[#187a99] dark:text-[#5FB8D4]">
            {previa ?? fotoActual ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previa ?? fotoActual ?? ""}
                alt=""
                className="size-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <span>{inicial}</span>
            )}
            <div className="absolute inset-0 bg-[#171A1D]/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
              <Camera className="size-6" />
            </div>
          </div>
          <span className="absolute -bottom-1 -right-1 bg-[#2096BA] text-white p-1.5 rounded-full shadow-md border-2 border-white dark:border-slate-950 group-hover:scale-110 transition-transform">
            <ImagePlus className="size-3.5" />
          </span>
        </label>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <Label htmlFor="perfil-foto" className="font-semibold text-sm cursor-pointer">
              {t("photo")}
            </Label>
            {previa && (
              <span className="text-[10px] bg-[#2096BA]/15 text-[#187a99] font-medium px-2 py-0.5 rounded-full">
                {t("preview")}
              </span>
            )}
          </div>
          <Input
            id="perfil-foto"
            name="foto"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="cursor-pointer text-xs file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#2096BA]/10 file:text-[#187a99] hover:file:bg-[#2096BA]/20 border-slate-200 dark:border-slate-800"
            onChange={(evento) => {
              const archivo = evento.target.files?.[0];
              setPrevia(archivo ? URL.createObjectURL(archivo) : null);
            }}
          />
          <p className="text-muted-foreground text-xs">{t("photoHint")}</p>
        </div>
      </div>

      {/* Nombre e Idioma */}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="perfil-nombre" className="flex items-center gap-1.5 font-medium text-xs text-slate-700 dark:text-slate-300">
            <User className="size-3.5 text-[#2096BA]" />
            {t("fieldName")}
          </Label>
          <Input
            id="perfil-nombre"
            name="nombre"
            defaultValue={nombre}
            required
            maxLength={120}
            aria-invalid={estado.estado === "nombre_vacio" || undefined}
            className="h-10 rounded-xl border-slate-200 focus-visible:ring-[#2096BA]/30 dark:border-slate-800"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="perfil-idioma" className="flex items-center gap-1.5 font-medium text-xs text-slate-700 dark:text-slate-300">
            <Globe className="size-3.5 text-[#2096BA]" />
            {t("fieldLanguage")}
          </Label>
          <div className="relative">
            <select
              id="perfil-idioma"
              name="idioma"
              defaultValue={idioma}
              className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 pr-8 text-sm shadow-xs outline-none focus-visible:border-[#2096BA] focus-visible:ring-[3px] focus-visible:ring-[#2096BA]/20 transition-all appearance-none cursor-pointer"
            >
              <option value="es">🇪🇸 {t("language.es")}</option>
              <option value="en">🇺🇸 {t("language.en")}</option>
            </select>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
              ▼
            </span>
          </div>
        </div>
      </div>

      {/* Bio / Presentación */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="perfil-bio" className="flex items-center gap-1.5 font-medium text-xs text-slate-700 dark:text-slate-300">
            <FileText className="size-3.5 text-[#2096BA]" />
            {t("fieldBio")}
          </Label>
          <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
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
          className="rounded-xl border-slate-200 dark:border-slate-800 focus-visible:ring-[#2096BA]/30 resize-none text-sm"
        />

        {/* Barra de progreso de caracteres */}
        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              texto.length > MAXIMO_DESCRIPCION * 0.9 ? "bg-[#0a6a8a]" : "bg-[#2096BA]"
            }`}
            style={{ width: `${porcentajeBio}%` }}
          />
        </div>

        <p className="text-muted-foreground text-xs flex items-center gap-1">
          <Sparkles className="size-3 text-[#2096BA] shrink-0" />
          <span>{t("bioHint")}</span>
        </p>
      </div>

      {/* Alerta de estado */}
      {estado.estado !== "inicial" && (
        <div
          role="alert"
          className={`p-3.5 rounded-xl text-xs font-medium flex items-center gap-2.5 transition-all ${
            estado.estado === "ok"
              ? "bg-[#2096BA]/15 text-[#187a99] dark:text-[#5FB8D4] border border-[#2096BA]/30"
              : "bg-[#171A1D] text-white border border-slate-700"
          }`}
        >
          {estado.estado === "ok" ? (
            <CheckCircle2 className="size-4 text-[#187a99] dark:text-[#5FB8D4] shrink-0" />
          ) : (
            <AlertCircle className="size-4 text-slate-300 shrink-0" />
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
          disabled={enviando}
          className="inline-flex items-center justify-center gap-2 bg-[#2096BA] hover:bg-[#187a99] active:bg-[#0a6a8a] text-white font-medium px-5 py-2.5 rounded-xl shadow-xs hover:shadow-md transition-all active:scale-[0.99] cursor-pointer"
        >
          {enviando ? (
            <Loader2 className="size-4 animate-spin" />
          ) : estado.estado === "ok" ? (
            // El "guardado" ya lo dice el cambio de icono, que es la señal que
            // sobrevive en blanco y negro. Teñirlo además rompía la paleta.
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


