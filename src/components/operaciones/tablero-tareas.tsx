"use client";

import { useActionState, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  ChevronRight,
  FolderOpen,
  Loader2,
  Plus,
  Save,
  Search,
  Users,
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
import { Textarea } from "@/components/ui/textarea";
import type { Locale } from "@/i18n/routing";
import { visualPrioridad } from "@/lib/estados-trabajo";
import { fechaCorta } from "@/lib/fechas";
import { COLUMNAS } from "@/lib/operaciones";
import { ALERTA_RIESGO, ANIMACION } from "@/lib/paleta";
import { cn } from "@/lib/utils";
import {
  crearTarea,
  type EstadoOperaciones,
  moverTarea,
} from "@/server/operaciones/acciones";
import type {
  OpcionActividad,
  OpcionOperaciones,
  TareaTablero,
} from "@/server/operaciones/consultas";

/** Clase del desplegable nativo, la misma del resto del proyecto. */
const SELECT =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-card px-2 text-base shadow-xs outline-none focus-visible:ring-[3px] sm:text-sm";

type Alcance = "abiertas" | "vencidas" | "hoy" | "semana" | "todas";
const ALCANCES: readonly Alcance[] = ["abiertas", "vencidas", "hoy", "semana", "todas"];
const CERRADA = ["completada", "cancelada"];
const CLAVE_ALCANCE: Record<Alcance, string> = { abiertas: "Open", vencidas: "Overdue", hoy: "Today", semana: "Week", todas: "All" };

/**
 * «Mis tareas»: Kanban de lo que tengo asignado, con el color del estado en la
 * columna y el de la prioridad en cada tarjeta. Cada tarjeta dice a qué
 * proyecto y actividad pertenece, y la fecha límite es la misma que ve el
 * calendario. Hoy / Esta semana / Todas es la planificación del día.
 *
 * Las gráficas no van aquí: viven en los reportes y el dashboard.
 *
 * Con `soloMias` todas las tarjetas son mías y se pueden mover aunque el rol
 * no tenga `operaciones.escribir` (la acción lo comprueba en el servidor);
 * crear tareas sí exige `puedeEscribir`.
 */
export function TableroTareas({
  tareas,
  proyectos,
  actividades,
  personas,
  puedeEscribir,
  soloMias = false,
}: {
  tareas: readonly TareaTablero[];
  proyectos: readonly OpcionOperaciones[];
  actividades: readonly OpcionActividad[];
  personas: readonly OpcionOperaciones[];
  puedeEscribir: boolean;
  soloMias?: boolean;
}) {
  const t = useTranslations("admin");
  const [nueva, setNueva] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  // «Abiertas» (vencidas + hoy + próximas) es lo que toca: arrancar en «Hoy» escondía lo vencido.
  const [alcance, setAlcance] = useState<Alcance>("abiertas");

  const texto = busqueda.trim().toLowerCase();
  const cuadra = (tarea: TareaTablero, a: Alcance) => {
    const abierta = !CERRADA.includes(tarea.estado);

    if (a === "abiertas") return abierta;
    if (a === "vencidas") return tarea.vencida;
    if (a === "hoy") return tarea.es_hoy || tarea.vencida;
    if (a === "semana") return tarea.esta_semana || tarea.vencida;

    return true;
  };
  const porVencimiento = (a: TareaTablero, b: TareaTablero) =>
    (a.fecha_limite ?? "9999-12-31").localeCompare(b.fecha_limite ?? "9999-12-31");
  const visibles = tareas
    .filter((tarea) => {
      if (!cuadra(tarea, alcance)) return false;
      if (texto.length === 0) return true;
      return (
        tarea.titulo.toLowerCase().includes(texto) ||
        (tarea.proyecto?.toLowerCase().includes(texto) ?? false) ||
        (tarea.actividad?.toLowerCase().includes(texto) ?? false)
      );
    })
    .sort(porVencimiento);

  const conteo = (a: Alcance) => tareas.filter((tarea) => cuadra(tarea, a)).length;
  const vencidas = conteo("vencidas");

  return (
    <div className={cn("space-y-4", ANIMACION.entrada)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-48 flex-1 sm:max-w-64">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-tinta-3" />
            <Input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder={t("board.searchPlaceholder")}
              className="h-9 pl-8 text-sm"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {ALCANCES.filter((a) => a !== "vencidas" || vencidas > 0).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAlcance(a)}
                aria-pressed={alcance === a}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors",
                  a === "vencidas"
                    ? cn(alcance === a ? "border-status-danger-border bg-status-danger text-white" : "border-status-danger-border/40 bg-status-danger/10 text-status-danger-fg")
                    : alcance === a
                      ? "border-marca-500 bg-marca-50 text-marca-700"
                      : "border-linea bg-card text-tinta-2 hover:bg-muted/50",
                )}
              >
                {t(`board.scope${CLAVE_ALCANCE[a]}`)}
                <span className="tabular-nums opacity-75">{conteo(a)}</span>
              </button>
            ))}
          </div>
        </div>

        {puedeEscribir && (
          <Button type="button" size="sm" onClick={() => setNueva(true)}>
            <Plus className="size-4" />
            {t("tasks.new")}
          </Button>
        )}
      </div>

      <KanbanBase
        columnas={COLUMNAS}
        etiquetaColumna={(c) => t(`taskStatus.${c}` as never)}
        items={visibles}
        idDe={(tarea) => tarea.id}
        estadoDe={(tarea) => tarea.estado}
        puedeMover={() => puedeEscribir || soloMias}
        alMover={async (id, destino) => {
          const datos = new FormData();
          datos.set("id", id);
          datos.set("estado", destino);
          return (await moverTarea({ estado: "inicial" }, datos)).estado === "ok";
        }}
        vacio={t("board.empty")}
        errorMover={t("board.moveError")}
        tarjeta={(tarea, { siguiente, empujar, puedeMover }) => (
          <Tarjeta
            tarea={tarea}
            mostrarAsignados={!soloMias}
            siguiente={puedeMover ? siguiente : null}
            alEmpujar={empujar}
          />
        )}
      />

      <Dialog open={nueva} onOpenChange={setNueva}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("newTask.title")}</DialogTitle>
          </DialogHeader>
          {nueva && (
            <FormularioTarea
              proyectos={proyectos}
              actividades={actividades}
              personas={personas}
              alTerminar={() => setNueva(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Una tarea: la barra izquierda y el icono dicen su prioridad. */
function Tarjeta({
  tarea,
  mostrarAsignados,
  siguiente,
  alEmpujar,
}: {
  tarea: TareaTablero;
  mostrarAsignados: boolean;
  siguiente: string | null;
  alEmpujar: () => void;
}) {
  const t = useTranslations("admin");
  const idioma = useLocale() as Locale;
  const prioridad = visualPrioridad(tarea.prioridad);
  const IconoPrioridad = prioridad.icono;

  return (
    <div
      className={cn(
        "group rounded-card border border-l-4 border-linea bg-card p-3 shadow-card transition-shadow hover:shadow-elevada",
        prioridad.barra,
      )}
    >
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 text-sm leading-snug font-medium text-tinta">
          {tarea.titulo}
        </p>

        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
            prioridad.suave,
            prioridad.texto,
          )}
          title={t(`priority.${tarea.prioridad}` as never)}
        >
          <IconoPrioridad className="size-3.5" aria-hidden />
          <span className="sr-only">{t(`priority.${tarea.prioridad}` as never)}</span>
        </span>

        {siguiente && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={alEmpujar}
            title={t(`taskStatus.${siguiente}` as never)}
            aria-label={t(`taskStatus.${siguiente}` as never)}
            className="size-7 shrink-0"
          >
            <ChevronRight className="size-3.5" />
          </Button>
        )}
      </div>

      <div className="mt-2 flex flex-col gap-1 text-xs text-tinta-2">
        <span className="inline-flex min-w-0 items-center gap-1">
          <FolderOpen className="size-3 shrink-0" />
          <span className="truncate">
            {tarea.proyecto ?? t("board.noProject")}
            {tarea.actividad ? ` › ${tarea.actividad}` : ""}
          </span>
        </span>

        {tarea.fecha_limite && (
          <span
            className={cn(
              "inline-flex items-center gap-1",
              tarea.vencida && "font-semibold text-status-danger-fg",
            )}
          >
            {tarea.vencida ? (
              <AlertCircle className="size-3 shrink-0" />
            ) : (
              <CalendarDays className="size-3 shrink-0" />
            )}
            {fechaCorta(tarea.fecha_limite, idioma)}
          </span>
        )}

        {mostrarAsignados && tarea.asignados && (
          <span className="inline-flex min-w-0 items-center gap-1">
            <Users className="size-3 shrink-0" />
            <span className="truncate">{tarea.asignados}</span>
          </span>
        )}
      </div>

    </div>
  );
}

/** Alta de una tarea, con sus asignados. */
function FormularioTarea({
  proyectos,
  actividades,
  personas,
  alTerminar,
}: {
  proyectos: readonly OpcionOperaciones[];
  actividades: readonly OpcionActividad[];
  personas: readonly OpcionOperaciones[];
  alTerminar: () => void;
}) {
  const t = useTranslations("admin");
  const [estado, enviar, enviando] = useActionState<EstadoOperaciones, FormData>(
    async (previo, datos) => {
      const resultado = await crearTarea(previo, datos);
      if (resultado.estado === "ok") alTerminar();
      return resultado;
    },
    { estado: "inicial" },
  );

  return (
    <form action={enviar} className="space-y-3">
      <FormularioGuiado>
        <PasoFormulario titulo={t("pasos.tarea")}>
          <div className="space-y-1.5">
            <Label htmlFor="t-titulo">{t("task.title")}</Label>
            <Input
              id="t-titulo"
              name="titulo"
              placeholder={t("task.titlePlaceholder")}
              required
              maxLength={160}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="t-desc">{t("task.description")}</Label>
            <Textarea id="t-desc" name="descripcion" maxLength={900} rows={2} />
          </div>
        </PasoFormulario>

        <PasoFormulario titulo={t("pasos.plan")}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="t-proyecto">{t("task.project")}</Label>
              <select id="t-proyecto" name="proyecto" className={SELECT}>
                <option value="">{t("board.noProject")}</option>
                {proyectos.map((proyecto) => (
                  <option key={proyecto.id} value={proyecto.id}>
                    {proyecto.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="t-actividad">{t("task.activity")}</Label>
              <select id="t-actividad" name="actividad" className={SELECT}>
                <option value="">{t("activities.none")}</option>
                {actividades.map((actividad) => (
                  <option key={actividad.id} value={actividad.id}>
                    {actividad.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="t-prioridad">{t("task.priority")}</Label>
              <select
                id="t-prioridad"
                name="prioridad"
                defaultValue="media"
                className={SELECT}
              >
                {(["baja", "media", "alta", "urgente"] as const).map((valor) => (
                  <option key={valor} value={valor}>
                    {t(`priority.${valor}`)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="t-limite">{t("task.dueDate")}</Label>
              <Input id="t-limite" name="limite" type="date" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="t-visibilidad">{t("task.visibility")}</Label>
              <select
                id="t-visibilidad"
                name="visibilidad"
                defaultValue="asignados"
                className={SELECT}
              >
                <option value="asignados">{t("visibility.asignados")}</option>
                <option value="todos">{t("visibility.todos")}</option>
              </select>
            </div>
          </div>
        </PasoFormulario>

        <PasoFormulario titulo={t("pasos.responsables")}>
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">{t("task.assignees")}</legend>

            {/* Casillas nativas: mandan varios `asignado` en el mismo envío sin una
                línea de JavaScript, y el servidor los lee con `getAll`. */}
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {personas.map((persona) => (
                <label
                  key={persona.id}
                  className="flex cursor-pointer items-center gap-1.5 text-xs"
                >
                  <input
                    type="checkbox"
                    name="asignado"
                    value={persona.id}
                    className="size-3.5 accent-marca-500"
                  />
                  <span className="truncate">{persona.nombre}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </PasoFormulario>

        {estado.estado !== "inicial" && estado.estado !== "ok" && (
          <p role="alert" className={ALERTA_RIESGO.contenedor}>
            <AlertCircle className={ALERTA_RIESGO.icono} />
            <span className={ALERTA_RIESGO.texto}>
              {estado.estado === "titulo_vacio"
                ? t("newTask.titleRequired")
                : t("newTask.error")}
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
              {enviando ? t("newTask.creating") : t("newTask.create")}
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
