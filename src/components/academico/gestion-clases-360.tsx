"use client";

import { useActionState, useState, useTransition } from "react";
import {
  CalendarCheck,
  ExternalLink,
  FileText,
  GraduationCap,
  Info,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { AsistenciaClase360 } from "@/components/academico/asistencia-clase-360";
import { FilaInscrito } from "@/components/academico/fila-inscrito-360";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import {
  AccionesFormulario,
  FormularioGuiado,
  PasoFormulario,
} from "@/components/ui/formulario-guiado";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CUADRO } from "@/lib/paleta";
import { cn } from "@/lib/utils";
import {
  borrarAsignacion360,
  publicarTarea,
  revisarEntrega,
  type EstadoAcademico,
} from "@/server/profesor/acciones";
import type { AsistenciaDeClases } from "@/server/profesor/asistencia";
import type {
  AsignacionDeClase360,
  Clase360,
  EntregaPorRevisar,
  InscritoEn360,
  PeriodoParaTarea,
} from "@/server/profesor/consultas";

const SELECTOR =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 rounded-control h-9 w-full border bg-card px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]";

/**
 * Las clases de Global Effect 360, del profesor o de todo el programa.
 *
 * Dos bloques, en el orden en que se usan:
 *
 *   1. Entregas por revisar. Va primero porque hay alguien esperando nota.
 *   2. Las clases: desplegar para ver quién está, cómo va y si entregó, poner
 *      tareas y cerrar la nota final de cada inscrito.
 *
 * El catálogo —crear o retirar una materia— no está aquí: se administra en
 * Prematrícula, y la pantalla lo dice.
 *
 * Los inscritos de cada clase llegan ya cargados desde el servidor, no se piden
 * al desplegar: son listas cortas —decenas, no miles— y una petición por clic
 * para veinte filas es peor experiencia y más código.
 */
export function GestionClases360({
  clases,
  inscritosPorClase,
  entregas,
  puedeCalificar,
  asistencia,
  puedeProgramar,
  periodosDeTarea,
  asignacionesPorClase = {},
  claseInicialId = null,
  seccionInicial = null,
}: {
  clases: readonly Clase360[];
  asistencia: AsistenciaDeClases;
  /** Períodos donde cada clase tiene inscritos: a cuál pertenece una tarea nueva. */
  periodosDeTarea: Record<string, PeriodoParaTarea[]>;
  /** Publicaciones (tareas, exámenes, materiales y anuncios) por clase de 360. */
  asignacionesPorClase?: Record<string, AsignacionDeClase360[]>;
  /** `academico.escribir` o `docencia.impartir` en sus propias clases. */
  puedeProgramar: boolean;
  inscritosPorClase: Record<string, InscritoEn360[]>;
  entregas: readonly (EntregaPorRevisar & { enlace: string | null })[];
  /**
   * `calificaciones.registrar` o `docencia.impartir`: coordinación ve las notas
   * pero no las pone.
   */
  puedeCalificar: boolean;
  claseInicialId?: string | null;
  seccionInicial?: "asistencia" | "alumnos" | "tarea" | null;
}) {
  const t = useTranslations("academic.classes360");
  const [abierto, setAbierto] = useState<string | null>(
    seccionInicial === "alumnos" || (!seccionInicial && claseInicialId)
      ? claseInicialId
      : null,
  );
  const [tareaEn, setTareaEn] = useState<string | null>(
    seccionInicial === "tarea" ? claseInicialId : null,
  );
  const [publicacionesEn, setPublicacionesEn] = useState<string | null>(null);
  const [asistenciaEn, setAsistenciaEn] = useState<string | null>(
    seccionInicial === "asistencia" ? claseInicialId : null,
  );

  return (
    <div className="space-y-6">
      {/* ── 1. Por revisar ───────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-5">
          <CardTitle className="mb-3">
            <GraduationCap className="size-4" />
            {t("toReview")}
            {entregas.length > 0 && (
              <Badge className="bg-tinta text-background ml-1 text-[10px]">
                {entregas.length}
              </Badge>
            )}
          </CardTitle>

          {entregas.length === 0 ? (
            <p className="text-tinta-3 py-6 text-center text-sm">
              {t("reviewEmpty")}
            </p>
          ) : (
            <ul className="divide-linea divide-y">
              {entregas.map((entrega) => (
                <FilaEntrega key={entrega.id} entrega={entrega} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ── 2. Clases ────────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-5">
          <CardTitle className="mb-1">
            <Sparkles className="size-4" />
            {t("classes")}
            <Badge className="bg-marca-500/15 text-marca-600 ml-1 text-[10px]">
              {clases.length}
            </Badge>
          </CardTitle>

          {clases.length === 0 ? (
            <EstadoVacio icono={Sparkles} titulo={t("empty")} />
          ) : (
            <ul className="divide-linea divide-y">
              {clases.map((clase) => (
                <li key={clase.id} id={`clase-${clase.id}`} className="scroll-mt-16 py-3">
                  <div className="flex flex-wrap items-start gap-3">
                    <span
                      className={cn(
                        "rounded-control flex size-9 shrink-0 items-center justify-center",
                        clase.activa ? CUADRO.marca : CUADRO.neutro,
                      )}
                    >
                      <Sparkles className="size-4" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{clase.nombre}</p>
                      <p className="text-tinta-3 truncate text-xs">
                        {[clase.codigo, clase.horario, clase.aula]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>

                      <p className="text-tinta-3 mt-1 flex flex-wrap gap-x-3 text-[11px]">
                        <span>
                          {t("enrolled")}: <b>{clase.inscritos}</b>
                        </span>
                        <span>
                          {t("tasks")}: <b>{clase.tareas}</b>
                        </span>
                        <span>
                          {t("withGrade")}: <b>{clase.con_nota}</b>
                        </span>
                        <span>
                          {t("average")}: <b>{clase.promedio?.toFixed(1) ?? "—"}</b>
                        </span>
                      </p>
                    </div>

                    {!clase.activa && (
                      <Badge className="bg-muted text-tinta-2 shrink-0 text-[10px]">
                        {t("inactive")}
                      </Badge>
                    )}

                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-expanded={abierto === clase.id}
                        onClick={() => setAbierto(abierto === clase.id ? null : clase.id)}
                      >
                        <Users className="size-3.5" />
                        {abierto === clase.id ? t("hideStudents") : t("seeStudents")}
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-expanded={publicacionesEn === clase.id}
                        onClick={() =>
                          setPublicacionesEn(
                            publicacionesEn === clase.id ? null : clase.id,
                          )
                        }
                      >
                        <FileText className="size-3.5" />
                        {t("seeTasks")}
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-expanded={asistenciaEn === clase.id}
                        onClick={() =>
                          setAsistenciaEn(asistenciaEn === clase.id ? null : clase.id)
                        }
                      >
                        <CalendarCheck className="size-3.5" />
                        {t("attendance")}
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title={t("newTask")}
                        aria-label={t("newTask")}
                        aria-expanded={tareaEn === clase.id}
                        onClick={() => setTareaEn(tareaEn === clase.id ? null : clase.id)}
                      >
                        <Plus className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  {tareaEn === clase.id && (
                    <FormularioTarea
                      materiaId={clase.id}
                      periodos={periodosDeTarea[clase.id] ?? []}
                      alTerminar={() => setTareaEn(null)}
                    />
                  )}

                  {publicacionesEn === clase.id && (
                    <ListaAsignacionesClase360
                      filas={asignacionesPorClase[clase.id] ?? []}
                    />
                  )}

                  {asistenciaEn === clase.id && (
                    <AsistenciaClase360
                      materiaId={clase.id}
                      sesiones={asistencia.sesiones[clase.id] ?? []}
                      marcas={asistencia.marcas}
                      periodos={asistencia.periodos[clase.id] ?? []}
                      puedeProgramar={puedeProgramar}
                    />
                  )}

                  {abierto === clase.id && (
                    <TablaInscritos
                      filas={inscritosPorClase[clase.id] ?? []}
                      puedeCalificar={puedeCalificar}
                    />
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

/**
 * Los inscritos de una clase: cumplimiento, nota propuesta y nota final.
 *
 * La propuesta va al lado del campo de la nota porque es de donde el docente la
 * saca, pero no la rellena sola: la nota final puede pesar un examen o la
 * participación, y eso lo decide quien da la clase.
 */
function TablaInscritos({
  filas,
  puedeCalificar,
}: {
  filas: readonly InscritoEn360[];
  puedeCalificar: boolean;
}) {
  const t = useTranslations("academic.classes360");

  if (filas.length === 0) {
    return (
      <p className="text-tinta-3 border-linea mt-3 border-t pt-3 text-center text-xs">
        {t("noStudents")}
      </p>
    );
  }

  return (
    <div className="border-linea mt-3 border-t pt-3">
      <ul className="space-y-1.5">
        {filas.map((fila) => (
          <FilaInscrito key={fila.id} fila={fila} puedeCalificar={puedeCalificar} />
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
  const t = useTranslations("academic.classes360");
  const [estado, enviar, enviando] = useActionState<EstadoAcademico, FormData>(
    revisarEntrega,
    { estado: "inicial" },
  );

  return (
    <li className="space-y-2 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{entrega.estudiante}</p>
          <p className="text-tinta-3 truncate text-xs">
            {entrega.asignacion} · {entrega.unidad}
          </p>
        </div>

        {/* El enlace lo firma el servidor y caduca: el bucket es privado. */}
        {entrega.enlace && (
          <a
            href={entrega.enlace}
            target="_blank"
            rel="noopener noreferrer"
            className="text-marca-600 inline-flex shrink-0 items-center gap-1 text-xs font-semibold hover:underline"
          >
            <ExternalLink className="size-3.5" />
            {t("openFile")}
          </a>
        )}
      </div>

      {entrega.texto_respuesta && (
        <blockquote className="max-h-48 overflow-y-auto rounded-control bg-muted/50 p-3 text-sm whitespace-pre-line text-tinta">
          {entrega.texto_respuesta}
        </blockquote>
      )}

      <form action={enviar} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="id" value={entrega.id} />

        <label className="flex flex-col gap-1">
          <span className="text-tinta-3 text-[11px] font-medium">
            {t("grade")} · {t("gradeMax", { max: entrega.puntaje_maximo })}
          </span>
          <Input
            name="nota"
            type="number"
            min={0}
            max={entrega.puntaje_maximo}
            step="0.1"
            defaultValue={entrega.calificacion ?? ""}
            className="h-8 w-24 text-xs"
            aria-invalid={estado.estado === "nota_invalida" || undefined}
          />
        </label>

        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-tinta-3 text-[11px] font-medium">{t("comment")}</span>
          <Input
            name="comentario"
            defaultValue={entrega.comentario_profesor ?? ""}
            maxLength={900}
            className="h-8 text-xs"
          />
        </label>

        <Button type="submit" size="sm" disabled={enviando}>
          {enviando ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Save className="size-3.5" />
          )}
          {t("review")}
        </Button>
      </form>

      {estado.estado === "ok" && (
        <p className="text-marca-600 text-[11px] font-medium">{t("reviewed")}</p>
      )}

      {estado.estado !== "inicial" && estado.estado !== "ok" && (
        <p role="alert" className="text-destructive text-[11px]">
          {estado.estado === "nota_invalida"
            ? t("errGradeScale", { max: entrega.puntaje_maximo })
            : estado.estado === "no_encontrado"
              ? t("errOwner")
              : t("errGeneric")}
        </p>
      )}
    </li>
  );
}

/** Publicar una tarea o examen en una clase de 360. */
function FormularioTarea({
  materiaId,
  periodos,
  alTerminar,
}: {
  materiaId: string;
  periodos: readonly PeriodoParaTarea[];
  alTerminar: () => void;
}) {
  const t = useTranslations("academic.classes360");
  const [estado, enviar, enviando] = useActionState<EstadoAcademico, FormData>(
    async (previo, datos) => {
      const resultado = await publicarTarea(previo, datos);
      if (resultado.estado === "ok") alTerminar();
      return resultado;
    },
    { estado: "inicial" },
  );

  // Sin inscritos no hay período donde publicar y el botón queda inactivo: se
  // dice por qué, o parece que no funciona.
  if (periodos.length === 0) {
    return (
      <p
        role="status"
        className="border-linea text-tinta-2 mt-3 flex items-center gap-2 border-t pt-3 text-xs"
      >
        <Info className="size-4 shrink-0" aria-hidden />
        {t("errNoPeriod")}
      </p>
    );
  }

  return (
    <form action={enviar} className="border-linea mt-3 space-y-3 border-t pt-3">
      <input type="hidden" name="materia" value={materiaId} />

      <FormularioGuiado>
        <PasoFormulario titulo={t("pasos.tarea")}>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor={`t-titulo-${materiaId}`}>{t("taskTitle")}</Label>
              <Input id={`t-titulo-${materiaId}`} name="titulo" required maxLength={160} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`t-tipo-${materiaId}`}>{t("taskType")}</Label>
              <select id={`t-tipo-${materiaId}`} name="tipo" className={SELECTOR}>
                <option value="tarea">{t("taskTypeTask")}</option>
                <option value="examen">{t("taskTypeExam")}</option>
                <option value="material">{t("taskTypeMaterial")}</option>
                <option value="anuncio">{t("taskTypeAnnouncement")}</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`t-vence-${materiaId}`}>{t("taskDue")}</Label>
              <Input id={`t-vence-${materiaId}`} name="vence" type="datetime-local" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`t-desc-${materiaId}`}>{t("taskDescription")}</Label>
            <Textarea id={`t-desc-${materiaId}`} name="descripcion" maxLength={900} rows={2} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`t-url-${materiaId}`}>{t("taskResourceUrl")}</Label>
            <Input
              id={`t-url-${materiaId}`}
              name="archivo_url"
              type="url"
              placeholder="https://..."
              maxLength={500}
            />
          </div>
        </PasoFormulario>

        <PasoFormulario titulo={t("pasos.evaluacion")}>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor={`t-periodo-${materiaId}`}>{t("taskPeriod")}</Label>
              <select
                id={`t-periodo-${materiaId}`}
                name="periodo"
                required
                defaultValue={(periodos.find((p) => p.vigente) ?? periodos[0])?.id}
                className={SELECTOR}
              >
                {periodos.map((periodo) => (
                  <option key={periodo.id} value={periodo.id}>
                    {periodo.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`t-peso-${materiaId}`}>{t("taskWeight")}</Label>
              <Input
                id={`t-peso-${materiaId}`}
                name="peso"
                type="number"
                min={0.01}
                max={100}
                step="0.01"
                defaultValue={1}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`t-puntos-${materiaId}`}>{t("taskMaxPoints")}</Label>
              <Input
                id={`t-puntos-${materiaId}`}
                name="puntaje_maximo"
                type="number"
                min={1}
                max={1000}
                defaultValue={100}
              />
            </div>
          </div>
        </PasoFormulario>

        <PasoFormulario titulo={t("pasos.entrega")}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`t-limite-${materiaId}`}>{t("taskMaxMb")}</Label>
              <Input
                id={`t-limite-${materiaId}`}
                name="limite_mb"
                type="number"
                min={1}
                max={100}
                defaultValue={15}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`t-formatos-${materiaId}`}>{t("taskFormats")}</Label>
              <Input
                id={`t-formatos-${materiaId}`}
                name="formatos_permitidos"
                defaultValue="pdf, docx, jpg, png"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`t-instrucciones-${materiaId}`}>{t("taskRubric")}</Label>
            <Textarea
              id={`t-instrucciones-${materiaId}`}
              name="instrucciones_entrega"
              placeholder={t("taskRubricPlaceholder")}
              maxLength={1500}
              rows={2}
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              name="permite_entregas_tardias"
              value="true"
              defaultChecked
              className="border-input text-marca-600 focus:ring-ring size-4 rounded"
            />
            <span className="text-tinta-2 text-xs">{t("taskAllowLate")}</span>
          </label>
        </PasoFormulario>

        {estado.estado !== "inicial" && estado.estado !== "ok" && (
          <p role="alert" className="text-destructive text-xs">
            {estado.estado === "nombre_vacio"
              ? t("taskTitleRequired")
              : estado.estado === "no_encontrado"
                ? t("errOwner")
                : estado.estado === "invalido" && periodos.length === 0
                  ? t("errNoPeriod")
                : t("errGeneric")}
          </p>
        )}

        <AccionesFormulario>
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={enviando || periodos.length === 0}>
              {enviando && <Loader2 className="size-3.5 animate-spin" />}
              {t("newTask")}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={alTerminar}>
              {t("cancel")}
            </Button>
          </div>
        </AccionesFormulario>
      </FormularioGuiado>
    </form>
  );
}

/**
 * Lista de publicaciones (tareas, exámenes, materiales y anuncios) de una clase
 * de 360, con su conteo de entregas, enlace de recurso y botón de eliminar.
 */
function ListaAsignacionesClase360({
  filas,
}: {
  filas: readonly AsignacionDeClase360[];
}) {
  const t = useTranslations("academic.classes360");
  const [borrandoId, setBorrandoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enCurso, iniciarTransicion] = useTransition();

  const etiquetaTipo = (tipo: AsignacionDeClase360["tipo"]) => {
    switch (tipo) {
      case "examen":
        return t("taskTypeExam");
      case "material":
        return t("taskTypeMaterial");
      case "anuncio":
        return t("taskTypeAnnouncement");
      default:
        return t("taskTypeTask");
    }
  };

  function eliminar(id: string) {
    setError(null);
    setBorrandoId(id);
    iniciarTransicion(async () => {
      const res = await borrarAsignacion360(id);
      if (res.estado !== "ok") {
        setError(res.estado === "no_encontrado" ? t("errOwner") : t("errGeneric"));
      }
      setBorrandoId(null);
    });
  }

  if (filas.length === 0) {
    return (
      <p className="text-tinta-3 border-linea mt-3 border-t pt-3 text-center text-xs">
        {t("noTasks")}
      </p>
    );
  }

  return (
    <div className="border-linea mt-3 space-y-2 border-t pt-3">
      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
      <ul className="space-y-1.5">
        {filas.map((fila) => {
          const evaluable = fila.tipo === "tarea" || fila.tipo === "examen";
          return (
            <li
              key={fila.id}
              className="bg-muted/40 rounded-control flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs"
            >
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="truncate font-medium text-tinta">
                    {fila.titulo}
                  </span>
                  <Badge className="bg-marca-500/15 text-marca-600 text-[10px]">
                    {etiquetaTipo(fila.tipo)}
                  </Badge>
                </div>
                <p className="text-tinta-3 truncate text-[11px]">
                  {[
                    fila.periodo,
                    fila.fecha_vencimiento
                      ? `${t("taskDue")}: ${fila.fecha_vencimiento}`
                      : null,
                    evaluable
                      ? `${t("taskWeight")}: ${fila.peso} · ${t("gradeMax", { max: fila.puntaje_maximo })}`
                      : null,
                    evaluable
                      ? t("submissionsCount", { n: fila.entregas })
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                {fila.archivo_url && (
                  <a
                    href={fila.archivo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-marca-600 inline-flex items-center gap-1 text-xs font-medium hover:underline"
                  >
                    <ExternalLink className="size-3.5" />
                    {t("openFile")}
                  </a>
                )}

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={enCurso && borrandoId === fila.id}
                  title={t("deleteTask")}
                  aria-label={t("deleteTask")}
                  onClick={() => eliminar(fila.id)}
                >
                  {enCurso && borrandoId === fila.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="size-3.5" />
                  )}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
