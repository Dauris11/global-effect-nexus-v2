"use client";

import { useActionState, useState, useTransition } from "react";
import {
  Calculator,
  CalendarCheck,
  ExternalLink,
  FileText,
  GraduationCap,
  Library,
  Loader2,
  Plus,
  Save,
  Trash2,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { AsistenciaClase360 } from "@/components/academico/asistencia-clase-360";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Dato, FilaDatos } from "@/components/ui/dato";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NOTA_APROBADA } from "@/lib/notas";
import { CUADRO } from "@/lib/paleta";
import { cn } from "@/lib/utils";
import { calificarEntregaMoodleAction } from "@/server/moodle/acciones";
import {
  borrarAsignacionMateria,
  calificarInscripcionMateria,
  publicarTareaMateria,
  type EstadoAcademico,
} from "@/server/profesor/acciones";
import {
  borrarSesionMateria,
  guardarSesionMateria,
  marcarAsistenciaMateria,
} from "@/server/profesor/acciones-asistencia";
import type { AsistenciaDeClases } from "@/server/profesor/asistencia";
import type {
  AsignacionDeClase360,
  EntregaPorRevisar,
  InscritoEnMateria,
  MateriaDelDocente,
} from "@/server/profesor/consultas";

export type EntregaConEnlace = EntregaPorRevisar & {
  asignacion_id: string;
  enlace: string | null;
};

type SeccionMateria = "asistencia" | "alumnos" | "tarea" | "publicaciones";

const SELECTOR =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 rounded-control h-9 w-full border bg-card px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]";

/**
 * Gestión de las materias asignadas al profesor:
 * bandeja de entregas por revisar, ver alumnos inscritos, pasar lista,
 * publicar tareas/materiales/anuncios, revisar entregas y cerrar nota final.
 */
export function GestionMateriasDocente({
  materias,
  inscritosPorMateria,
  asignacionesPorMateria,
  entregas,
  asistencia,
  materiaInicialId,
  seccionInicial,
}: {
  materias: readonly MateriaDelDocente[];
  inscritosPorMateria: Record<string, InscritoEnMateria[]>;
  asignacionesPorMateria: Record<string, AsignacionDeClase360[]>;
  entregas: readonly EntregaConEnlace[];
  asistencia: AsistenciaDeClases;
  materiaInicialId?: string;
  seccionInicial?: SeccionMateria;
}) {
  const t = useTranslations("academic.classes360");
  const tProf = useTranslations("teacherPortal.assignedSubjects");

  const [abierta, setAbierta] = useState<string | null>(
    materiaInicialId && materias.some((m) => m.id === materiaInicialId)
      ? materiaInicialId
      : materias[0]?.id ?? null,
  );
  const [seccion, setSeccion] = useState<Record<string, SeccionMateria>>(() =>
    materiaInicialId && seccionInicial
      ? { [materiaInicialId]: seccionInicial }
      : {},
  );

  const entregasPendientes = entregas.filter(
    (e) => e.estado === "entregado" || e.estado === "tarde",
  );

  if (materias.length === 0) {
    return (
      <EstadoVacio
        icono={Library}
        titulo={tProf("emptyTitle")}
        texto={tProf("emptyHint")}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* ── 1. Bandeja de entregas pendientes de calificar en materias asignadas ── */}
      <Card>
        <CardContent className="pt-5">
          <CardTitle className="mb-3">
            <GraduationCap className="size-4" />
            {t("toReview")}
            {entregasPendientes.length > 0 && (
              <Badge className="ml-1 bg-tinta text-[10px] text-background">
                {entregasPendientes.length}
              </Badge>
            )}
          </CardTitle>

          {entregasPendientes.length === 0 ? (
            <p className="py-4 text-center text-sm text-tinta-3">
              {t("reviewEmpty")}
            </p>
          ) : (
            <ul className="space-y-2">
              {entregasPendientes.map((entrega) => (
                <FilaEntregaMateria
                  key={entrega.id}
                  entrega={entrega}
                  mostrarMateria
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ── 2. Materias asignadas al profesor ── */}
      <div className="space-y-4">
        {materias.map((materia) => {
          const estaAbierta = abierta === materia.id;
          const tabActiva: SeccionMateria = seccion[materia.id] ?? "asistencia";
          const inscritos = inscritosPorMateria[materia.id] ?? [];
          const asignaciones = asignacionesPorMateria[materia.id] ?? [];
          const sesiones = asistencia.sesiones[materia.id] ?? [];
          const periodosAsistencia =
            asistencia.periodos[materia.id] &&
            asistencia.periodos[materia.id].length > 0
              ? asistencia.periodos[materia.id]
              : materia.periodo_id &&
                  materia.periodo &&
                  materia.periodo_inicio &&
                  materia.periodo_fin
                ? [
                    {
                      id: materia.periodo_id,
                      nombre: materia.periodo,
                      fecha_inicio: materia.periodo_inicio,
                      fecha_fin: materia.periodo_fin,
                    },
                  ]
                : [];

          return (
            <Card
              key={materia.id}
              id={`materia-${materia.id}`}
              className="scroll-mt-16"
            >
              <CardContent className="pt-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-control",
                        CUADRO.marca,
                      )}
                    >
                      <Library className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-base">
                          {materia.nombre}
                        </CardTitle>
                        {materia.codigo && (
                          <Badge
                            variant="outline"
                            className="font-mono text-[11px]"
                          >
                            {materia.codigo}
                          </Badge>
                        )}
                        <Badge className="bg-marca-500/15 text-[11px] text-marca-700">
                          {materia.periodo ?? tProf("noTerm")}
                        </Badge>
                      </div>
                      <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-tinta-3">
                        <span>
                          {[materia.horario, materia.aula]
                            .filter(Boolean)
                            .join(" · ") || tProf("noSchedule")}
                        </span>
                        <span>
                          {tProf("studentsCount", { count: inscritos.length })}
                        </span>
                        <span>
                          {t("tasks")}: <b>{asignaciones.length}</b>
                        </span>
                        <span>
                          {t("withGrade")}: <b>{materia.con_nota}</b>
                        </span>
                        <span>
                          {t("average")}:{" "}
                          <b>{materia.promedio?.toFixed(1) ?? "—"}</b>
                        </span>
                      </p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant={estaAbierta ? "secondary" : "outline"}
                    onClick={() => setAbierta(estaAbierta ? null : materia.id)}
                  >
                    {estaAbierta ? tProf("collapse") : tProf("manage")}
                  </Button>
                </div>

                {estaAbierta && (
                  <div className="mt-4 space-y-4 border-t border-linea pt-4">
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          {
                            id: "asistencia",
                            label: tProf("tabs.attendance"),
                            icono: CalendarCheck,
                          },
                          {
                            id: "tarea",
                            label: tProf("tabs.assignTask"),
                            icono: Plus,
                          },
                          {
                            id: "publicaciones",
                            label: `${tProf("tabs.posts")} (${asignaciones.length})`,
                            icono: FileText,
                          },
                          {
                            id: "alumnos",
                            label: `${tProf("tabs.students")} (${inscritos.length})`,
                            icono: Users,
                          },
                        ] as const
                      ).map((tab) => {
                        const Icono = tab.icono;
                        const activa = tabActiva === tab.id;
                        return (
                          <Button
                            key={tab.id}
                            type="button"
                            size="sm"
                            variant={activa ? "default" : "outline"}
                            onClick={() =>
                              setSeccion((prev) => ({
                                ...prev,
                                [materia.id]: tab.id,
                              }))
                            }
                          >
                            <Icono className="size-3.5" />
                            {tab.label}
                          </Button>
                        );
                      })}
                    </div>

                    {tabActiva === "asistencia" && (
                      <AsistenciaClase360
                        materiaId={materia.id}
                        sesiones={sesiones}
                        marcas={asistencia.marcas}
                        periodos={periodosAsistencia}
                        puedeProgramar
                        acciones={{
                          guardar: guardarSesionMateria,
                          borrar: borrarSesionMateria,
                          marcar: marcarAsistenciaMateria,
                        }}
                      />
                    )}

                    {tabActiva === "tarea" && (
                      <FormularioTareaMateria
                        materiaId={materia.id}
                        hayInscritos={inscritos.length > 0}
                      />
                    )}

                    {tabActiva === "publicaciones" && (
                      <ListaPublicacionesMateria
                        asignaciones={asignaciones}
                        entregas={entregas}
                      />
                    )}

                    {tabActiva === "alumnos" && (
                      <ListaInscritosMateria inscritos={inscritos} />
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function FormularioTareaMateria({
  materiaId,
  hayInscritos,
}: {
  materiaId: string;
  hayInscritos: boolean;
}) {
  const t = useTranslations("academic.classes360");
  const tProf = useTranslations("teacherPortal.assignedSubjects");
  const [estado, accion, enviando] = useActionState<EstadoAcademico, FormData>(
    publicarTareaMateria,
    { estado: "inicial" },
  );

  if (!hayInscritos) {
    return (
      <p className="py-3 text-center text-xs text-tinta-3">
        {tProf("noStudentsForTask")}
      </p>
    );
  }

  return (
    <form
      key={estado.estado === "ok" ? "publicada" : "nueva"}
      action={accion}
      className="space-y-3 rounded-card bg-muted/40 p-4"
    >
      <input type="hidden" name="materia" value={materiaId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`titulo-${materiaId}`}>{t("taskTitle")}</Label>
          <Input
            id={`titulo-${materiaId}`}
            name="titulo"
            required
            maxLength={160}
            placeholder={tProf("taskTitlePlaceholder")}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor={`tipo-${materiaId}`}>{t("taskType")}</Label>
          <select
            id={`tipo-${materiaId}`}
            name="tipo"
            className={SELECTOR}
            defaultValue="tarea"
          >
            <option value="tarea">{tProf("types.tarea")}</option>
            <option value="examen">{tProf("types.examen")}</option>
            <option value="material">{tProf("types.material")}</option>
            <option value="anuncio">{tProf("types.anuncio")}</option>
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor={`desc-${materiaId}`}>{t("taskDescription")}</Label>
        <Textarea
          id={`desc-${materiaId}`}
          name="descripcion"
          rows={2}
          maxLength={900}
          placeholder={tProf("taskDescriptionPlaceholder")}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`url-${materiaId}`}>{t("taskResourceUrl")}</Label>
          <Input
            id={`url-${materiaId}`}
            name="archivo_url"
            type="url"
            placeholder="https://..."
            maxLength={500}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor={`vence-${materiaId}`}>{t("taskDue")}</Label>
          <Input id={`vence-${materiaId}`} name="vence" type="datetime-local" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="space-y-1">
          <Label htmlFor={`puntaje-${materiaId}`}>{t("taskMaxPoints")}</Label>
          <Input
            id={`puntaje-${materiaId}`}
            name="puntaje_maximo"
            type="number"
            min={1}
            max={1000}
            defaultValue={100}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`peso-${materiaId}`}>{t("taskWeight")}</Label>
          <Input
            id={`peso-${materiaId}`}
            name="peso"
            type="number"
            min={0.1}
            max={100}
            step="0.1"
            defaultValue={1}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`limite-${materiaId}`}>{t("taskMaxMb")}</Label>
          <Input
            id={`limite-${materiaId}`}
            name="limite_mb"
            type="number"
            min={1}
            max={100}
            defaultValue={15}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`formatos-${materiaId}`}>{t("taskFormats")}</Label>
          <Input
            id={`formatos-${materiaId}`}
            name="formatos_permitidos"
            defaultValue="pdf, docx, jpg, png"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor={`rubrica-${materiaId}`}>{t("taskRubric")}</Label>
        <Textarea
          id={`rubrica-${materiaId}`}
          name="instrucciones_entrega"
          rows={2}
          maxLength={1500}
          placeholder={t("taskRubricPlaceholder")}
        />
      </div>

      <label className="flex cursor-pointer items-center gap-2 pt-0.5">
        <input
          type="checkbox"
          name="permite_entregas_tardias"
          value="true"
          defaultChecked
          className="size-4 rounded border-input text-marca-600 focus:ring-ring"
        />
        <span className="text-xs text-tinta-2">{t("taskAllowLate")}</span>
      </label>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="text-xs">
          {estado.estado === "ok" && (
            <span className="font-medium text-marca-700">
              {tProf("taskPublished")}
            </span>
          )}
          {estado.estado !== "inicial" && estado.estado !== "ok" && (
            <span className="font-medium text-destructive">
              {tProf("taskError")}
            </span>
          )}
        </div>
        <Button type="submit" size="sm" disabled={enviando}>
          {enviando ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Save className="size-3.5" />
          )}
          {tProf("publishTask")}
        </Button>
      </div>
    </form>
  );
}

function ListaPublicacionesMateria({
  asignaciones,
  entregas,
}: {
  asignaciones: readonly AsignacionDeClase360[];
  entregas: readonly EntregaConEnlace[];
}) {
  const t = useTranslations("academic.classes360");
  const tProf = useTranslations("teacherPortal.assignedSubjects");
  const [abierta, setAbierta] = useState<string | null>(() => {
    const conPendientes = asignaciones.find((item) =>
      entregas.some(
        (e) =>
          e.asignacion_id === item.id &&
          (e.estado === "entregado" || e.estado === "tarde"),
      ),
    );
    return conPendientes?.id ?? null;
  });
  const [borrando, iniciarBorrado] = useTransition();

  if (asignaciones.length === 0) {
    return (
      <p className="py-3 text-center text-xs text-tinta-3">{tProf("noPosts")}</p>
    );
  }

  return (
    <ul className="space-y-3">
      {asignaciones.map((item) => {
        const entregasItem = entregas.filter((e) => e.asignacion_id === item.id);
        const expandida = abierta === item.id;
        const evaluable = item.tipo === "tarea" || item.tipo === "examen";

        return (
          <li key={item.id} className="rounded-card bg-muted/40 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    {tProf(`types.${item.tipo}`)}
                  </Badge>
                  <p className="text-sm font-semibold">{item.titulo}</p>
                </div>
                {item.descripcion && (
                  <p className="mt-1 text-xs text-tinta-2">{item.descripcion}</p>
                )}
                <p className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-tinta-3">
                  {item.fecha_vencimiento && (
                    <span>
                      {tProf("dueAt")}: {item.fecha_vencimiento}
                    </span>
                  )}
                  {evaluable && (
                    <span>
                      {t("taskWeight")}: {item.peso} ·{" "}
                      {t("gradeMax", { max: item.puntaje_maximo })}
                    </span>
                  )}
                  {evaluable && (
                    <span>
                      {tProf("submissionsCount", { count: entregasItem.length })}
                    </span>
                  )}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                {item.archivo_url && (
                  <a
                    href={item.archivo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-marca-600 hover:underline"
                  >
                    <ExternalLink className="size-3.5" />
                    {t("openFile")}
                  </a>
                )}

                {entregasItem.length > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setAbierta(expandida ? null : item.id)}
                  >
                    {expandida
                      ? tProf("hideSubmissions")
                      : `${tProf("viewSubmissions")} (${entregasItem.length})`}
                  </Button>
                )}
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={borrando}
                  title={tProf("deletePost")}
                  aria-label={tProf("deletePost")}
                  onClick={() => {
                    iniciarBorrado(async () => {
                      await borrarAsignacionMateria(item.id);
                    });
                  }}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>

            {expandida && entregasItem.length > 0 && (
              <ul className="mt-3 space-y-2 border-t border-linea pt-3">
                {entregasItem.map((entrega) => (
                  <FilaEntregaMateria key={entrega.id} entrega={entrega} />
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function FilaEntregaMateria({
  entrega,
  mostrarMateria = false,
}: {
  entrega: EntregaConEnlace;
  mostrarMateria?: boolean;
}) {
  const tProf = useTranslations("teacherPortal.assignedSubjects");
  const [nota, setNota] = useState(
    entrega.calificacion !== null ? String(entrega.calificacion) : "",
  );
  const [comentario, setComentario] = useState(
    entrega.comentario_profesor ?? "",
  );
  const [guardando, iniciar] = useTransition();
  const [estado, setEstado] = useState<string | null>(null);

  function guardar() {
    setEstado(null);
    iniciar(async () => {
      const fd = new FormData();
      fd.set("entrega_id", entrega.id);
      fd.set("calificacion", nota);
      fd.set("comentario_profesor", comentario);
      const res = await calificarEntregaMoodleAction(fd);
      setEstado(res.ok ? "ok" : (res.mensaje ?? "error"));
    });
  }

  return (
    <li className="space-y-2 rounded-control border border-linea bg-card p-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-tinta">{entrega.estudiante}</p>
          {mostrarMateria && (
            <p className="text-[11px] text-tinta-3">
              {entrega.asignacion} · {entrega.unidad}
            </p>
          )}
          {entrega.texto_respuesta && (
            <p className="mt-1 whitespace-pre-wrap text-tinta-2">
              {entrega.texto_respuesta}
            </p>
          )}
        </div>
        {entrega.enlace && (
          <a
            href={entrega.enlace}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-medium text-marca-600 underline"
          >
            {tProf("openAttachment")}
            <ExternalLink className="size-3" />
          </a>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-[110px_1fr_auto]">
        <Input
          type="number"
          min={0}
          max={entrega.puntaje_maximo}
          step="0.5"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder={`/ ${entrega.puntaje_maximo}`}
          className="h-8 text-xs"
        />
        <Input
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          placeholder={tProf("feedbackPlaceholder")}
          className="h-8 text-xs"
        />
        <Button
          type="button"
          size="sm"
          className="h-8"
          disabled={guardando}
          onClick={guardar}
        >
          {guardando ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Save className="size-3" />
          )}
          {tProf("grade")}
        </Button>
      </div>
      {estado === "ok" && (
        <p className="font-medium text-marca-700">{tProf("graded")}</p>
      )}
      {estado && estado !== "ok" && (
        <p className="font-medium text-destructive">{tProf("gradeError")}</p>
      )}
    </li>
  );
}

function ListaInscritosMateria({
  inscritos,
}: {
  inscritos: readonly InscritoEnMateria[];
}) {
  const tProf = useTranslations("teacherPortal.assignedSubjects");

  if (inscritos.length === 0) {
    return (
      <p className="py-3 text-center text-xs text-tinta-3">
        {tProf("noStudents")}
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {inscritos.map((est) => (
        <FilaInscritoMateria key={est.id} est={est} />
      ))}
    </ul>
  );
}

function FilaInscritoMateria({ est }: { est: InscritoEnMateria }) {
  const t = useTranslations("academic.classes360");
  const tProf = useTranslations("teacherPortal.assignedSubjects");
  const [estado, accion, guardando] = useActionState<EstadoAcademico, FormData>(
    calificarInscripcionMateria,
    { estado: "inicial" },
  );

  const [nota, setNota] = useState(
    est.nota_final !== null ? String(est.nota_final) : "",
  );
  const [decisionManual, setDecisionManual] = useState<
    "activa" | "aprobada" | "reprobada" | null
  >(
    est.estado === "aprobada" || est.estado === "reprobada"
      ? est.estado
      : null,
  );

  const valorNumerico = nota.trim() === "" ? null : Number(nota);
  const decisionSugerida: "activa" | "aprobada" | "reprobada" =
    valorNumerico === null || !Number.isFinite(valorNumerico)
      ? "activa"
      : valorNumerico >= NOTA_APROBADA
        ? "aprobada"
        : "reprobada";
  const decisionEfectiva = decisionManual ?? decisionSugerida;

  return (
    <li className="space-y-2 rounded-control bg-muted/40 px-3 py-2.5 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-tinta">
            {est.nombre}
          </p>
          <p className="text-xs text-tinta-3">
            {est.periodo ?? tProf("noTerm")}
          </p>
        </div>

        <Badge
          className={cn(
            "text-[10px]",
            est.tareas > 0 && est.entregadas >= est.tareas
              ? "bg-marca-700 text-white"
              : "bg-marca-500/15 text-marca-600",
          )}
        >
          {t("compliance")}: {est.entregadas}/{est.tareas}
        </Badge>
      </div>

      <FilaDatos>
        <Dato icono={Calculator} className="text-xs">
          {t("proposedGrade")}: <b>{est.notaPropuesta?.toFixed(1) ?? "—"}</b>
        </Dato>
        {est.asistenciaPorcentaje !== null && (
          <Dato icono={CalendarCheck} className="text-xs">
            {tProf("attendancePct", { pct: est.asistenciaPorcentaje })}
          </Dato>
        )}
      </FilaDatos>

      <form
        action={accion}
        className="flex flex-wrap items-center justify-between gap-2 pt-0.5"
      >
        <input type="hidden" name="inscripcion" value={est.id} />

        <div className="flex flex-wrap items-center gap-2">
          <Input
            name="nota"
            type="number"
            min={0}
            max={100}
            step="0.5"
            value={nota}
            onChange={(e) => {
              setNota(e.target.value);
              setDecisionManual(null);
            }}
            placeholder={tProf("finalGradePlaceholder")}
            className="h-8 w-24 text-xs"
          />

          {est.notaPropuesta !== null && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 text-xs"
              onClick={() => {
                setNota(String(est.notaPropuesta));
                setDecisionManual(null);
              }}
            >
              {t("useProposal")}
            </Button>
          )}

          <select
            name="decision"
            value={decisionEfectiva}
            onChange={(e) =>
              setDecisionManual(
                e.target.value as "activa" | "aprobada" | "reprobada",
              )
            }
            className="h-8 rounded-control border border-input bg-card px-2 text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <option value="activa">{tProf("statusActive")}</option>
            <option value="aprobada">{tProf("statusApproved")}</option>
            <option value="reprobada">{tProf("statusFailed")}</option>
          </select>

          <Button
            type="submit"
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            disabled={guardando}
          >
            {guardando ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Save className="size-3" />
            )}
            {tProf("saveFinalGrade")}
          </Button>
        </div>
      </form>

      {estado.estado === "ok" && (
        <p className="mt-1 text-xs font-medium text-marca-700">
          {tProf("finalGradeSaved")}
        </p>
      )}
      {estado.estado !== "inicial" && estado.estado !== "ok" && (
        <p className="mt-1 text-xs font-medium text-destructive">
          {tProf("finalGradeError")}
        </p>
      )}
    </li>
  );
}
