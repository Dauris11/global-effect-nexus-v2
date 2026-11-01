"use client";

import { useActionState, useState } from "react";
import {
  AlertCircle,
  Download,
  ExternalLink,
  FileText,
  Layers,
  Library,
  Link2,
  Loader2,
  MonitorPlay,
  Pencil,
  Plus,
  Presentation,
  Save,
  Trash2,
  UserRound,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TIPOS_MATERIAL_ACADEMIA } from "@/lib/academias";
import { ALERTA_RIESGO, ANIMACION, CUADRO, TARJETA, VACIO } from "@/lib/paleta";
import { cn } from "@/lib/utils";
import {
  descargarMaterial,
  eliminarMaterial,
  guardarMaterial,
  type EstadoAcademias,
} from "@/server/academias/acciones";
import type { MaterialFila } from "@/server/academias/consultas";

/** Clase del desplegable nativo, la misma del resto del proyecto. */
const SELECT =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-card px-2 text-base shadow-xs outline-none focus-visible:ring-[3px] sm:text-sm";

/** Icono por tipo de recurso. Iconos, no emojis: ver `gestion-programas`. */
const ICONO = {
  documento: FileText,
  presentacion: Presentation,
  video: MonitorPlay,
  enlace: Link2,
  otro: Layers,
} as const;

export type Academia = { id: string; nombre: string; estado: string };

/**
 * Repositorio de materiales de las academias.
 *
 * Se agrupa por programa y no se pinta una lista plana: un material suelto no
 * significa nada —"Guía de sesión 3" ¿de qué?— y el programa es el único
 * criterio con el que alguien busca aquí.
 *
 * LA DESCARGA NO ES UN ENLACE, ES UN BOTÓN QUE ENVÍA UN FORMULARIO. El bucket
 * es privado y sus enlaces se firman con caducidad; firmarlos al pintar la
 * lista serían 300 peticiones a Storage por visita para enlaces que nadie va a
 * pulsar, y además seguirían valiendo diez minutos después de que a esa cuenta
 * se le retire el acceso. Se firma uno, al pulsarlo. Ver `descargarMaterial`.
 *
 * Un material puede tener archivo, enlace, o los dos: la fila enseña lo que
 * tenga y nada más.
 */
export function GestionMateriales({
  materiales,
  academias,
  puedeEscribir,
  hayFiltro,
}: {
  materiales: readonly MaterialFila[];
  academias: readonly Academia[];
  puedeEscribir: boolean;
  hayFiltro: boolean;
}) {
  const t = useTranslations("academies");
  const [editando, setEditando] = useState<string | null>(null);

  // La consulta ya viene ordenada por academia; aquí solo se parte en grupos.
  // Agrupar en SQL habría querido decir traer el nombre repetido en cada fila
  // igual que ahora, sin ahorrar nada, y con un ORDER BY que la vista tendría
  // que respetar a ciegas.
  const grupos = new Map<string, MaterialFila[]>();

  for (const fila of materiales) {
    const grupo = grupos.get(fila.academia_id);
    if (grupo) grupo.push(fila);
    else grupos.set(fila.academia_id, [fila]);
  }

  const sinProgramas = academias.length === 0;

  return (
    <div className={cn("space-y-4", ANIMACION.entrada)}>
      {puedeEscribir && editando !== "nuevo" && !sinProgramas && (
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            onClick={() => setEditando("nuevo")}
            className="transition-transform duration-150 active:scale-95"
          >
            <Plus className="size-3.5" />
            {t("materials.new")}
          </Button>
        </div>
      )}

      {editando === "nuevo" && (
        <Card>
          <CardContent className="pt-5">
            <Formulario
              academias={academias}
              alTerminar={() => setEditando(null)}
            />
          </CardContent>
        </Card>
      )}

      {/* Sin un solo programa no se puede subir nada: `material.academia_id` es
          NOT NULL. Se dice de dónde empezar en vez de ofrecer un formulario
          cuyo desplegable estaría vacío. */}
      {sinProgramas ? (
        <Card>
          <CardContent className={VACIO.contenedor}>
            <span className={VACIO.icono}>
              <Presentation className="size-6" />
            </span>
            <p className={VACIO.titulo}>{t("materials.noPrograms")}</p>
          </CardContent>
        </Card>
      ) : materiales.length === 0 ? (
        <Card>
          <CardContent className={VACIO.contenedor}>
            <span className={VACIO.icono}>
              <Library className="size-6" />
            </span>
            <p className={VACIO.titulo}>
              {hayFiltro ? t("materials.noMatches") : t("materials.empty")}
            </p>
          </CardContent>
        </Card>
      ) : (
        [...grupos.values()].map((grupo) => (
          <Card key={grupo[0].academia_id} className={TARJETA.contenido}>
            <CardContent className="space-y-3 pt-5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{grupo[0].academia}</p>
                <Badge variant="secondary" className="text-[10px]">
                  {t("materials.count", { count: grupo.length })}
                </Badge>
              </div>

              <ul className="space-y-2">
                {grupo.map((fila) => (
                  <li key={fila.id}>
                    {editando === fila.id ? (
                      <div className="rounded-xl border p-3">
                        <Formulario
                          material={fila}
                          academias={academias}
                          alTerminar={() => setEditando(null)}
                        />
                      </div>
                    ) : (
                      <Ficha
                        fila={fila}
                        puedeEscribir={puedeEscribir}
                        alEditar={() => setEditando(fila.id)}
                      />
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

/** Un material: qué es, de quién es y cómo se abre. */
function Ficha({
  fila,
  puedeEscribir,
  alEditar,
}: {
  fila: MaterialFila;
  puedeEscribir: boolean;
  alEditar: () => void;
}) {
  const t = useTranslations("academies");

  const Icono = ICONO[fila.tipo as keyof typeof ICONO] ?? Layers;

  return (
    <div className={cn("group items-start", TARJETA.fila)}>
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg transition-transform duration-150 group-hover:scale-110",
          fila.storage_key ? CUADRO.marca : CUADRO.suave,
        )}
      >
        <Icono className="size-4" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium break-words">{fila.titulo}</p>

        {fila.descripcion && (
          <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
            {fila.descripcion}
          </p>
        )}

        <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span>{t(`materialType.${fila.tipo}` as never)}</span>

          {fila.autor && (
            <span className="inline-flex items-center gap-1">
              <UserRound className="size-3 shrink-0" />
              {fila.autor}
            </span>
          )}

          {fila.archivo_nombre && (
            <span className="truncate">{fila.archivo_nombre}</span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {fila.storage_key && (
          <form action={descargarMaterial}>
            <input type="hidden" name="id" value={fila.id} />
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              title={t("materials.download")}
              className="transition-transform duration-150 active:scale-95"
            >
              <Download className="size-3.5" />
              <span className="hidden sm:inline">
                {t("materials.download")}
              </span>
            </Button>
          </form>
        )}

        {fila.enlace_url && (
          <Button asChild variant="ghost" size="sm">
            {/* `rel="noreferrer"`: el enlace lo escribió alguien del equipo,
                pero apunta fuera, y una pestaña nueva con `window.opener`
                puede reescribir la que la abrió. */}
            <a
              href={fila.enlace_url}
              target="_blank"
              rel="noreferrer"
              title={t("materials.open")}
            >
              <ExternalLink className="size-3.5" />
              <span className="hidden sm:inline">{t("materials.open")}</span>
            </a>
          </Button>
        )}

        {puedeEscribir && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={alEditar}
              title={t("materials.edit")}
              aria-label={t("materials.edit")}
              className="size-8"
            >
              <Pencil className="size-3.5" />
            </Button>

            <DialogoBorrado fila={fila} />
          </>
        )}
      </div>
    </div>
  );
}

/** Borrado con confirmación: se lleva también el archivo del bucket. */
function DialogoBorrado({ fila }: { fila: MaterialFila }) {
  const t = useTranslations("academies");
  const [abierto, setAbierto] = useState(false);
  const [estado, enviar, enviando] = useActionState<EstadoAcademias, FormData>(
    async (previo, datos) => {
      const resultado = await eliminarMaterial(previo, datos);
      if (resultado.estado === "ok") setAbierto(false);
      return resultado;
    },
    { estado: "inicial" },
  );

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setAbierto(true)}
        title={t("materials.delete")}
        aria-label={t("materials.delete")}
        className="size-8"
      >
        <Trash2 className="size-3.5" />
      </Button>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("materials.confirmTitle", { name: fila.titulo })}
            </DialogTitle>
            <DialogDescription>
              {fila.storage_key
                ? t("materials.deleteWarningFile")
                : t("materials.deleteWarning")}
            </DialogDescription>
          </DialogHeader>

          {estado.estado !== "inicial" && estado.estado !== "ok" && (
            <p role="alert" className={ALERTA_RIESGO.contenedor}>
              <AlertCircle className={ALERTA_RIESGO.icono} />
              <span className={ALERTA_RIESGO.texto}>{t("form.error")}</span>
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setAbierto(false)}
            >
              {t("form.cancel")}
            </Button>

            <form action={enviar}>
              <input type="hidden" name="id" value={fila.id} />
              <Button type="submit" variant="destructive" disabled={enviando}>
                {enviando ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                {enviando
                  ? t("materials.deleting")
                  : t("materials.delete")}
              </Button>
            </form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Alta y edición. Sin `material`, es un alta. */
function Formulario({
  material,
  academias,
  alTerminar,
}: {
  material?: MaterialFila;
  academias: readonly Academia[];
  alTerminar: () => void;
}) {
  const t = useTranslations("academies");
  const [estado, enviar, enviando] = useActionState<EstadoAcademias, FormData>(
    async (previo, datos) => {
      const resultado = await guardarMaterial(previo, datos);
      if (resultado.estado === "ok") alTerminar();
      return resultado;
    },
    { estado: "inicial" },
  );

  const clave = material?.id ?? "nuevo";

  return (
    <form action={enviar} className="space-y-3">
      <div>
        <p className="text-sm font-semibold">
          {material ? t("materials.editTitle") : t("materials.newTitle")}
        </p>
      </div>

      <input type="hidden" name="id" value={material?.id ?? ""} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`m-titulo-${clave}`}>{t("field.title")}</Label>
          <Input
            id={`m-titulo-${clave}`}
            name="titulo"
            defaultValue={material?.titulo}
            required
            maxLength={200}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`m-academia-${clave}`}>{t("field.program")}</Label>
          <select
            id={`m-academia-${clave}`}
            name="academia_id"
            defaultValue={material?.academia_id ?? academias[0]?.id ?? ""}
            required
            className={SELECT}
          >
            {academias.map((academia) => (
              <option key={academia.id} value={academia.id}>
                {academia.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`m-tipo-${clave}`}>{t("field.type")}</Label>
          <select
            id={`m-tipo-${clave}`}
            name="tipo"
            defaultValue={material?.tipo ?? "documento"}
            className={SELECT}
          >
            {TIPOS_MATERIAL_ACADEMIA.map((valor) => (
              <option key={valor} value={valor}>
                {t(`materialType.${valor}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`m-autor-${clave}`}>{t("field.author")}</Label>
          <Input
            id={`m-autor-${clave}`}
            name="autor"
            defaultValue={material?.autor ?? ""}
            maxLength={160}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`m-enlace-${clave}`}>{t("field.link")}</Label>
          <Input
            id={`m-enlace-${clave}`}
            name="enlace_url"
            type="url"
            inputMode="url"
            defaultValue={material?.enlace_url ?? ""}
            maxLength={500}
            placeholder="https://"
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`m-archivo-${clave}`}>{t("field.file")}</Label>
          {/* `accept` es una comodidad del navegador, no una comprobación: el
              tipo y el tamaño se vuelven a mirar en el servidor. */}
          <Input
            id={`m-archivo-${clave}`}
            name="archivo"
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.pptx,.docx"
            className="cursor-pointer"
          />
          <p className="text-muted-foreground text-[10px] leading-relaxed">
            {material?.archivo_nombre
              ? t("field.fileReplaceHint", { name: material.archivo_nombre })
              : t("field.fileHint")}
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`m-desc-${clave}`}>{t("field.description")}</Label>
        <Textarea
          id={`m-desc-${clave}`}
          name="descripcion"
          defaultValue={material?.descripcion ?? ""}
          maxLength={900}
          rows={2}
        />
      </div>

      {estado.estado !== "inicial" && estado.estado !== "ok" && (
        <p role="alert" className={ALERTA_RIESGO.contenedor}>
          <AlertCircle className={ALERTA_RIESGO.icono} />
          <span className={ALERTA_RIESGO.texto}>
            {estado.estado === "nombre_vacio"
              ? t("form.titleRequired")
              : estado.estado === "sin_contenido"
                ? t("form.contentRequired")
                : estado.estado === "enlace_invalido"
                  ? t("form.linkInvalid")
                  : estado.estado === "archivo_invalido"
                    ? t("form.fileInvalid")
                    : estado.estado === "archivo_grande"
                      ? t("form.fileTooBig")
                      : t("form.error")}
          </span>
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={enviando}
          className="transition-transform duration-150 active:scale-95"
        >
          {enviando ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Save className="size-3.5" />
          )}
          {enviando
            ? material
              ? t("form.saving")
              : t("form.creating")
            : material
              ? t("form.save")
              : t("form.create")}
        </Button>

        <Button type="button" variant="ghost" size="sm" onClick={alTerminar}>
          {t("form.cancel")}
        </Button>
      </div>
    </form>
  );
}
