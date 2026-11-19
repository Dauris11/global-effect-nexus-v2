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
  Search,
  User,
  X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GraficaAnillo, GraficaBarras } from "@/components/dashboard/graficas";
import {
  AccionesFormulario,
  FormularioGuiado,
  PasoFormulario,
} from "@/components/ui/formulario-guiado";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { fechaCorta } from "@/lib/fechas";
import {
  ALERTA_RIESGO,
  ANIMACION,
  AZUL,
  AZUL_OSCURO,
  AZUL_SUAVE,
  clasesDeEstado,
  CUADRO,
  NEUTRO,
  VACIO,
} from "@/lib/paleta";
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
const ESTADOS_FILTRO = ["todos", "en_curso", "planificacion", "pausado", "completado"] as const;
type EstadoFiltro = (typeof ESTADOS_FILTRO)[number];

export function GestionProyectos({
  proyectos,
  puedeEscribir,
}: {
  proyectos: readonly ProyectoConAvance[];
  puedeEscribir: boolean;
}) {
  const t = useTranslations("admin");
  const [editando, setEditando] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>("todos");

  const texto = busqueda.trim().toLowerCase();
  const hayFiltros = texto.length > 0 || estadoFiltro !== "todos";

  const visibles = proyectos.filter((p) => {
    if (estadoFiltro !== "todos" && p.estado !== estadoFiltro) return false;
    if (texto.length > 0) {
      const enNombre = p.nombre.toLowerCase().includes(texto);
      const enDesc = p.descripcion?.toLowerCase().includes(texto) ?? false;
      const enResp = p.responsable?.toLowerCase().includes(texto) ?? false;
      if (!enNombre && !enDesc && !enResp) return false;
    }
    return true;
  });

  const totalTareas = proyectos.reduce((s, p) => s + p.tareas, 0);
  const totalHechas = proyectos.reduce((s, p) => s + p.hechas, 0);
  const avanceGlobal = totalTareas > 0 ? Math.round((totalHechas / totalTareas) * 100) : 0;
  const enCursoCount = proyectos.filter((p) => p.estado === "en_curso").length;
  const completadosCount = proyectos.filter((p) => p.estado === "completado").length;

  const serieEstados = [
    { nombre: t("projectStatus.en_curso"), valor: enCursoCount, color: AZUL },
    {
      nombre: t("projectStatus.planificacion"),
      valor: proyectos.filter((p) => p.estado === "planificacion").length,
      color: AZUL_SUAVE,
    },
    {
      nombre: t("projectStatus.pausado"),
      valor: proyectos.filter((p) => p.estado === "pausado").length,
      color: NEUTRO,
    },
    { nombre: t("projectStatus.completado"), valor: completadosCount, color: AZUL_OSCURO },
  ];

  const serieAvance = [...proyectos]
    .filter((p) => p.tareas > 0)
    .sort((a, b) => b.tareas - a.tareas)
    .slice(0, 6)
    .map((p) => ({
      nombre: p.nombre.length > 20 ? `${p.nombre.slice(0, 19)}…` : p.nombre,
      valor: Math.round((p.hechas / p.tareas) * 100),
      color: p.estado === "completado" ? AZUL_OSCURO : AZUL,
    }));

  return (
    <div className={cn("space-y-4", ANIMACION.entrada)}>
      {proyectos.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-card border border-linea bg-card p-3.5 shadow-card">
              <p className="text-xs font-semibold text-tinta/60 uppercase">{t("projects.statsTotal")}</p>
              <p className="mt-1.5 text-2xl font-bold text-tinta tabular-nums">{proyectos.length}</p>
            </div>
            <div className="rounded-card border border-linea bg-card p-3.5 shadow-card">
              <p className="text-xs font-semibold text-tinta/60 uppercase">{t("projects.statsActive")}</p>
              <p className="mt-1.5 text-2xl font-bold text-marca-600 tabular-nums">{enCursoCount}</p>
            </div>
            <div className="rounded-card border border-linea bg-card p-3.5 shadow-card">
              <p className="text-xs font-semibold text-tinta/60 uppercase">{t("projects.statsDone")}</p>
              <p className="mt-1.5 text-2xl font-bold text-tinta tabular-nums">{completadosCount}</p>
            </div>
            <div className="rounded-card border border-linea bg-card p-3.5 shadow-card">
              <p className="text-xs font-semibold text-tinta/60 uppercase">{t("projects.statsProgress")}</p>
              <p className="mt-1.5 text-2xl font-bold text-tinta tabular-nums">{avanceGlobal}%</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">{t("projects.chartStatusTitle")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid items-center gap-3 sm:grid-cols-2">
                  <GraficaAnillo
                    datos={serieEstados}
                    total={proyectos.length}
                    etiquetaTotal={t("projects.statsTotal")}
                    vacio={t("projects.chartEmpty")}
                  />
                  <ul className="divide-y divide-linea">
                    {serieEstados.map((fila) => (
                      <li key={fila.nombre} className="flex items-center gap-2 py-1.5 text-xs">
                        <span
                          aria-hidden
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: fila.color }}
                        />
                        <span className="flex-1 text-tinta-2">{fila.nombre}</span>
                        <span className="font-semibold text-tinta tabular-nums">{fila.valor}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">{t("projects.chartProgressTitle")}</CardTitle>
              </CardHeader>
              <CardContent>
                <GraficaBarras datos={serieAvance} vacio={t("projects.chartEmpty")} />
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-48 flex-1 sm:max-w-64">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
            <Input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder={t("projects.searchPlaceholder")}
              className="h-9 pl-8 text-sm"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {ESTADOS_FILTRO.map((est) => {
              const activo = estadoFiltro === est;
              const conteo =
                est === "todos"
                  ? proyectos.length
                  : proyectos.filter((p) => p.estado === est).length;
              return (
                <button
                  key={est}
                  type="button"
                  onClick={() => setEstadoFiltro(est)}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors",
                    activo
                      ? "border-marca-500 bg-marca-50 text-marca-700"
                      : "border-linea bg-card text-tinta-2 hover:bg-muted/50",
                  )}
                >
                  <span>
                    {est === "todos"
                      ? t("projects.allStatuses")
                      : t(`projectStatus.${est}` as never)}
                  </span>
                  <span className="tabular-nums opacity-75">{conteo}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
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
          </CardContent>
        </Card>
      ) : visibles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <p className="text-sm text-tinta-2">{t("projects.emptyFiltered")}</p>
            {hayFiltros && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setBusqueda("");
                  setEstadoFiltro("todos");
                }}
              >
                <X className="size-3.5" />
                {t("projects.clearFilters")}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {visibles.map((proyecto) => (
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

        <div className="flex items-center gap-1 shrink-0">
          <Link
            href={`/administrativo/proyectos/${proyecto.id}`}
            className="inline-flex size-8 items-center justify-center rounded-md border border-linea text-tinta-2 transition-colors hover:border-marca-500 hover:text-marca-600 hover:bg-muted"
            title={t("projects.viewGantt")}
            aria-label={t("projects.viewGantt")}
          >
            <CalendarDays className="size-3.5" />
          </Link>

          {puedeEscribir && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={alEditar}
              title={t("editProject.edit")}
              aria-label={t("editProject.edit")}
              className="size-8"
            >
              <Pencil className="size-3.5" />
            </Button>
          )}
        </div>
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
      </div>

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
        </AccionesFormulario>
      </FormularioGuiado>
    </form>
  );
}
