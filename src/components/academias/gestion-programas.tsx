"use client";

import { useActionState, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  Compass,
  Layers,
  Library,
  Lightbulb,
  Loader2,
  Pencil,
  Plus,
  Presentation,
  Save,
  Trash2,
  UserRound,
  Users,
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
import { ESTADOS_ACADEMIA, TIPOS_ACADEMIA } from "@/lib/academias";
import { ALERTA_RIESGO, ANIMACION, CUADRO, TARJETA, VACIO } from "@/lib/paleta";
import { cn } from "@/lib/utils";
import {
  eliminarAcademia,
  guardarAcademia,
  type EstadoAcademias,
} from "@/server/academias/acciones";
import type { AcademiaFila } from "@/server/academias/consultas";

/** Clase del desplegable nativo, la misma del resto del proyecto. */
const SELECT =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-card px-2 text-base shadow-xs outline-none focus-visible:ring-[3px] sm:text-sm";

/**
 * Icono por tipo de programa.
 *
 * El inventario del prototipo pedía emojis —🎯 liderazgo, 💡 habilidades,
 * 📘 otro—. Aquí son iconos de `lucide-react`, que es la única familia que el
 * proyecto usa: un emoji se dibuja distinto en cada sistema operativo y no
 * hereda el color del cuadro que lo contiene.
 */
const ICONO = {
  liderazgo: Compass,
  habilidades: Lightbulb,
  otro: Layers,
} as const;

/**
 * Catálogo de programas de academia.
 *
 * El estado no lleva matiz propio: `activa` va en el azul de la marca,
 * `planificada` en azul claro e `inactiva` en gris, que es la misma escala de
 * peso que usan proyectos y patrocinadores.
 *
 * Sobre `participantes`: es un número que se teclea, no una cuenta. No existe
 * tabla de inscripción a una academia, así que no hay de dónde contarlo, y la
 * tarjeta lo dice con su propia etiqueta en vez de dejarlo pasar por un dato
 * calculado. Ver la cabecera de `@/server/academias/consultas`.
 */
export function GestionProgramas({
  academias,
  puedeEscribir,
  hayFiltro,
}: {
  academias: readonly AcademiaFila[];
  puedeEscribir: boolean;
  hayFiltro: boolean;
}) {
  const t = useTranslations("academies");
  const [editando, setEditando] = useState<string | null>(null);

  return (
    <div className={cn("space-y-4", ANIMACION.entrada)}>
      {puedeEscribir && editando !== "nuevo" && (
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            onClick={() => setEditando("nuevo")}
            className="transition-transform duration-150 active:scale-95"
          >
            <Plus className="size-3.5" />
            {t("programs.new")}
          </Button>
        </div>
      )}

      {editando === "nuevo" && (
        <Card>
          <CardContent className="pt-5">
            <Formulario alTerminar={() => setEditando(null)} />
          </CardContent>
        </Card>
      )}

      {academias.length === 0 ? (
        <Card>
          <CardContent className={VACIO.contenedor}>
            <span className={VACIO.icono}>
              <Presentation className="size-6" />
            </span>
            <p className={VACIO.titulo}>
              {hayFiltro ? t("programs.noMatches") : t("programs.empty")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {academias.map((fila) => (
            <Card key={fila.id} className={cn("group", TARJETA.contenido)}>
              <CardContent className="pt-5">
                {editando === fila.id ? (
                  <Formulario
                    academia={fila}
                    alTerminar={() => setEditando(null)}
                  />
                ) : (
                  <Ficha
                    fila={fila}
                    puedeEscribir={puedeEscribir}
                    alEditar={() => setEditando(fila.id)}
                  />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/** Un programa: qué es, quién lo da, cuándo y qué cuelga de él. */
function Ficha({
  fila,
  puedeEscribir,
  alEditar,
}: {
  fila: AcademiaFila;
  puedeEscribir: boolean;
  alEditar: () => void;
}) {
  const t = useTranslations("academies");

  const Icono = ICONO[fila.tipo as keyof typeof ICONO] ?? Layers;
  const activa = fila.estado === "activa";

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-150 group-hover:scale-110",
            activa
              ? CUADRO.marca
              : fila.estado === "planificada"
                ? CUADRO.suave
                : CUADRO.neutro,
          )}
        >
          <Icono className="size-4" />
        </span>

        <div className="min-w-0 flex-1">
          {/* `break-words` y no `truncate`: el nombre del programa es lo que se
              viene a leer, y cortarlo obliga a abrirlo para saber cuál es. */}
          <p className="text-sm font-semibold break-words">{fila.nombre}</p>
          <p className="text-muted-foreground text-xs">
            {t(`type.${fila.tipo}` as never)}
          </p>
        </div>

        <Badge
          className={cn(
            "shrink-0 text-[10px]",
            activa
              ? "bg-[#2096BA]/15 text-[#187a99]"
              : fila.estado === "planificada"
                ? "bg-[#2096BA]/10 text-[#2096BA]"
                : "bg-muted text-tinta-2",
          )}
        >
          {t(`state.${fila.estado}` as never)}
        </Badge>

        {puedeEscribir && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={alEditar}
            title={t("programs.edit")}
            aria-label={t("programs.edit")}
            className="size-8 shrink-0"
          >
            <Pencil className="size-3.5" />
          </Button>
        )}
      </div>

      {fila.descripcion && (
        <p className="text-muted-foreground text-xs leading-relaxed">
          {fila.descripcion}
        </p>
      )}

      <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-xs">
        {fila.facilitador && (
          <span className="inline-flex items-center gap-1">
            <UserRound className="size-3 shrink-0" />
            {fila.facilitador}
          </span>
        )}

        {(fila.fecha_inicio || fila.fecha_fin) && (
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-3 shrink-0" />
            {fila.fecha_inicio ?? "—"} → {fila.fecha_fin ?? "—"}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2">
        <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
          <Users className="size-3 shrink-0" />
          {t("programs.participants", { count: fila.participantes })}
        </span>

        <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
          <Library className="size-3 shrink-0" />
          {t("programs.materials", { count: fila.materiales })}
        </span>

        {puedeEscribir && <DialogoBorrado fila={fila} />}
      </div>
    </div>
  );
}

/**
 * Borrado con confirmación, y con la lista de lo que se perdería.
 *
 * Si el programa tiene materiales, la acción responde `tiene_materiales` y el
 * diálogo CAMBIA DE CARA en vez de cerrarse: enseña cuántos hay y propone
 * marcarlo `inactiva`, que es lo que se quiere casi siempre —un programa que
 * terminó, con su material archivado—.
 */
function DialogoBorrado({ fila }: { fila: AcademiaFila }) {
  const t = useTranslations("academies");
  const [abierto, setAbierto] = useState(false);
  const [estado, enviar, enviando] = useActionState<EstadoAcademias, FormData>(
    async (previo, datos) => {
      const resultado = await eliminarAcademia(previo, datos);
      if (resultado.estado === "ok") setAbierto(false);
      return resultado;
    },
    { estado: "inicial" },
  );

  const enUso = estado.estado === "tiene_materiales";

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setAbierto(true)}
        className="transition-transform duration-150 active:scale-95"
      >
        <Trash2 className="size-3.5" />
        {t("programs.delete")}
      </Button>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {enUso
                ? t("programs.inUseTitle", { name: fila.nombre })
                : t("programs.confirmTitle", { name: fila.nombre })}
            </DialogTitle>
            <DialogDescription>
              {enUso
                ? t("programs.inUseHint", { count: estado.materiales ?? 0 })
                : t("programs.deleteWarning")}
            </DialogDescription>
          </DialogHeader>

          {estado.estado !== "inicial" &&
            estado.estado !== "ok" &&
            !enUso && (
              <p role="alert" className={ALERTA_RIESGO.contenedor}>
                <AlertCircle className={ALERTA_RIESGO.icono} />
                <span className={ALERTA_RIESGO.texto}>{t("form.error")}</span>
              </p>
            )}

          <DialogFooter>
            {enUso ? (
              <Button type="button" onClick={() => setAbierto(false)}>
                {t("programs.understood")}
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setAbierto(false)}
                >
                  {t("form.cancel")}
                </Button>

                <form action={enviar}>
                  <input type="hidden" name="id" value={fila.id} />
                  <Button
                    type="submit"
                    variant="destructive"
                    disabled={enviando}
                  >
                    {enviando ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                    {enviando
                      ? t("programs.deleting")
                      : t("programs.delete")}
                  </Button>
                </form>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Alta y edición. Sin `academia`, es un alta. */
function Formulario({
  academia,
  alTerminar,
}: {
  academia?: AcademiaFila;
  alTerminar: () => void;
}) {
  const t = useTranslations("academies");
  const [estado, enviar, enviando] = useActionState<EstadoAcademias, FormData>(
    async (previo, datos) => {
      const resultado = await guardarAcademia(previo, datos);
      if (resultado.estado === "ok") alTerminar();
      return resultado;
    },
    { estado: "inicial" },
  );

  const clave = academia?.id ?? "nuevo";

  return (
    <form action={enviar} className="space-y-3">
      <div>
        <p className="text-sm font-semibold">
          {academia ? t("programs.editTitle") : t("programs.newTitle")}
        </p>
      </div>

      <input type="hidden" name="id" value={academia?.id ?? ""} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`a-nombre-${clave}`}>{t("field.name")}</Label>
          <Input
            id={`a-nombre-${clave}`}
            name="nombre"
            defaultValue={academia?.nombre}
            required
            maxLength={160}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`a-tipo-${clave}`}>{t("field.type")}</Label>
          <select
            id={`a-tipo-${clave}`}
            name="tipo"
            defaultValue={academia?.tipo ?? "liderazgo"}
            className={SELECT}
          >
            {TIPOS_ACADEMIA.map((valor) => (
              <option key={valor} value={valor}>
                {t(`type.${valor}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`a-estado-${clave}`}>{t("field.state")}</Label>
          <select
            id={`a-estado-${clave}`}
            name="estado"
            defaultValue={academia?.estado ?? "activa"}
            className={SELECT}
          >
            {ESTADOS_ACADEMIA.map((valor) => (
              <option key={valor} value={valor}>
                {t(`state.${valor}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`a-facilitador-${clave}`}>
            {t("field.facilitator")}
          </Label>
          <Input
            id={`a-facilitador-${clave}`}
            name="facilitador"
            defaultValue={academia?.facilitador ?? ""}
            maxLength={160}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`a-participantes-${clave}`}>
            {t("field.participants")}
          </Label>
          <Input
            id={`a-participantes-${clave}`}
            name="participantes"
            type="number"
            min={0}
            step={1}
            defaultValue={academia?.participantes ?? 0}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`a-inicio-${clave}`}>{t("field.start")}</Label>
          <Input
            id={`a-inicio-${clave}`}
            name="fecha_inicio"
            type="date"
            defaultValue={academia?.fecha_inicio ?? ""}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`a-fin-${clave}`}>{t("field.end")}</Label>
          <Input
            id={`a-fin-${clave}`}
            name="fecha_fin"
            type="date"
            defaultValue={academia?.fecha_fin ?? ""}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`a-desc-${clave}`}>{t("field.description")}</Label>
        <Textarea
          id={`a-desc-${clave}`}
          name="descripcion"
          defaultValue={academia?.descripcion ?? ""}
          maxLength={900}
          rows={2}
        />
      </div>

      {estado.estado !== "inicial" && estado.estado !== "ok" && (
        <p role="alert" className={ALERTA_RIESGO.contenedor}>
          <AlertCircle className={ALERTA_RIESGO.icono} />
          <span className={ALERTA_RIESGO.texto}>
            {estado.estado === "nombre_vacio"
              ? t("form.nameRequired")
              : estado.estado === "fechas_incoherentes"
                ? t("form.datesInvalid")
                : estado.estado === "participantes_invalido"
                  ? t("form.participantsInvalid")
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
            ? academia
              ? t("form.saving")
              : t("form.creating")
            : academia
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
