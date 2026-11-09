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
  Users,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Locale } from "@/i18n/routing";
import { fechaCorta } from "@/lib/fechas";
import { COLUMNAS, type Columna } from "@/lib/operaciones";
import { ALERTA_RIESGO, ANIMACION, PRIORIDAD } from "@/lib/paleta";
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
  const [fallo, setFallo] = useState(false);
  const [, empezar] = useTransition();

  const estadoDe = (tarea: TareaTablero) =>
    movidas[tarea.id] ?? (tarea.estado as Columna);

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
      <div className="flex flex-wrap items-center justify-end gap-2">
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNAS.map((columna) => {
          const dentro = tareas.filter((tarea) => estadoDe(tarea) === columna);

          return (
            <div
              key={columna}
              onDragOver={(evento) => {
                if (puedeEscribir) evento.preventDefault();
              }}
              onDrop={() => {
                if (arrastrada) mover(arrastrada, columna);
                setArrastrada(null);
              }}
              className="bg-muted/30 min-h-32 rounded-xl p-3 transition-colors"
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5 lg:col-span-2">
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

      <div className="space-y-1.5">
        <Label htmlFor="t-desc">{t("task.description")}</Label>
        <Textarea id="t-desc" name="descripcion" maxLength={900} rows={2} />
      </div>

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
                className="size-3.5 accent-[#2096BA]"
              />
              <span className="truncate">{persona.nombre}</span>
            </label>
          ))}
        </div>
      </fieldset>

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
          {enviando ? t("newTask.creating") : t("newTask.create")}
        </Button>

        <Button type="button" variant="ghost" size="sm" onClick={alTerminar}>
          {t("newTask.cancel")}
        </Button>
      </div>
    </form>
  );
}
