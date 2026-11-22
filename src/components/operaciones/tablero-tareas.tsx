"use client";

import { useActionState, useState, useTransition } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import type { Locale } from "@/i18n/routing";
import { fechaCorta } from "@/lib/fechas";
import { COLUMNAS, type Columna } from "@/lib/operaciones";
import {
  ALERTA_RIESGO,
  ANIMACION,
  AZUL,
  AZUL_OSCURO,
  AZUL_SUAVE,
  NEUTRO,
  PRIORIDAD,
} from "@/lib/paleta";
import { cn } from "@/lib/utils";
import {
  crearTarea,
  type EstadoOperaciones,
  moverTarea,
} from "@/server/operaciones/acciones";
import type {
  OpcionOperaciones,
  TareaTablero,
} from "@/server/operaciones/consultas";

/** Clase del desplegable nativo, la misma del resto del proyecto. */
const SELECT =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-card px-2 text-base shadow-xs outline-none focus-visible:ring-[3px] sm:text-sm";

/**
 * Tablero de tareas: tres columnas y arrastrar para mover.
 *
 * ARRASTRAR NO ES LA ÚNICA FORMA DE MOVER, y eso no es un extra: con solo
 * arrastre, quien navega con teclado o usa un lector de pantalla no puede
 * cambiar el estado de una tarea. Cada tarjeta lleva además un botón que la
 * empuja a la siguiente columna, y las dos formas llaman a la MISMA acción.
 *
 * El arrastre es HTML nativo (`draggable`, `onDragStart`, `onDrop`), igual que
 * el del calendario: sin librería, sin dependencia nueva y con el mismo
 * comportamiento en todo el sistema.
 *
 * La tarjeta se mueve en pantalla ANTES de que el servidor conteste
 * (`useTransition` + estado local). Un tablero en el que la tarjeta se queda
 * quieta medio segundo después de soltarla se siente roto, y si la escritura
 * falla se devuelve a su sitio y se dice por qué.
 */
export function TableroTareas({
  tareas,
  proyectos,
  personas,
  puedeEscribir,
}: {
  tareas: readonly TareaTablero[];
  proyectos: readonly OpcionOperaciones[];
  personas: readonly OpcionOperaciones[];
  puedeEscribir: boolean;
}) {
  const t = useTranslations("admin");
  const [nueva, setNueva] = useState(false);

  /*
   * Los movimientos que aún no ha confirmado el servidor. Se guardan aparte de
   * `tareas` —que llega del servidor y se rehace en cada revalidación— para que
   * la respuesta buena pise el estado optimista en vez de pelearse con él.
   */
  const [movidas, setMovidas] = useState<Record<string, Columna>>({});
  const [arrastrada, setArrastrada] = useState<string | null>(null);
  const [columnaHover, setColumnaHover] = useState<Columna | null>(null);
  const [fallo, setFallo] = useState(false);
  const [, empezar] = useTransition();

  const [busqueda, setBusqueda] = useState("");
  const [proyectoFiltro, setProyectoFiltro] = useState<string>("todos");
  const [prioridadFiltro, setPrioridadFiltro] = useState<string>("todas");
  const [soloVencidas, setSoloVencidas] = useState(false);

  const estadoDe = (tarea: TareaTablero) =>
    movidas[tarea.id] ?? (tarea.estado as Columna);

  const texto = busqueda.trim().toLowerCase();
  const hayFiltros =
    texto.length > 0 ||
    proyectoFiltro !== "todos" ||
    prioridadFiltro !== "todas" ||
    soloVencidas;

  const tareasFiltradas = tareas.filter((tarea) => {
    if (soloVencidas && !tarea.vencida) return false;
    if (prioridadFiltro !== "todas" && tarea.prioridad !== prioridadFiltro) return false;
    if (proyectoFiltro === "__sin__") {
      if (tarea.proyecto_id !== null) return false;
    } else if (proyectoFiltro !== "todos" && tarea.proyecto_id !== proyectoFiltro) {
      return false;
    }
    if (texto.length > 0) {
      const enTitulo = tarea.titulo.toLowerCase().includes(texto);
      const enDesc = tarea.descripcion?.toLowerCase().includes(texto) ?? false;
      const enAsig = tarea.asignados?.toLowerCase().includes(texto) ?? false;
      if (!enTitulo && !enDesc && !enAsig) return false;
    }
    return true;
  });

  const totalVencidas = tareas.filter((tarea) => tarea.vencida).length;

  const COLOR_COLUMNA: Record<Columna, string> = {
    por_hacer: NEUTRO,
    en_progreso: AZUL,
    en_revision: AZUL_SUAVE,
    completada: AZUL_OSCURO,
  };

  const serieEstado = COLUMNAS.map((col) => ({
    nombre: t(`taskStatus.${col}`),
    valor: tareasFiltradas.filter((tarea) => estadoDe(tarea) === col).length,
    color: COLOR_COLUMNA[col],
  }));

  const conteoPorProyecto = new Map<string, number>();
  for (const tarea of tareasFiltradas) {
    const nombre = tarea.proyecto ?? t("board.noProject");
    conteoPorProyecto.set(nombre, (conteoPorProyecto.get(nombre) ?? 0) + 1);
  }
  const serieProyectos = [...conteoPorProyecto.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([nombre, valor], idx) => ({
      nombre: nombre.length > 20 ? `${nombre.slice(0, 19)}…` : nombre,
      valor,
      color: idx === 0 ? AZUL_OSCURO : AZUL,
    }));

  function mover(id: string, destino: Columna) {
    if (!puedeEscribir) return;

    const actual = tareas.find((tarea) => tarea.id === id);

    if (!actual || estadoDe(actual) === destino) return;

    setFallo(false);
    setMovidas((previo) => ({ ...previo, [id]: destino }));

    empezar(async () => {
      const datos = new FormData();
      datos.set("id", id);
      datos.set("estado", destino);

      const resultado = await moverTarea({ estado: "inicial" }, datos);

      if (resultado.estado !== "ok") {
        // Vuelve a su columna: mentirle a quien mira sobre dónde está una tarea
        // es peor que no dejarle moverla.
        setMovidas((previo) => {
          const copia = { ...previo };
          delete copia[id];
          return copia;
        });
        setFallo(true);
      }
    });
  }

  return (
    <div className={cn("space-y-4", ANIMACION.entrada)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-48 flex-1 sm:max-w-64">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
            <Input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder={t("board.searchPlaceholder")}
              className="h-9 pl-8 text-sm"
            />
          </div>

          <select
            aria-label={t("task.project")}
            value={proyectoFiltro}
            onChange={(e) => setProyectoFiltro(e.target.value)}
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-md border bg-card px-2.5 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
          >
            <option value="todos">{t("board.allProjects")}</option>
            <option value="__sin__">{t("board.noProject")}</option>
            {proyectos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>

          <select
            aria-label={t("task.priority")}
            value={prioridadFiltro}
            onChange={(e) => setPrioridadFiltro(e.target.value)}
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-md border bg-card px-2.5 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
          >
            <option value="todas">{t("board.allPriorities")}</option>
            {(["urgente", "alta", "media", "baja"] as const).map((p) => (
              <option key={p} value={p}>
                {t(`priority.${p}`)}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setSoloVencidas((v) => !v)}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors",
              soloVencidas
                ? "border-marca-500 bg-marca-50 text-marca-700"
                : "border-input bg-card text-tinta-2 hover:bg-muted/50",
            )}
          >
            <span>{t("board.onlyOverdue")}</span>
            <Badge className="bg-muted text-tinta text-[10px]">{totalVencidas}</Badge>
          </button>

          {hayFiltros && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setBusqueda("");
                setProyectoFiltro("todos");
                setPrioridadFiltro("todas");
                setSoloVencidas(false);
              }}
              className="h-9 gap-1 text-xs"
            >
              <X className="size-3.5" />
              {t("board.clearFilters")}
            </Button>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 sm:justify-end">
          {hayFiltros && (
            <span className="text-muted-foreground text-xs tabular-nums">
              {t("board.showingCount", {
                visibles: tareasFiltradas.length,
                total: tareas.length,
              })}
            </span>
          )}
          {puedeEscribir && !nueva && (
            <Button
              type="button"
              size="sm"
              onClick={() => setNueva(true)}
              className="transition-transform duration-150 active:scale-95"
            >
              <Plus className="size-3.5" />
              {t("tasks.new")}
            </Button>
          )}
        </div>
      </div>

      {fallo && (
        <p role="alert" className={ALERTA_RIESGO.contenedor}>
          <AlertCircle className={ALERTA_RIESGO.icono} />
          <span className={ALERTA_RIESGO.texto}>{t("board.moveError")}</span>
        </p>
      )}

      {nueva && (
        <Card>
          <CardContent className="pt-5">
            <FormularioTarea
              proyectos={proyectos}
              personas={personas}
              alTerminar={() => setNueva(false)}
            />
          </CardContent>
        </Card>
      )}

      {tareas.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">{t("board.chartStatusTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid items-center gap-3 sm:grid-cols-2">
                <GraficaAnillo
                  datos={serieEstado}
                  total={tareasFiltradas.length}
                  etiquetaTotal=""
                  vacio={t("board.chartEmpty")}
                />
                <ul className="divide-y divide-linea">
                  {serieEstado.map((fila) => (
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
              <CardTitle className="text-sm font-semibold">{t("board.chartProjectsTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <GraficaBarras datos={serieProyectos} vacio={t("board.chartEmpty")} />
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNAS.map((columna) => {
          const dentro = tareasFiltradas.filter((tarea) => estadoDe(tarea) === columna);
          const enHover = columnaHover === columna && arrastrada !== null;

          return (
            <div
              key={columna}
              onDragOver={(evento) => {
                if (puedeEscribir) {
                  evento.preventDefault();
                  if (columnaHover !== columna) setColumnaHover(columna);
                }
              }}
              onDragLeave={() => {
                if (columnaHover === columna) setColumnaHover(null);
              }}
              onDrop={() => {
                if (arrastrada) mover(arrastrada, columna);
                setArrastrada(null);
                setColumnaHover(null);
              }}
              className={cn(
                "bg-muted/30 min-h-32 rounded-xl p-3 transition-all",
                enHover && "bg-marca-50/40 ring-2 ring-marca-500/40",
              )}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase">
                  {t(`taskStatus.${columna}`)}
                </p>
                <Badge className="bg-marca-50 text-marca-700 text-[10px]">
                  {dentro.length}
                </Badge>
              </div>

              {dentro.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center text-xs">
                  {t("board.empty")}
                </p>
              ) : (
                <ul className="space-y-2">
                  {dentro.map((tarea) => (
                    <Tarjeta
                      key={tarea.id}
                      tarea={tarea}
                      columna={columna}
                      puedeEscribir={puedeEscribir}
                      alArrastrar={() => setArrastrada(tarea.id)}
                      alEmpujar={() => {
                        const siguiente =
                          COLUMNAS[COLUMNAS.indexOf(columna) + 1];
                        if (siguiente) mover(tarea.id, siguiente);
                      }}
                    />
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Una tarea. El peso de la píldora dice su prioridad. */
function Tarjeta({
  tarea,
  columna,
  puedeEscribir,
  alArrastrar,
  alEmpujar,
}: {
  tarea: TareaTablero;
  columna: Columna;
  puedeEscribir: boolean;
  alArrastrar: () => void;
  alEmpujar: () => void;
}) {
  const t = useTranslations("admin");
  const idioma = useLocale() as Locale;

  const prioridad =
    PRIORIDAD[tarea.prioridad as keyof typeof PRIORIDAD] ?? PRIORIDAD.media;
  const ultima = columna === COLUMNAS[COLUMNAS.length - 1];

  return (
    <li
      draggable={puedeEscribir}
      onDragStart={alArrastrar}
      className={cn(
        "bg-card group rounded-lg border p-2.5 shadow-xs transition-all duration-200",
        puedeEscribir && "cursor-grab hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing",
      )}
    >
      <div className="flex items-start gap-2">
        <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", prioridad.punto)} />

        <div className="min-w-0 flex-1">
          <p className="text-sm leading-snug font-medium">{tarea.titulo}</p>

          <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px]">
            <span className="inline-flex items-center gap-1">
              <FolderOpen className="size-3 shrink-0" />
              {tarea.proyecto ?? t("board.noProject")}
            </span>

            {tarea.fecha_limite && (
              <span
                className={cn(
                  "inline-flex items-center gap-1",
                  // Vencida en tinta y no en rojo: la marca no tiene rojo, y el
                  // peso máximo es justo lo que hay que mirar primero.
                  tarea.vencida && "font-semibold text-[#171A1D]",
                )}
              >
                <CalendarDays className="size-3 shrink-0" />
                {fechaCorta(tarea.fecha_limite, idioma)}
              </span>
            )}
          </div>

          {tarea.asignados && (
            <p className="text-muted-foreground mt-1 flex items-center gap-1 truncate text-[11px]">
              <Users className="size-3 shrink-0" />
              {tarea.asignados}
            </p>
          )}
        </div>

        {/* El respaldo del arrastre. Sin esto, mover una tarea sería imposible
            con teclado o con lector de pantalla. */}
        {puedeEscribir && !ultima && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={alEmpujar}
            title={t("taskStatus." + COLUMNAS[COLUMNAS.indexOf(columna) + 1])}
            aria-label={t("taskStatus." + COLUMNAS[COLUMNAS.indexOf(columna) + 1])}
            className="size-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          >
            <ChevronRight className="size-3.5" />
          </Button>
        )}
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        <Badge className={cn("text-[10px]", prioridad.clases)}>
          {t(`priority.${tarea.prioridad}` as never)}
        </Badge>

        {/* Solo se marca «todo el equipo»: es la excepción. `asignados` es lo
            normal y ponerle insignia a cada tarjeta sería ruido. */}
        {tarea.visibilidad === "todos" && (
          <Badge className="bg-muted text-[10px] text-tinta-2">
            {t("visibility.todos")}
          </Badge>
        )}
      </div>
    </li>
  );
}

/** Alta de una tarea, con sus asignados. */
function FormularioTarea({
  proyectos,
  personas,
  alTerminar,
}: {
  proyectos: readonly OpcionOperaciones[];
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
      <div>
        <p className="text-sm font-semibold">{t("newTask.title")}</p>
      </div>

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
