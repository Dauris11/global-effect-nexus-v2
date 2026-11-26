"use client";

import { useActionState, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  ChevronRight,
  FolderOpen,
  ListTodo,
  Loader2,
  Pencil,
  Plus,
  Save,
  Search,
  User,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { KanbanBase } from "@/components/operaciones/kanban-base";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { COLUMNAS_PROYECTO } from "@/lib/estados-trabajo";
import { fechaCorta } from "@/lib/fechas";
import { ALERTA_RIESGO, ANIMACION, VACIO } from "@/lib/paleta";
import { cn } from "@/lib/utils";
import {
  type EstadoOperaciones,
  guardarProyecto,
  moverProyecto,
} from "@/server/operaciones/acciones";
import type { ProyectoConAvance } from "@/server/operaciones/consultas";

/** Clase del desplegable nativo, la misma del resto del proyecto. */
const SELECT =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-card px-2 text-base shadow-xs outline-none focus-visible:ring-[3px] sm:text-sm";

/**
 * Proyectos como Kanban por estado (planificación, en curso, pausado,
 * completado). Arrastrar una tarjeta cambia el estado del proyecto.
 *
 * EL AVANCE NO SE ESCRIBE, SE CUENTA: tareas completadas sobre tareas vivas
 * (`proyectosConAvance`). Un proyecto sin tareas no sale al 0 % sino con «Sin
 * tareas». Las cifras y gráficas de proyectos viven en los reportes y el
 * dashboard, no aquí.
 *
 * No hay botón de borrar: `tarea.proyecto_id` es ON DELETE SET NULL y borrar
 * dejaría tareas sueltas. Para retirar una iniciativa está `pausado` o
 * `completado`.
 */
export function GestionProyectos({
  proyectos,
  puedeEscribir,
}: {
  proyectos: readonly ProyectoConAvance[];
  puedeEscribir: boolean;
}) {
  const t = useTranslations("admin");
  // `"nuevo"`, el id de un proyecto o nada: el formulario va en un diálogo
  // porque una columna de Kanban es demasiado estrecha para él.
  const [editando, setEditando] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");

  const texto = busqueda.trim().toLowerCase();
  const visibles = proyectos.filter((p) => {
    if (texto.length === 0) return true;
    return (
      p.nombre.toLowerCase().includes(texto) ||
      (p.responsable?.toLowerCase().includes(texto) ?? false)
    );
  });

  const proyectoEditado = proyectos.find((p) => p.id === editando);

  return (
    <div className={cn("space-y-4", ANIMACION.entrada)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-48 flex-1 sm:max-w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-tinta-3" />
          <Input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder={t("projects.searchPlaceholder")}
            className="h-9 pl-8 text-sm"
          />
        </div>

        {puedeEscribir && (
          <Button type="button" size="sm" onClick={() => setEditando("nuevo")}>
            <Plus className="size-4" />
            {t("projects.new")}
          </Button>
        )}
      </div>

      {proyectos.length === 0 ? (
        <Card>
          <CardContent className={VACIO.contenedor}>
            <span className={VACIO.icono}>
              <FolderOpen className="size-6" />
            </span>
            <p className={VACIO.titulo}>{t("projects.empty")}</p>
          </CardContent>
        </Card>
      ) : (
        <KanbanBase
          columnas={COLUMNAS_PROYECTO}
          etiquetaColumna={(c) => t(`projectStatus.${c}` as never)}
          items={visibles}
          idDe={(p) => p.id}
          estadoDe={(p) => p.estado}
          puedeMover={() => puedeEscribir}
          alMover={async (id, destino) => {
            const datos = new FormData();
            datos.set("id", id);
            datos.set("estado", destino);
            return (await moverProyecto({ estado: "inicial" }, datos)).estado === "ok";
          }}
          vacio={t("projects.emptyFiltered")}
          errorMover={t("projects.moveError")}
          tarjeta={(proyecto, { siguiente, empujar, puedeMover }) => (
            <Tarjeta
              proyecto={proyecto}
              puedeEscribir={puedeEscribir}
              alEditar={() => setEditando(proyecto.id)}
              siguiente={puedeMover ? siguiente : null}
              alEmpujar={empujar}
            />
          )}
        />
      )}

      <Dialog open={editando !== null} onOpenChange={(abierto) => !abierto && setEditando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {proyectoEditado ? t("editProject.title") : t("newProject.title")}
            </DialogTitle>
          </DialogHeader>
          {editando !== null && (
            <FormularioProyecto
              proyecto={proyectoEditado}
              alTerminar={() => setEditando(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Un proyecto: quién lo lleva, cuándo va y cuánto lleva hecho. */
function Tarjeta({
  proyecto,
  puedeEscribir,
  alEditar,
  siguiente,
  alEmpujar,
}: {
  proyecto: ProyectoConAvance;
  puedeEscribir: boolean;
  alEditar: () => void;
  siguiente: string | null;
  alEmpujar: () => void;
}) {
  const t = useTranslations("admin");
  const idioma = useLocale() as Locale;

  // Sin tareas no hay avance que calcular: `null` y 0 se dicen distinto.
  const avance =
    proyecto.tareas > 0 ? Math.round((proyecto.hechas / proyecto.tareas) * 100) : null;

  return (
    <div className="group space-y-2.5 rounded-card border border-linea bg-card p-3 shadow-card transition-shadow hover:shadow-elevada">
      <div className="flex items-start gap-1.5">
        <Link
          href={`/administrativo/proyectos/${proyecto.id}`}
          className="min-w-0 flex-1 text-sm font-semibold text-tinta hover:text-marca-600"
        >
          {proyecto.nombre}
        </Link>

        {puedeEscribir && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={alEditar}
            title={t("editProject.edit")}
            aria-label={t("editProject.edit")}
            className="size-7 shrink-0"
          >
            <Pencil className="size-3.5" />
          </Button>
        )}

        {siguiente && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={alEmpujar}
            title={t(`projectStatus.${siguiente}` as never)}
            aria-label={t(`projectStatus.${siguiente}` as never)}
            className="size-7 shrink-0"
          >
            <ChevronRight className="size-3.5" />
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-tinta-2">
        {proyecto.responsable && (
          <span className="inline-flex items-center gap-1">
            <User className="size-3 shrink-0" />
            {proyecto.responsable}
          </span>
        )}

        {(proyecto.fecha_inicio || proyecto.fecha_fin) && (
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-3 shrink-0" />
            {fechaCorta(proyecto.fecha_inicio, idioma)} — {fechaCorta(proyecto.fecha_fin, idioma)}
          </span>
        )}
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="inline-flex items-center gap-1 text-tinta-2">
            <ListTodo className="size-3 shrink-0" />
            {proyecto.tareas === 0
              ? t("project.noTasks")
              : t("project.tasksDone", { done: proyecto.hechas, total: proyecto.tareas })}
          </span>

          {avance !== null && <b className="text-tinta tabular-nums">{avance}%</b>}
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
      <input type="hidden" name="id" value={proyecto?.id ?? ""} />

      <FormularioGuiado>
        <PasoFormulario titulo={t("pasos.proyecto")}>
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
        </PasoFormulario>

        <PasoFormulario titulo={t("pasos.fechas")}>
          <div className="grid gap-3 sm:grid-cols-2">
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
        </PasoFormulario>

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

        <AccionesFormulario>
          <div className="flex items-center gap-2">
            <Button
              type="submit"
              size="sm"
              cargando={enviando}
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
        </AccionesFormulario>
      </FormularioGuiado>
    </form>
  );
}
