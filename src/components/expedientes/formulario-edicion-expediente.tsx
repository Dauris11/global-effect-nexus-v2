"use client";

import { useActionState, useState } from "react";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  ImagePlus,
  Loader2,
  PencilLine,
  Save,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { actualizarExpediente, type EstadoExpediente } from "@/server/expedientes/acciones";
import type { ExpedienteCompleto } from "@/server/expedientes/consultas";
import {
  CamposExpediente,
  SECCIONES,
  type TextosFormulario,
} from "./formulario-expediente";

/**
 * Edición del expediente: la ficha completa, precargada y con guardado real.
 *
 * Abre siempre en modo VISTA —previsualización sin tocar nada—, aunque quien
 * mira pueda escribir en él. Entrar a editar es un paso aparte, con su
 * propio botón: así abrir un expediente para consultarlo no arriesga escribir
 * encima de un campo por accidente. `key={modo}` en `CamposExpediente` fuerza
 * un remonte al cambiar de modo, que es también cómo "Cancelar" descarta lo
 * que se haya tecleado: los campos vuelven a nacer con el valor original de
 * `expediente`, no con lo que había en pantalla.
 *
 * `puedeEditar` llega ya resuelto por la página: es `false` cuando quien mira
 * el expediente no tiene `expedientes.escribir`.
 * En ese caso no hay botón de "Editar" que mostrar: la vista es lo único que
 * hay.
 */

type TextosEdicion = TextosFormulario & {
  guardando: string;
  savedEdit: string;
  notOwner: string;
  readOnlyNote: string;
  photoInvalid: string;
  photoTooLarge: string;
  error: string;
  verExpediente: string;
  editarExpediente: string;
};

export function FormularioEdicionExpediente({
  expediente,
  fotoActual,
  puedeEditar,
  editarInicial = false,
  textos,
}: {
  expediente: ExpedienteCompleto;
  /** URL pública de la foto actual, o `null` para dibujar la inicial. */
  fotoActual: string | null;
  puedeEditar: boolean;
  /** Abre ya en modo edición, para cuando se llega con `?editar=1` desde la vista rápida. */
  editarInicial?: boolean;
  textos: TextosEdicion;
}) {
  const [estado, enviar, enviando] = useActionState<EstadoExpediente, FormData>(
    actualizarExpediente,
    { estado: "inicial" },
  );

  const [editando, setEditando] = useState(editarInicial);
  const [seccion, setSeccion] = useState<string>(SECCIONES[0]);
  const [previa, setPrevia] = useState<string | null>(null);

  const indice = SECCIONES.indexOf(seccion as (typeof SECCIONES)[number]);
  const inicial = expediente.nombre.trim().charAt(0).toUpperCase() || "?";
  const soloLectura = !editando;

  const ir = (paso: number) => {
    const siguiente = SECCIONES[indice + paso];
    if (siguiente) setSeccion(siguiente);
  };

  const salirDeEdicion = () => {
    setEditando(false);
    setPrevia(null);
  };

  return (
    <form action={enviar} className="space-y-4">
      <input type="hidden" name="id" value={expediente.id} />

      {!puedeEditar && (
        <div className="flex items-center gap-2 rounded-xl border border-[#171A1D]/20 bg-[#171A1D]/5 p-3 text-xs font-medium text-[#171A1D] dark:border-white/20 dark:bg-white/5 dark:text-white">
          <Eye className="size-4 shrink-0" />
          {textos.notOwner}
        </div>
      )}

      {/* Foto: mismo patrón que el perfil propio (formulario-perfil.tsx), con
          el bucket `avatares` y una vista previa antes de guardar. */}
      <div className="flex flex-wrap items-center gap-5 rounded-2xl border border-linea/80 bg-muted/80 p-4 transition-colors dark:border-slate-800 dark:bg-slate-900/40">
        <label
          htmlFor="expediente-foto"
          className={cn(
            "group relative",
            editando ? "cursor-pointer" : "cursor-default",
          )}
        >
          <div className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-marca-50 text-2xl font-semibold text-marca-700 shadow-card ring-4 ring-marca-500/20 transition-all group-hover:ring-marca-500/40">
            {previa ?? fotoActual ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previa ?? fotoActual ?? ""}
                alt=""
                className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <span>{inicial}</span>
            )}
            {editando && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#171A1D]/50 text-white opacity-0 transition-opacity group-hover:opacity-100">
                <Camera className="size-5" />
              </div>
            )}
          </div>
          {editando && (
            <span className="absolute -right-1 -bottom-1 rounded-full border-2 border-white bg-[#2096BA] p-1 text-white shadow-md transition-transform group-hover:scale-110 dark:border-slate-950">
              <ImagePlus className="size-3" />
            </span>
          )}
        </label>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor="expediente-foto" className="text-sm font-semibold">
              {textos.campos.photo}
            </Label>

            {puedeEditar && (
              <Button
                type="button"
                variant={editando ? "outline" : "default"}
                size="sm"
                onClick={() => (editando ? salirDeEdicion() : setEditando(true))}
                className="h-7 gap-1.5 px-2.5 text-xs transition-transform active:scale-95"
              >
                {editando ? (
                  <>
                    <X className="size-3.5" />
                    {textos.cancelar}
                  </>
                ) : (
                  <>
                    <PencilLine className="size-3.5" />
                    {textos.editarExpediente}
                  </>
                )}
              </Button>
            )}
          </div>

          {editando ? (
            <Input
              id="expediente-foto"
              name="foto"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="cursor-pointer text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-[#2096BA]/10 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-[#187a99] file:transition-colors hover:file:bg-[#2096BA]/20"
              onChange={(evento) => {
                const archivo = evento.target.files?.[0];
                setPrevia(archivo ? URL.createObjectURL(archivo) : null);
              }}
            />
          ) : (
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <Eye className="size-3.5 shrink-0" />
              {textos.verExpediente}
            </p>
          )}
        </div>
      </div>

      {/* La navegación entre secciones va ARRIBA de los campos.
          Abajo obligaba a recorrer la sección entera para descubrir que había
          otra —y con seis secciones, quien abre la ficha para mirar un dato
          concreto no quiere leerlas todas por el camino—. Guardar y cancelar
          se quedan al pie: eso no es navegar, es cerrar el trabajo. */}
      <div className="flex flex-wrap items-center gap-3 border-b pb-4">
        <p className="text-muted-foreground text-xs">{textos.progreso[indice]}</p>

        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => ir(-1)}
            disabled={indice === 0}
            className="transition-transform active:scale-95"
          >
            <ChevronLeft className="size-4" />
            {textos.anterior}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => ir(1)}
            disabled={indice === SECCIONES.length - 1}
            className="transition-transform active:scale-95"
          >
            {textos.siguiente}
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <CamposExpediente
        key={editando ? "editando" : "viendo"}
        textos={textos}
        seccion={seccion}
        onSeccionChange={setSeccion}
        valores={expediente}
        soloLectura={soloLectura}
      />

      {estado.estado !== "inicial" && (
        <div
          role="alert"
          className={cn(
            "animate-in fade-in slide-in-from-top-1 flex items-center gap-2.5 rounded-xl p-3.5 text-xs font-medium duration-200",
            estado.estado === "ok"
              ? "border border-[#2096BA]/30 bg-[#2096BA]/15 text-[#187a99]"
              : "border border-slate-700 bg-[#171A1D] text-white",
          )}
        >
          {estado.estado === "ok" ? (
            <CheckCircle2 className="size-4 shrink-0" />
          ) : (
            <AlertCircle className="size-4 shrink-0" />
          )}
          <span>
            {estado.estado === "ok"
              ? textos.savedEdit
              : estado.estado === "foto_invalida"
                ? textos.photoInvalid
                : estado.estado === "foto_grande"
                  ? textos.photoTooLarge
                  : estado.estado === "no_encontrado" || estado.estado === "no_permitido"
                    ? textos.notOwner
                    : textos.error}
          </span>
        </div>
      )}

      {/* El pie solo aparece si se está editando: cuando la ficha está en modo
          vista no hay nada que guardar ni que cancelar, y una barra vacía solo
          añadía un borde al final de la página. */}
      {editando && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={salirDeEdicion}
            className="transition-transform active:scale-95"
          >
            <X className="size-4" />
            {textos.cancelar}
          </Button>

          <Button
            type="submit"
            size="sm"
            disabled={enviando}
            className="transition-transform active:scale-95"
          >
            {enviando ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {enviando ? textos.guardando : textos.guardar}
          </Button>
        </div>
      )}
    </form>
  );
}
