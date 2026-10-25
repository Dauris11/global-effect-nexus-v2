"use client";

import { useActionState, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  FolderOpen,
  ListTodo,
  Loader2,
  Pencil,
  Plus,
  Save,
  User,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import type { Locale } from "@/i18n/routing";
import { fechaCorta } from "@/lib/fechas";
import { ALERTA_RIESGO, ANIMACION, clasesDeEstado, CUADRO, VACIO } from "@/lib/paleta";
import { cn } from "@/lib/utils";
import {
  type EstadoOperaciones,
  guardarProyecto,
} from "@/server/operaciones/acciones";
import type { ProyectoConAvance } from "@/server/operaciones/consultas";

/** Clase del desplegable nativo, la misma del resto del proyecto. */
const SELECT =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-card px-2 text-base shadow-xs outline-none focus-visible:ring-[3px] sm:text-sm";

/**
 * Proyectos y su avance.
 *
 * EL AVANCE NO SE ESCRIBE, SE CUENTA. `proyecto.progreso` existe en la tabla
 * desde la 0009 y esta pantalla no lo enseña ni deja tocarlo: es un número que
 * alguien pone a mano y que se queda viejo en cuanto el equipo cierra una
 * tarea. Lo que se pinta son las tareas completadas sobre las tareas vivas del
 * proyecto, que es exactamente lo que `newProject.progressHint` ya prometía
 * antes de que existiera la pantalla: "el avance se calcula solo".
 *
 * Un proyecto sin tareas no sale al 0% sino con "Sin tareas". No es lo mismo:
 * el 0% dice que se empezó y no se ha avanzado, y la barra vacía en una lista
 * de proyectos recién creados hace parecer que el equipo está parado.
 *
 * No hay botón de borrar, y es a propósito: `tarea.proyecto_id` es
 * ON DELETE SET NULL, así que borrar un proyecto deja sus tareas sueltas y sin
 * rastro de a qué pertenecían. Para retirar una iniciativa está el estado
 * `completado` o `pausado`, que es lo que la pantalla ofrece.
 */
export function GestionProyectos({
  proyectos,
  puedeEscribir,
}: {
  proyectos: readonly ProyectoConAvance[];
  puedeEscribir: boolean;
}) {
  const t = useTranslations("admin");
  const [editando, setEditando] = useState<string | null>(null);

  return (
    <div className={cn("space-y-4", ANIMACION.entrada)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          {t("projects.description")}
        </p>

        {puedeEscribir && editando !== "nuevo" && (
          <Button
            type="button"
            size="sm"
            onClick={() => setEditando("nuevo")}
            className="transition-transform duration-150 active:scale-95"
          >
            <Plus className="size-3.5" />
            {t("projects.new")}
          </Button>
        )}
      </div>

      {editando === "nuevo" && (
        <Card>
          <CardContent className="pt-5">
            <FormularioProyecto alTerminar={() => setEditando(null)} />
          </CardContent>
        </Card>
      )}

      {proyectos.length === 0 ? (
        <Card>
          <CardContent className={VACIO.contenedor}>
            <span className={VACIO.icono}>
              <FolderOpen className="size-6" />
            </span>
            <p className={VACIO.titulo}>{t("projects.empty")}</p>
            <p className={VACIO.descripcion}>{t("projects.emptyHint")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {proyectos.map((proyecto) => (
            <Card key={proyecto.id} className="group">
              <CardContent className="pt-5">
                {editando === proyecto.id ? (
                  <FormularioProyecto
                    proyecto={proyecto}
                    alTerminar={() => setEditando(null)}
                  />
                ) : (
                  <Tarjeta
                    proyecto={proyecto}
                    puedeEscribir={puedeEscribir}
                    alEditar={() => setEditando(proyecto.id)}
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

/** Un proyecto: quién lo lleva, cuándo va y cuánto lleva hecho. */
function Tarjeta({
  proyecto,
  puedeEscribir,
  alEditar,
}: {
  proyecto: ProyectoConAvance;
  puedeEscribir: boolean;
  alEditar: () => void;
}) {
  const t = useTranslations("admin");
  const idioma = useLocale() as Locale;

  // Sin tareas no hay avance que calcular. `null` y 0 son cosas distintas y la
  // pantalla las dice distinto.
  const avance =
    proyecto.tareas > 0
      ? Math.round((proyecto.hechas / proyecto.tareas) * 100)
      : null;

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-150 group-hover:scale-110",
            proyecto.estado === "en_curso" ? CUADRO.marca : CUADRO.neutro,
          )}
        >
          <FolderOpen className="size-4" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{proyecto.nombre}</p>

          {proyecto.descripcion && (
            <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
              {proyecto.descripcion}
            </p>
          )}
        </div>

        <Badge className={cn("shrink-0 text-[10px]", clasesDeEstado(proyecto.estado))}>
          {t(`projectStatus.${proyecto.estado}` as never)}
        </Badge>

        {puedeEscribir && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={alEditar}
            title={t("editProject.edit")}
            aria-label={t("editProject.edit")}
            className="size-8 shrink-0"
          >
            <Pencil className="size-3.5" />
          </Button>
        )}
      </div>

      <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-xs">
        {proyecto.responsable && (
          <span className="inline-flex items-center gap-1">
            <User className="size-3 shrink-0" />
            {proyecto.responsable}
          </span>
        )}

        {(proyecto.fecha_inicio || proyecto.fecha_fin) && (
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-3 shrink-0" />
            {fechaCorta(proyecto.fecha_inicio, idioma)} —{" "}
            {fechaCorta(proyecto.fecha_fin, idioma)}
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground inline-flex items-center gap-1">
            <ListTodo className="size-3 shrink-0" />
            {proyecto.tareas === 0
              ? t("project.noTasks")
              : t("project.tasksDone", {
                  done: proyecto.hechas,
                  total: proyecto.tareas,
                })}
          </span>

          {avance !== null && <b className="text-[#187a99]">{avance}%</b>}
        </div>

        <Progress value={avance ?? 0} />
      </div>
    </div>
  );
}

/** Alta y edición. Sin `proyecto`, es un alta. */
function FormularioProyecto({
  proyecto,
  alTerminar,
}: {
  proyecto?: ProyectoConAvance;
  alTerminar: () => void;
}) {
  const t = useTranslations("admin");
  const [estado, enviar, enviando] = useActionState<EstadoOperaciones, FormData>(
    async (previo, datos) => {
      const resultado = await guardarProyecto(previo, datos);
      if (resultado.estado === "ok") alTerminar();
      return resultado;
    },
    { estado: "inicial" },
  );

  const clave = proyecto?.id ?? "nuevo";

  return (
    <form action={enviar} className="space-y-3">
      <div>
        <p className="text-sm font-semibold">
          {proyecto ? t("editProject.title") : t("newProject.title")}
        </p>
        <p className="text-muted-foreground text-xs">
          {proyecto ? t("editProject.subtitle") : t("newProject.subtitle")}
        </p>
      </div>

      <input type="hidden" name="id" value={proyecto?.id ?? ""} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`p-nombre-${clave}`}>{t("project.name")}</Label>
          <Input
            id={`p-nombre-${clave}`}
            name="nombre"
            defaultValue={proyecto?.nombre}
            placeholder={t("newProject.namePlaceholder")}
            required
            maxLength={160}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`p-resp-${clave}`}>{t("project.lead")}</Label>
          <Input
            id={`p-resp-${clave}`}
            name="responsable"
            defaultValue={proyecto?.responsable ?? ""}
            maxLength={120}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`p-estado-${clave}`}>{t("project.status")}</Label>
          <select
            id={`p-estado-${clave}`}
            name="estado"
            defaultValue={proyecto?.estado ?? "planificacion"}
            className={SELECT}
          >
            {(
              ["planificacion", "en_curso", "pausado", "completado"] as const
            ).map((valor) => (
              <option key={valor} value={valor}>
                {t(`projectStatus.${valor}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`p-inicio-${clave}`}>{t("project.start")}</Label>
          <Input
            id={`p-inicio-${clave}`}
            name="inicio"
            type="date"
            defaultValue={proyecto?.fecha_inicio ?? ""}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`p-fin-${clave}`}>{t("project.end")}</Label>
          <Input
            id={`p-fin-${clave}`}
            name="fin"
            type="date"
            defaultValue={proyecto?.fecha_fin ?? ""}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`p-desc-${clave}`}>{t("project.description")}</Label>
        <Textarea
          id={`p-desc-${clave}`}
          name="descripcion"
          defaultValue={proyecto?.descripcion ?? ""}
          maxLength={900}
          rows={2}
        />
      </div>

      {/* El avance no es un campo: se cuenta desde las tareas. Se dice aquí
          para que nadie lo busque en el formulario. */}
      <p className="text-muted-foreground text-[11px]">
        {t("newProject.progressHint")}
      </p>

      {estado.estado !== "inicial" && estado.estado !== "ok" && (
        <p role="alert" className={ALERTA_RIESGO.contenedor}>
          <AlertCircle className={ALERTA_RIESGO.icono} />
          <span className={ALERTA_RIESGO.texto}>
            {estado.estado === "nombre_vacio"
              ? t("newProject.nameRequired")
              : estado.estado === "fin_antes_de_inicio"
                ? t("editProject.endBeforeStart")
                : t("newProject.error")}
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
            ? proyecto
              ? t("editProject.saving")
              : t("newProject.creating")
            : proyecto
              ? t("editProject.save")
              : t("newProject.create")}
        </Button>

        <Button type="button" variant="ghost" size="sm" onClick={alTerminar}>
          {t("newTask.cancel")}
        </Button>
      </div>
    </form>
  );
}
