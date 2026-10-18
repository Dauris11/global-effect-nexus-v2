"use client";

import { useState, useTransition } from "react";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  Flame,
  FolderOpen,
  Hourglass,
  ListTodo,
  Loader2,
  Plus,
  Receipt,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fechaCorta } from "@/lib/fechas";
import type {
  BitacoraEntrada,
  EstadoTareaColaborador,
  TareaColaborador,
} from "@/lib/torre-control";
import { cn } from "@/lib/utils";
import {
  cambiarEstadoTareaColaboradorAction,
  crearTareaRapidaColaboradorAction,
  registrarBitacoraDiariaAction,
} from "@/server/colaborador/acciones";

interface VistaHoyProps {
  tareasIniciales: TareaColaborador[];
  bitacoraInicial: BitacoraEntrada[];
  proyectosAsignados: { id: string; nombre: string; descripcion: string | null }[];
  resumen: {
    pendientes: number;
    enProgreso: number;
    completadasHoy: number;
    minutosHoy: number;
    rendicionesPendientes: number;
  };
}

const SELECT_CLASS =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-10 w-full rounded-md border bg-white px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]";

export function VistaHoy({
  tareasIniciales,
  bitacoraInicial,
  proyectosAsignados,
  resumen,
}: VistaHoyProps) {
  const t = useTranslations("colaborador");

  const [tareas, setTareas] = useState(tareasIniciales);
  const [filtro, setFiltro] = useState<"todas" | EstadoTareaColaborador>("todas");
  const [dialogoNuevaAbierto, setDialogoNuevaAbierto] = useState(false);
  const [dialogoBitacoraAbierto, setDialogoBitacoraAbierto] = useState(false);
  const [tareaSeleccionadaBitacora, setTareaSeleccionadaBitacora] = useState<string>("");

  const [isPending, startTransition] = useTransition();
  const [tareaActualizandoId, setTareaActualizandoId] = useState<string | null>(null);

  // Siguiente estado en el flujo operativo de avance
  const siguienteEstado = (actual: EstadoTareaColaborador): EstadoTareaColaborador => {
    switch (actual) {
      case "por_hacer":
        return "en_progreso";
      case "en_progreso":
        return "en_revision";
      case "en_revision":
        return "completada";
      case "completada":
        return "por_hacer";
    }
  };

  const avanzarEstado = (tarea: TareaColaborador) => {
    const proximo = siguienteEstado(tarea.estado);
    setTareaActualizandoId(tarea.id);

    // Optimista
    setTareas((prev) =>
      prev.map((item) =>
        item.id === tarea.id ? { ...item, estado: proximo } : item,
      ),
    );

    startTransition(async () => {
      const res = await cambiarEstadoTareaColaboradorAction(tarea.id, proximo);
      if (!res.ok) {
        // Revertir
        setTareas((prev) =>
          prev.map((item) =>
            item.id === tarea.id ? { ...item, estado: tarea.estado } : item,
          ),
        );
      }
      setTareaActualizandoId(null);
    });
  };

  const tareasFiltradas = tareas.filter((item) => {
    if (filtro === "todas") return true;
    return item.estado === filtro;
  });

  const formatearHoras = (minutos: number) => {
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    if (h === 0) return `${m} min`;
    return `${h}h ${m > 0 ? `${m}m` : ""}`;
  };

  return (
    <div className="space-y-6">
      {/* 1. Métrica Cards Táctiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="flex flex-col justify-between rounded-xl border border-linea-fuerte/40 bg-white p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-tinta/60 uppercase">
              {t("pendingTasks")}
            </span>
            <ListTodo className="size-4 text-marca-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-tinta">
            {resumen.pendientes}
          </div>
          <p className="mt-1 text-[11px] text-tinta/50">{t("prioritized")}</p>
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-linea-fuerte/40 bg-white p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-tinta/60 uppercase">
              {t("inProgress")}
            </span>
            <Flame className="size-4 text-marca-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-tinta">
            {resumen.enProgreso}
          </div>
          <p className="mt-1 text-[11px] text-tinta/50">{t("activeToday")}</p>
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-linea-fuerte/40 bg-white p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-tinta/60 uppercase">
              {t("hoursToday")}
            </span>
            <Clock className="size-4 text-marca-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-tinta">
            {formatearHoras(resumen.minutosHoy)}
          </div>
          <p className="mt-1 text-[11px] text-tinta/50">{t("loggedActivities")}</p>
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-linea-fuerte/40 bg-white p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-tinta/60 uppercase">
              {t("expensesWaiting")}
            </span>
            <Receipt className="size-4 text-marca-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-tinta">
            {resumen.rendicionesPendientes}
          </div>
          <p className="mt-1 text-[11px] text-tinta/50">{t("inReview")}</p>
        </div>
      </div>

      {/* 2. Programas Asignados a mi Rol */}
      {proyectosAsignados.length > 0 && (
        <div className="rounded-xl border border-marca-500/20 bg-marca-50 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-marca-600 uppercase">
            <FolderOpen className="size-4" />
            {t("assignedPrograms")}
          </div>
          <p className="mt-0.5 text-xs text-tinta/70">
            {t("assignedProgramsSubtitle")}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {proyectosAsignados.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-1.5 rounded-lg border border-marca-500/30 bg-white px-2.5 py-1 text-xs font-medium text-tinta shadow-2xs"
              >
                <span className="size-1.5 rounded-full bg-marca-500" />
                {p.nombre}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 3. Barra de Control de Tareas: Filtros + Acciones Rápidas */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(
            [
              { id: "todas", label: t("filterAll") },
              { id: "por_hacer", label: t("filterTodo") },
              { id: "en_progreso", label: t("filterDoing") },
              { id: "en_revision", label: t("filterReview") },
              { id: "completada", label: t("filterDone") },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              onClick={() => setFiltro(item.id)}
              className={cn(
                "inline-flex min-h-[38px] items-center rounded-lg px-3 text-xs font-medium transition-all active:scale-95",
                filtro === item.id
                  ? "bg-marca-500 text-white shadow-xs"
                  : "bg-white text-tinta/70 hover:bg-muted hover:text-tinta border border-linea-fuerte/40",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* Diálogo Registrar Tarea Rápida */}
          <Dialog open={dialogoNuevaAbierto} onOpenChange={setDialogoNuevaAbierto}>
            <DialogTrigger asChild>
              <Button
                variant="default"
                size="sm"
                className="min-h-[42px] bg-marca-500 text-white hover:bg-marca-600 active:scale-95"
              >
                <Plus className="mr-1.5 size-4" />
                {t("newQuickTask")}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <ListTodo className="size-5 text-marca-500" />
                  {t("newQuickTaskTitle")}
                </DialogTitle>
              </DialogHeader>
              <form
                action={async (datos) => {
                  startTransition(async () => {
                    const res = await crearTareaRapidaColaboradorAction(datos);
                    if (res.ok) {
                      setDialogoNuevaAbierto(false);
                    }
                  });
                }}
                className="space-y-4 pt-2"
              >
                <div>
                  <Label htmlFor="titulo">{t("taskTitle")}</Label>
                  <Input
                    id="titulo"
                    name="titulo"
                    placeholder={t("taskTitlePlaceholder")}
                    required
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="descripcion">{t("taskDescription")}</Label>
                  <Textarea
                    id="descripcion"
                    name="descripcion"
                    placeholder={t("taskDescriptionPlaceholder")}
                    rows={2}
                    className="mt-1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="prioridad">{t("taskPriority")}</Label>
                    <select id="prioridad" name="prioridad" className={cn(SELECT_CLASS, "mt-1")}>
                      <option value="media">{t("priorityMedia")}</option>
                      <option value="alta">{t("priorityAlta")}</option>
                      <option value="urgente">{t("priorityUrgente")}</option>
                      <option value="baja">{t("priorityBaja")}</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="fecha_limite">{t("taskDeadline")}</Label>
                    <Input
                      id="fecha_limite"
                      name="fecha_limite"
                      type="date"
                      defaultValue={new Date().toISOString().split("T")[0]}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="proyecto_id">{t("taskProject")}</Label>
                  <select id="proyecto_id" name="proyecto_id" className={cn(SELECT_CLASS, "mt-1")}>
                    <option value="">{t("noProject")}</option>
                    {proyectosAsignados.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogoNuevaAbierto(false)}
                  >
                    {t("cancel")}
                  </Button>
                  <Button
                    type="submit"
                    disabled={isPending}
                    className="bg-marca-500 text-white hover:bg-marca-600"
                  >
                    {isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                    {t("saveTask")}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          {/* Diálogo Bitácora */}
          <Dialog open={dialogoBitacoraAbierto} onOpenChange={setDialogoBitacoraAbierto}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="min-h-[42px] border-linea-fuerte bg-white active:scale-95"
              >
                <Clock className="mr-1.5 size-4 text-marca-500" />
                {t("logActivity")}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <Clock className="size-5 text-marca-500" />
                  {t("logActivityTitle")}
                </DialogTitle>
              </DialogHeader>
              <form
                action={async (datos) => {
                  startTransition(async () => {
                    const res = await registrarBitacoraDiariaAction(datos);
                    if (res.ok) {
                      setDialogoBitacoraAbierto(false);
                    }
                  });
                }}
                className="space-y-4 pt-2"
              >
                <div>
                  <Label htmlFor="descripcion_bitacora">{t("activityDescription")}</Label>
                  <Textarea
                    id="descripcion_bitacora"
                    name="descripcion"
                    placeholder={t("activityPlaceholder")}
                    required
                    rows={3}
                    className="mt-1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="minutos">{t("minutesSpent")}</Label>
                    <Input
                      id="minutos"
                      name="minutos"
                      type="number"
                      min="5"
                      step="5"
                      defaultValue="30"
                      required
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="tarea_id">{t("linkedTask")}</Label>
                    <select
                      id="tarea_id"
                      name="tarea_id"
                      defaultValue={tareaSeleccionadaBitacora}
                      className={cn(SELECT_CLASS, "mt-1")}
                    >
                      <option value="">{t("noTask")}</option>
                      {tareas.map((task) => (
                        <option key={task.id} value={task.id}>
                          {task.titulo}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogoBitacoraAbierto(false)}
                  >
                    {t("cancel")}
                  </Button>
                  <Button
                    type="submit"
                    disabled={isPending}
                    className="bg-marca-500 text-white hover:bg-marca-600"
                  >
                    {isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                    {t("saveLog")}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* 4. Lista Táctil de Tareas de Hoy */}
      <div className="space-y-3">
        {tareasFiltradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-linea-fuerte bg-white py-12 text-center shadow-xs">
            <CheckCircle2 className="size-10 text-marca-500/60" />
            <h3 className="mt-3 text-base font-semibold text-tinta">
              {t("noTasksTitle")}
            </h3>
            <p className="mt-1 text-sm text-tinta/60">
              {t("noTasksSubtitle")}
            </p>
          </div>
        ) : (
          tareasFiltradas.map((tarea) => {
            const actualizando = tareaActualizandoId === tarea.id;
            return (
              <div
                key={tarea.id}
                className={cn(
                  "relative flex flex-col justify-between gap-3 rounded-xl border bg-white p-4 shadow-xs transition-all sm:flex-row sm:items-center",
                  tarea.estado === "completada"
                    ? "border-linea-fuerte/40 opacity-75"
                    : "border-linea-fuerte hover:border-marca-500/40",
                  tarea.vencida && tarea.estado !== "completada" && "border-[#B4342B]/40 bg-[#B4342B]/5",
                )}
              >
                <div className="flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Badge de Prioridad */}
                    {tarea.prioridad === "urgente" && (
                      <span className="inline-flex items-center gap-1 rounded-md border-transparent bg-[#B4342B]/10 px-2 py-0.5 text-xs font-semibold text-[#B4342B]">
                        <AlertCircle className="size-3" />
                        {t("priorityUrgente")}
                      </span>
                    )}
                    {tarea.prioridad === "alta" && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-marca-50 px-2 py-0.5 text-xs font-semibold text-marca-600">
                        {t("priorityAlta")}
                      </span>
                    )}

                    {/* Badge de Proyecto */}
                    {tarea.proyecto_nombre && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-tinta/70">
                        <FolderOpen className="size-3" />
                        {tarea.proyecto_nombre}
                      </span>
                    )}

                    {/* Vencida / Fecha */}
                    {tarea.vencida && tarea.estado !== "completada" ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-[#B4342B]/10 px-2 py-0.5 text-xs font-semibold text-[#B4342B]">
                        <AlertCircle className="size-3" />
                        {t("overdue")} ({tarea.fecha_limite})
                      </span>
                    ) : tarea.fecha_limite ? (
                      <span className="inline-flex items-center gap-1 text-xs text-tinta/60">
                        <Calendar className="size-3" />
                        {tarea.fecha_limite}
                      </span>
                    ) : null}
                  </div>

                  <h4
                    className={cn(
                      "text-base font-semibold text-tinta",
                      tarea.estado === "completada" && "line-through text-tinta/60",
                    )}
                  >
                    {tarea.titulo}
                  </h4>

                  {tarea.descripcion && (
                    <p className="text-xs text-tinta/70 line-clamp-2">
                      {tarea.descripcion}
                    </p>
                  )}
                </div>

                {/* Botón de Avance Operativo Táctil (Touch target >= 44px) */}
                <div className="flex items-center gap-2 pt-2 sm:pt-0">
                  <button
                    type="button"
                    onClick={() => {
                      setTareaSeleccionadaBitacora(tarea.id);
                      setDialogoBitacoraAbierto(true);
                    }}
                    title={t("logTimeForThis")}
                    className="flex h-11 min-w-[44px] items-center justify-center rounded-lg border border-linea-fuerte bg-muted/50 px-2.5 text-xs text-tinta/70 hover:bg-muted active:scale-95"
                  >
                    <Clock className="size-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => avanzarEstado(tarea)}
                    disabled={actualizando}
                    className={cn(
                      "flex h-11 min-w-[130px] items-center justify-center gap-2 rounded-xl px-4 text-xs font-semibold shadow-xs transition-all active:scale-95",
                      tarea.estado === "por_hacer" &&
                        "bg-marca-500 text-white hover:bg-marca-600",
                      tarea.estado === "en_progreso" &&
                        "bg-marca-600 text-white hover:bg-marca-700",
                      tarea.estado === "en_revision" &&
                        "border border-marca-500 bg-marca-50 text-marca-600 hover:bg-marca-100",
                      tarea.estado === "completada" &&
                        "border border-linea-fuerte bg-muted text-tinta/70 hover:bg-muted/80",
                    )}
                  >
                    {actualizando ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <>
                        <span className="size-2 rounded-full bg-current" />
                        <span>
                          {tarea.estado === "por_hacer" && t("statePorHacer")}
                          {tarea.estado === "en_progreso" && t("stateEnProgreso")}
                          {tarea.estado === "en_revision" && t("stateEnRevision")}
                          {tarea.estado === "completada" && t("stateCompletada")}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 5. Resumen de Bitácora del Día */}
      {bitacoraInicial.length > 0 && (
        <Card className="rounded-2xl border-linea-fuerte bg-white shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-tinta">
              <Clock className="size-4 text-marca-500" />
              {t("todayLogTitle")} ({formatearHoras(resumen.minutosHoy)})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {bitacoraInicial.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-lg border border-linea-fuerte/30 bg-muted/30 p-2.5 text-xs"
              >
                <div className="space-y-0.5">
                  <p className="font-medium text-tinta">{entry.descripcion}</p>
                  {entry.tarea_titulo && (
                    <p className="text-[11px] text-tinta/60">
                      {t("linkedTo")}: {entry.tarea_titulo}
                    </p>
                  )}
                </div>
                <span className="rounded-md bg-white px-2 py-1 font-semibold text-marca-600 shadow-2xs">
                  {entry.minutos_dedicados} min
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
