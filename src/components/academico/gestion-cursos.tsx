"use client";

import { useActionState, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ExternalLink,
  GraduationCap,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CUADRO } from "@/lib/paleta";
import { cn } from "@/lib/utils";
import {
  eliminarCurso,
  guardarCurso,
  publicarTarea,
  revisarEntrega,
  type EstadoAcademico,
} from "@/server/profesor/acciones";
import type {
  Clase360,
  CursoGestionado,
  EntregaPorRevisar,
  EstudianteEnCurso,
  InscritoEn360,
} from "@/server/profesor/consultas";

/**
 * Gestión académica del profesor y de administración.
 *
 * Tres bloques, en el orden en que se usan:
 *
 *   1. Entregas por revisar. Va primero porque hay alguien esperando nota.
 *   2. Cursos técnicos: crear, editar, borrar, y desplegar para ver quién está,
 *      cómo va y si entregó.
 *   3. Clases de Global Effect 360: solo ver y poner tareas. El catálogo del
 *      programa se administra en Prematrícula, y aquí se dice.
 *
 * Los estudiantes de un curso y los inscritos de una clase llegan ya cargados
 * desde el servidor, no se piden al desplegar: son listas cortas —un curso
 * técnico tiene decenas, no miles— y una petición por clic para veinte filas es
 * peor experiencia y más código.
 */
export function GestionCursos({
  cursos,
  estudiantesPorCurso,
  clases,
  inscritosPorClase,
  entregas,
  periodos,
  puedeCrear,
}: {
  cursos: readonly CursoGestionado[];
  estudiantesPorCurso: Record<string, EstudianteEnCurso[]>;
  clases: readonly Clase360[];
  inscritosPorClase: Record<string, InscritoEn360[]>;
  entregas: readonly (EntregaPorRevisar & { enlace: string | null })[];
  periodos: readonly { id: string; nombre: string; tipo: string }[];
  /** Si puede crear un curso nuevo: docente o `academico.escribir`. */
  puedeCrear: boolean;
}) {
  const t = useTranslations("academic");
  const [editando, setEditando] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [tareaEn, setTareaEn] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* ── 1. Por revisar ───────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-5">
          <CardTitle className="mb-3">
            <GraduationCap className="size-4" />
            {t("courses.toReview")}
            {entregas.length > 0 && (
              <Badge className="ml-1 bg-[#171A1D] text-[10px] text-white">
                {entregas.length}
              </Badge>
            )}
          </CardTitle>

          {entregas.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              {t("courses.reviewEmpty")}
            </p>
          ) : (
            <ul className="divide-y">
              {entregas.map((entrega) => (
                <FilaEntrega key={entrega.id} entrega={entrega} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ── 2. Cursos técnicos ───────────────────────────────────── */}
      <Card>
        <CardContent className="pt-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <CardTitle>
              <BookOpen className="size-4" />
              {t("courses.title")}
              <Badge className="ml-1 bg-[#2096BA]/15 text-[10px] text-[#187a99]">
                {cursos.length}
              </Badge>
            </CardTitle>

            {puedeCrear && editando !== "nuevo" && (
              <Button type="button" size="sm" onClick={() => setEditando("nuevo")}>
                <Plus className="size-3.5" />
                {t("courses.new")}
              </Button>
            )}
          </div>

          {editando === "nuevo" && (
            <FormularioCurso
              periodos={periodos}
              alTerminar={() => setEditando(null)}
            />
          )}

          {cursos.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              {t("courses.empty")}
            </p>
          ) : (
            <ul className="mt-3 divide-y">
              {cursos.map((curso) => (
                <li key={curso.id} className="py-3">
                  <div className="flex flex-wrap items-start gap-3">
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-lg",
                        CUADRO.marca,
                      )}
                    >
                      <BookOpen className="size-4" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{curso.nombre}</p>
                      <p className="text-muted-foreground truncate text-xs">
                        {[
                          curso.docente,
                          curso.periodo,
                          curso.periodo_tipo
                            ? t(
                                `courses.${curso.periodo_tipo === "semestre" ? "semester" : "quarter"}`,
                              )
                            : null,
                          curso.horario,
                          t(`courseMode.${curso.modalidad}` as never),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>

                      {/* Las cifras que pediste ver por materia: cuántos
                          estudiantes, cuántas notas, promedio y cuántas tareas. */}
                      <p className="text-muted-foreground mt-1 flex flex-wrap gap-x-3 text-[11px]">
                        <span>
                          {t("courses.students")}: <b>{curso.estudiantes}</b>
                        </span>
                        <span>
                          {t("courses.grades")}: <b>{curso.notas}</b>
                        </span>
                        <span>
                          {t("courses.average")}:{" "}
                          <b>{curso.promedio?.toFixed(1) ?? "—"}</b>
                        </span>
                        <span>
                          {t("courses.tasks")}: <b>{curso.tareas}</b>
                        </span>
                      </p>
                    </div>

                    <Badge
                      className={cn(
                        "shrink-0 text-[10px]",
                        curso.estado === "activo"
                          ? "bg-[#2096BA]/15 text-[#187a99]"
                          : "bg-slate-100 text-slate-600",
                      )}
                    >
                      {t(`courseStatus.${curso.estado}` as never)}
                    </Badge>

                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setAbierto(abierto === curso.id ? null : curso.id)
                        }
                      >
                        <Users className="size-3.5" />
                        {abierto === curso.id
                          ? t("courses.hideStudents")
                          : t("courses.seeStudents")}
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title={t("courses.newTask")}
                        aria-label={t("courses.newTask")}
                        onClick={() =>
                          setTareaEn(
                            tareaEn === `curso:${curso.id}` ? null : `curso:${curso.id}`,
                          )
                        }
                      >
                        <Plus className="size-3.5" />
                      </Button>

                      {puedeCrear && (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            title={t("courses.edit")}
                            aria-label={t("courses.edit")}
                            onClick={() =>
                              setEditando(editando === curso.id ? null : curso.id)
                            }
                          >
                            <Pencil className="size-3.5" />
                          </Button>

                          <BotonBorrar id={curso.id} />
                        </>
                      )}
                    </div>
                  </div>

                  {editando === curso.id && (
                    <FormularioCurso
                      curso={curso}
                      periodos={periodos}
                      alTerminar={() => setEditando(null)}
                    />
                  )}

                  {tareaEn === `curso:${curso.id}` && (
                    <FormularioTarea
                      unidad={`curso:${curso.id}`}
                      alTerminar={() => setTareaEn(null)}
                    />
                  )}

                  {abierto === curso.id && (
                    <TablaEstudiantes
                      filas={estudiantesPorCurso[curso.id] ?? []}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ── 3. Global Effect 360 ─────────────────────────────────── */}
      <Card>
        <CardContent className="pt-5">
          <CardTitle className="mb-1">
            <Sparkles className="size-4" />
            {t("courses.my360")}
          </CardTitle>
          <p className="text-muted-foreground mb-3 text-xs">
            {t("courses.admin360Hint")}
          </p>

          {clases.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              {t("courses.no360")}
            </p>
          ) : (
            <ul className="divide-y">
              {clases.map((clase) => (
                <li key={clase.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-lg",
                        clase.obligatoria ? CUADRO.fuerte : CUADRO.marca,
                      )}
                    >
                      <Sparkles className="size-4" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{clase.nombre}</p>
                      <p className="text-muted-foreground truncate text-xs">
                        {clase.codigo ? `${clase.codigo} · ` : ""}
                        {t("courses.enrolled")}: <b>{clase.inscritos}</b> ·{" "}
                        {t("courses.tasks")}: <b>{clase.tareas}</b>
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setAbierto(abierto === clase.id ? null : clase.id)
                      }
                    >
                      <Users className="size-3.5" />
                      {abierto === clase.id
                        ? t("courses.hideStudents")
                        : t("courses.seeStudents")}
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      title={t("courses.newTask")}
                      aria-label={t("courses.newTask")}
                      onClick={() =>
                        setTareaEn(tareaEn === `360:${clase.id}` ? null : `360:${clase.id}`)
                      }
                    >
                      <Plus className="size-3.5" />
                    </Button>
                  </div>

                  {tareaEn === `360:${clase.id}` && (
                    <FormularioTarea
                      unidad={`360:${clase.id}`}
                      alTerminar={() => setTareaEn(null)}
                    />
                  )}

                  {abierto === clase.id && (
                    <Tabla360 filas={inscritosPorClase[clase.id] ?? []} />
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Los estudiantes de un curso: nota y si cumplieron con las tareas. */
function TablaEstudiantes({ filas }: { filas: readonly EstudianteEnCurso[] }) {
  const t = useTranslations("academic");

  if (filas.length === 0) {
    return (
      <p className="text-muted-foreground mt-3 border-t pt-3 text-center text-xs">
        {t("courses.noStudents")}
      </p>
    );
  }

  return (
    <div className="mt-3 border-t pt-3">
      <ul className="space-y-1.5">
        {filas.map((fila) => (
          <li
            key={fila.estudiante_id}
            className="bg-muted/40 flex flex-wrap items-center gap-3 rounded-lg px-3 py-2 text-xs"
          >
            <span className="min-w-0 flex-1 truncate font-medium">
              {fila.nombre}
            </span>

            <span className="text-muted-foreground">
              {t("courses.average")}: <b>{fila.promedio?.toFixed(1) ?? "—"}</b>
            </span>

            <span className="text-muted-foreground">
              {t("courses.grades")}: <b>{fila.notas}</b>
            </span>

            {/* Cumplimiento: entregadas sobre el total de tareas del curso. */}
            <Badge
              className={cn(
                "text-[10px]",
                fila.tareas > 0 && fila.entregadas >= fila.tareas
                  ? "bg-[#0a6a8a] text-white"
                  : fila.entregadas > 0
                    ? "bg-[#2096BA]/15 text-[#187a99]"
                    : "bg-slate-100 text-slate-600",
              )}
            >
              {t("courses.compliance")}: {fila.entregadas}/{fila.tareas}
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Los becados inscritos en una clase de 360. */
function Tabla360({ filas }: { filas: readonly InscritoEn360[] }) {
  const t = useTranslations("academic");

  if (filas.length === 0) {
    return (
      <p className="text-muted-foreground mt-3 border-t pt-3 text-center text-xs">
        {t("courses.noStudents")}
      </p>
    );
  }

  return (
    <div className="mt-3 border-t pt-3">
      <ul className="space-y-1.5">
        {filas.map((fila) => (
          <li
            key={fila.estudiante_id}
            className="bg-muted/40 flex flex-wrap items-center gap-3 rounded-lg px-3 py-2 text-xs"
          >
            <span className="min-w-0 flex-1 truncate font-medium">
              {fila.nombre}
            </span>

            {fila.periodo && (
              <span className="text-muted-foreground">{fila.periodo}</span>
            )}

            <span className="text-muted-foreground">
              {t("courses.grade")}: <b>{fila.nota?.toFixed(1) ?? "—"}</b>
            </span>

            <Badge className="bg-[#2096BA]/15 text-[10px] text-[#187a99]">
              {t("courses.compliance")}: {fila.entregadas}/{fila.tareas}
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Una entrega esperando nota. */
function FilaEntrega({
  entrega,
}: {
  entrega: EntregaPorRevisar & { enlace: string | null };
}) {
  const t = useTranslations("academic");
  const [estado, enviar, enviando] = useActionState<EstadoAcademico, FormData>(
    revisarEntrega,
    { estado: "inicial" },
  );

  return (
    <li className="space-y-2 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{entrega.estudiante}</p>
          <p className="text-muted-foreground truncate text-xs">
            {entrega.asignacion} · {entrega.unidad}
          </p>
        </div>

        {/* El enlace lo firma el servidor y caduca: el bucket es privado. */}
        {entrega.enlace && (
          <a
            href={entrega.enlace}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[#187a99] hover:underline"
          >
            <ExternalLink className="size-3.5" />
            {t("courses.openFile")}
          </a>
        )}
      </div>

      <form action={enviar} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="id" value={entrega.id} />

        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground text-[11px] font-medium">
            {t("courses.grade")}
          </span>
          <Input
            name="nota"
            type="number"
            min={0}
            max={100}
            step="0.1"
            defaultValue={entrega.calificacion ?? ""}
            className="h-8 w-20 text-xs"
            aria-invalid={estado.estado === "nota_invalida" || undefined}
          />
        </label>

        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-muted-foreground text-[11px] font-medium">
            {t("courses.comment")}
          </span>
          <Input
            name="comentario"
            defaultValue={entrega.comentario_profesor ?? ""}
            maxLength={900}
            className="h-8 text-xs"
          />
        </label>

        <Button type="submit" size="sm" disabled={enviando}>
          {enviando && <Loader2 className="size-3.5 animate-spin" />}
          {t("courses.review")}
        </Button>
      </form>

      {estado.estado === "ok" && (
        <p className="text-[11px] font-medium text-[#187a99]">
          {t("courses.reviewed")}
        </p>
      )}

      {estado.estado !== "inicial" && estado.estado !== "ok" && (
        <p role="alert" className="text-destructive text-[11px]">
          {estado.estado === "nota_invalida"
            ? t("courses.errGrade")
            : estado.estado === "no_encontrado"
              ? t("courses.errOwner")
              : t("courses.errGeneric")}
        </p>
      )}
    </li>
  );
}

/** Alta y edición de un curso técnico. */
function FormularioCurso({
  curso,
  periodos,
  alTerminar,
}: {
  curso?: CursoGestionado;
  periodos: readonly { id: string; nombre: string; tipo: string }[];
  alTerminar: () => void;
}) {
  const t = useTranslations("academic");
  const [estado, enviar, enviando] = useActionState<EstadoAcademico, FormData>(
    async (previo, datos) => {
      const resultado = await guardarCurso(previo, datos);
      if (resultado.estado === "ok") alTerminar();
      return resultado;
    },
    { estado: "inicial" },
  );

  const clave = curso?.id ?? "nuevo";

  return (
    <form action={enviar} className="mt-3 space-y-3 border-t pt-3">
      <input type="hidden" name="id" value={curso?.id ?? ""} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5 lg:col-span-2">
          <Label htmlFor={`c-nombre-${clave}`}>{t("course.name")}</Label>
          <Input
            id={`c-nombre-${clave}`}
            name="nombre"
            defaultValue={curso?.nombre}
            placeholder={t("newCourse.namePlaceholder")}
            required
            maxLength={160}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`c-periodo-${clave}`}>{t("course.term")}</Label>
          <select
            id={`c-periodo-${clave}`}
            name="periodo"
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-white px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
          >
            <option value="">—</option>
            {periodos.map((periodo) => (
              <option key={periodo.id} value={periodo.id}>
                {periodo.nombre} ·{" "}
                {t(`courses.${periodo.tipo === "semestre" ? "semester" : "quarter"}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`c-estado-${clave}`}>{t("course.status")}</Label>
          <select
            id={`c-estado-${clave}`}
            name="estado"
            defaultValue={curso?.estado ?? "activo"}
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-white px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
          >
            {(["activo", "planificado", "finalizado"] as const).map((valor) => (
              <option key={valor} value={valor}>
                {t(`courseStatus.${valor}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`c-modalidad-${clave}`}>{t("course.mode")}</Label>
          <select
            id={`c-modalidad-${clave}`}
            name="modalidad"
            defaultValue={curso?.modalidad ?? "presencial"}
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-white px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
          >
            {(["presencial", "virtual", "mixto"] as const).map((valor) => (
              <option key={valor} value={valor}>
                {t(`courseMode.${valor}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`c-capacidad-${clave}`}>{t("course.capacity")}</Label>
          <Input
            id={`c-capacidad-${clave}`}
            name="capacidad"
            type="number"
            min={0}
            max={500}
            defaultValue={curso?.capacidad ?? 30}
          />
        </div>

        <div className="space-y-1.5 lg:col-span-2">
          <Label htmlFor={`c-horario-${clave}`}>{t("course.schedule")}</Label>
          <Input
            id={`c-horario-${clave}`}
            name="horario"
            defaultValue={curso?.horario ?? ""}
            placeholder={t("newCourse.scheduleHint")}
            maxLength={120}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`c-desc-${clave}`}>{t("course.description")}</Label>
        <Textarea
          id={`c-desc-${clave}`}
          name="descripcion"
          defaultValue={curso?.descripcion ?? ""}
          maxLength={600}
          rows={2}
        />
      </div>

      {estado.estado !== "inicial" && estado.estado !== "ok" && (
        <p role="alert" className="text-destructive text-xs">
          {estado.estado === "nombre_vacio"
            ? t("newCourse.nameRequired")
            : estado.estado === "no_encontrado"
              ? t("courses.errOwner")
              : t("newCourse.error")}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={enviando}>
          {enviando && <Loader2 className="size-3.5 animate-spin" />}
          {enviando ? t("courses.saving") : t("courses.save")}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={alTerminar}>
          {t("courses.cancel")}
        </Button>
      </div>
    </form>
  );
}

/** Publicar una tarea o examen en un curso o en una clase de 360. */
function FormularioTarea({
  unidad,
  alTerminar,
}: {
  unidad: string;
  alTerminar: () => void;
}) {
  const t = useTranslations("academic");
  const [estado, enviar, enviando] = useActionState<EstadoAcademico, FormData>(
    async (previo, datos) => {
      const resultado = await publicarTarea(previo, datos);
      if (resultado.estado === "ok") alTerminar();
      return resultado;
    },
    { estado: "inicial" },
  );

  return (
    <form action={enviar} className="mt-3 space-y-3 border-t pt-3">
      <input type="hidden" name="unidad" value={unidad} />

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`t-titulo-${unidad}`}>{t("courses.taskTitle")}</Label>
          <Input
            id={`t-titulo-${unidad}`}
            name="titulo"
            required
            maxLength={160}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`t-tipo-${unidad}`}>{t("courses.taskType")}</Label>
          <select
            id={`t-tipo-${unidad}`}
            name="tipo"
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-white px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
          >
            <option value="tarea">{t("courses.taskTypeTask")}</option>
            <option value="examen">{t("courses.taskTypeExam")}</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`t-vence-${unidad}`}>{t("courses.taskDue")}</Label>
          <Input
            id={`t-vence-${unidad}`}
            name="vence"
            type="datetime-local"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`t-desc-${unidad}`}>{t("course.description")}</Label>
        <Textarea
          id={`t-desc-${unidad}`}
          name="descripcion"
          maxLength={900}
          rows={2}
        />
      </div>

      <p className="text-muted-foreground text-xs">{t("courses.taskDueHint")}</p>

      {estado.estado !== "inicial" && estado.estado !== "ok" && (
        <p role="alert" className="text-destructive text-xs">
          {estado.estado === "nombre_vacio"
            ? t("newCourse.nameRequired")
            : estado.estado === "no_encontrado"
              ? t("courses.errOwner")
              : t("courses.errGeneric")}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={enviando}>
          {enviando && <Loader2 className="size-3.5 animate-spin" />}
          {t("courses.newTask")}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={alTerminar}>
          {t("courses.cancel")}
        </Button>
      </div>
    </form>
  );
}

/**
 * Borrar un curso.
 *
 * Se pregunta antes, y si el curso tiene notas o tareas la acción responde
 * `tiene_datos` y no borra: `calificacion` es ON DELETE CASCADE y borrarlo se
 * llevaría el historial académico de sus estudiantes.
 */
function BotonBorrar({ id }: { id: string }) {
  const t = useTranslations("academic");
  const [estado, enviar, enviando] = useActionState<EstadoAcademico, FormData>(
    eliminarCurso,
    { estado: "inicial" },
  );

  return (
    <form
      action={enviar}
      onSubmit={(evento) => {
        if (!window.confirm(t("courses.deleteHint"))) evento.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />

      <Button
        type="submit"
        variant="ghost"
        size="icon"
        disabled={enviando}
        title={t("courses.remove")}
        aria-label={t("courses.remove")}
        className="text-destructive hover:text-destructive"
      >
        {enviando ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Trash2 className="size-3.5" />
        )}
      </Button>

      {estado.estado === "tiene_datos" && (
        <p role="alert" className="text-destructive mt-1 max-w-64 text-[11px]">
          {t("courses.inUseHint")}
        </p>
      )}
    </form>
  );
}
