"use client";

import { useActionState, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  ChevronRight,
  ListTodo,
  Loader2,
  Pencil,
  Plus,
  Save,
  User,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { KanbanBase } from "@/components/operaciones/kanban-base";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AccionesFormulario,
  FormularioGuiado,
  PasoFormulario,
} from "@/components/ui/formulario-guiado";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import type { Locale } from "@/i18n/routing";
import { COLUMNAS_PROYECTO, visualPrioridad } from "@/lib/estados-trabajo";
import { fechaCorta } from "@/lib/fechas";
import { ALERTA_RIESGO } from "@/lib/paleta";
import { cn } from "@/lib/utils";
import {
  type EstadoOperaciones,
  guardarActividad,
  moverActividad,
} from "@/server/operaciones/acciones";
import type {
  ActividadProyecto,
  OpcionOperaciones,
} from "@/server/operaciones/consultas";

const SELECT =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-card px-2 text-base shadow-xs outline-none focus-visible:ring-[3px] sm:text-sm";

/**
 * Las actividades de un proyecto en Kanban por estado. Cada actividad tiene sus
 * fechas, su responsable y sus tareas; sus fechas salen en el calendario.
 * Arrastrar cambia el estado; crear y editar piden `operaciones.escribir`.
 */
export function ActividadesProyecto({
  proyectoId,
  actividades,
  personas,
  puedeEscribir,
}: {
  proyectoId: string;
  actividades: readonly ActividadProyecto[];
  personas: readonly OpcionOperaciones[];
  puedeEscribir: boolean;
}) {
  const t = useTranslations("admin");
  // `"nueva"`, el id de una actividad o nada.
  const [editando, setEditando] = useState<string | null>(null);
  const editada = actividades.find((a) => a.id === editando);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="texto-titulo-seccion">{t("activities.title")}</h2>
        {puedeEscribir && (
          <Button type="button" size="sm" onClick={() => setEditando("nueva")}>
            <Plus className="size-4" />
            {t("activities.new")}
          </Button>
        )}
      </div>

      <KanbanBase
        columnas={COLUMNAS_PROYECTO}
        etiquetaColumna={(c) => t(`projectStatus.${c}` as never)}
        items={actividades}
        idDe={(a) => a.id}
        estadoDe={(a) => a.estado}
        puedeMover={() => puedeEscribir}
        alMover={async (id, destino) => {
          const datos = new FormData();
          datos.set("id", id);
          datos.set("estado", destino);
          return (await moverActividad({ estado: "inicial" }, datos)).estado === "ok";
        }}
        vacio={t("activities.empty")}
        errorMover={t("activities.moveError")}
        tarjeta={(actividad, { siguiente, empujar, puedeMover }) => (
          <Tarjeta
            actividad={actividad}
            puedeEscribir={puedeEscribir}
            alEditar={() => setEditando(actividad.id)}
            siguiente={puedeMover ? siguiente : null}
            alEmpujar={empujar}
          />
        )}
      />

      <Dialog open={editando !== null} onOpenChange={(abierto) => !abierto && setEditando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editada ? t("activities.editTitle") : t("activities.newTitle")}
            </DialogTitle>
          </DialogHeader>
          {editando !== null && (
            <FormularioActividad
              proyectoId={proyectoId}
              actividad={editada}
              personas={personas}
              alTerminar={() => setEditando(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function Tarjeta({
  actividad,
  puedeEscribir,
  alEditar,
  siguiente,
  alEmpujar,
}: {
  actividad: ActividadProyecto;
  puedeEscribir: boolean;
  alEditar: () => void;
  siguiente: string | null;
  alEmpujar: () => void;
}) {
  const t = useTranslations("admin");
  const idioma = useLocale() as Locale;
  const prioridad = visualPrioridad(actividad.prioridad);
  const IconoPrioridad = prioridad.icono;
  const avance =
    actividad.tareas > 0 ? Math.round((actividad.hechas / actividad.tareas) * 100) : null;

  return (
    <div
      className={cn(
        "space-y-2.5 rounded-card border border-l-4 border-linea bg-card p-3 shadow-card transition-shadow hover:shadow-elevada hover:border-linea-fuerte",
        prioridad.barra,
      )}
    >
      <div className="flex items-start gap-1.5">
        <p className="min-w-0 flex-1 text-sm font-semibold text-tinta">{actividad.nombre}</p>

        <span
          className={cn(
            "inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5",
            prioridad.suave,
            prioridad.texto,
          )}
          title={t(`priority.${actividad.prioridad}` as never)}
        >
          <IconoPrioridad className="size-3.5" aria-hidden />
          <span className="sr-only">{t(`priority.${actividad.prioridad}` as never)}</span>
        </span>

        {puedeEscribir && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={alEditar}
            title={t("activities.edit")}
            aria-label={t("activities.edit")}
            className="shrink-0"
          >
            <Pencil className="size-3.5" />
          </Button>
        )}

        {siguiente && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={alEmpujar}
            title={t(`projectStatus.${siguiente}` as never)}
            aria-label={t(`projectStatus.${siguiente}` as never)}
            className="shrink-0"
          >
            <ChevronRight className="size-3.5" />
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-tinta-2">
        {actividad.responsable && (
          <span className="inline-flex items-center gap-1">
            <User className="size-3 shrink-0" />
            {actividad.responsable}
          </span>
        )}

        {(actividad.fecha_inicio || actividad.fecha_fin) && (
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-3 shrink-0" />
            {fechaCorta(actividad.fecha_inicio, idioma)} — {fechaCorta(actividad.fecha_fin, idioma)}
          </span>
        )}
      </div>

      <div className="space-y-1">
        <span className="inline-flex items-center gap-1 text-xs text-tinta-2">
          <ListTodo className="size-3 shrink-0" />
          {actividad.tareas === 0
            ? t("project.noTasks")
            : t("project.tasksDone", { done: actividad.hechas, total: actividad.tareas })}
        </span>
        <Progress value={avance ?? 0} />
      </div>
    </div>
  );
}

function FormularioActividad({
  proyectoId,
  actividad,
  personas,
  alTerminar,
}: {
  proyectoId: string;
  actividad?: ActividadProyecto;
  personas: readonly OpcionOperaciones[];
  alTerminar: () => void;
}) {
  const t = useTranslations("admin");
  const [estado, enviar, enviando] = useActionState<EstadoOperaciones, FormData>(
    async (previo, datos) => {
      const resultado = await guardarActividad(previo, datos);
      if (resultado.estado === "ok") alTerminar();
      return resultado;
    },
    { estado: "inicial" },
  );

  const clave = actividad?.id ?? "nueva";

  return (
    <form action={enviar} className="space-y-3">
      <input type="hidden" name="id" value={actividad?.id ?? ""} />
      <input type="hidden" name="proyecto" value={proyectoId} />

      <FormularioGuiado>
        <PasoFormulario titulo={t("pasos.proyecto")}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor={`a-nombre-${clave}`}>{t("activities.name")}</Label>
              <Input
                id={`a-nombre-${clave}`}
                name="nombre"
                defaultValue={actividad?.nombre}
                placeholder={t("activities.namePlaceholder")}
                required
                maxLength={160}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`a-estado-${clave}`}>{t("project.status")}</Label>
              <select
                id={`a-estado-${clave}`}
                name="estado"
                defaultValue={actividad?.estado ?? "planificacion"}
                className={SELECT}
              >
                {COLUMNAS_PROYECTO.map((valor) => (
                  <option key={valor} value={valor}>
                    {t(`projectStatus.${valor}`)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`a-prioridad-${clave}`}>{t("task.priority")}</Label>
              <select
                id={`a-prioridad-${clave}`}
                name="prioridad"
                defaultValue={actividad?.prioridad ?? "media"}
                className={SELECT}
              >
                {(["baja", "media", "alta", "urgente"] as const).map((valor) => (
                  <option key={valor} value={valor}>
                    {t(`priority.${valor}`)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor={`a-resp-${clave}`}>{t("activities.lead")}</Label>
              <select
                id={`a-resp-${clave}`}
                name="responsable"
                defaultValue={actividad?.responsable_id ?? ""}
                className={SELECT}
              >
                <option value="">{t("activities.noLead")}</option>
                {personas.map((persona) => (
                  <option key={persona.id} value={persona.id}>
                    {persona.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </PasoFormulario>

        <PasoFormulario titulo={t("pasos.fechas")}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`a-inicio-${clave}`}>{t("project.start")}</Label>
              <Input
                id={`a-inicio-${clave}`}
                name="inicio"
                type="date"
                defaultValue={actividad?.fecha_inicio ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`a-fin-${clave}`}>{t("project.end")}</Label>
              <Input
                id={`a-fin-${clave}`}
                name="fin"
                type="date"
                defaultValue={actividad?.fecha_fin ?? ""}
              />
            </div>
          </div>
        </PasoFormulario>

        {estado.estado !== "inicial" && estado.estado !== "ok" && (
          <p role="alert" className={ALERTA_RIESGO.contenedor}>
            <AlertCircle className={ALERTA_RIESGO.icono} />
            <span className={ALERTA_RIESGO.texto}>
              {estado.estado === "nombre_vacio"
                ? t("activities.nameRequired")
                : estado.estado === "fin_antes_de_inicio"
                  ? t("editProject.endBeforeStart")
                  : t("activities.error")}
            </span>
          </p>
        )}

        <AccionesFormulario>
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" cargando={enviando}>
              {enviando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {actividad
                ? enviando
                  ? t("editProject.saving")
                  : t("editProject.save")
                : enviando
                  ? t("newProject.creating")
                  : t("activities.create")}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={alTerminar}>
              {t("newTask.cancel")}
            </Button>
          </div>
        </AccionesFormulario>
      </FormularioGuiado>
    </form>
  );
}
