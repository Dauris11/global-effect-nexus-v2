"use client";

import { useActionState, useState, useTransition } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Clock,
  Layers,
  Library,
  Loader2,
  MapPin,
  Plus,
  Save,
  User,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { AccionesFila } from "@/components/academico/acciones-fila";
import { CifraAcademica } from "@/components/academico/cifra";
import { GraficaAnillo, GraficaBarras } from "@/components/dashboard/graficas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AccionesFormulario,
  FormularioGuiado,
  PasoFormulario,
} from "@/components/ui/formulario-guiado";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ALERTA_RIESGO,
  ANIMACION,
  AZUL,
  AZUL_OSCURO,
  AZUL_SUAVE,
  CUADRO,
  NEUTRO,
  VACIO,
} from "@/lib/paleta";
import { cn } from "@/lib/utils";
import {
  asignarDocenteMateria,
  eliminarMateria,
  guardarMateria,
  type EstadoCatalogo,
} from "@/server/academico/acciones";
import type {
  DocenteAsignable,
  MateriaGestionada,
  PeriodoSimple,
} from "@/server/academico/consultas";

/** Clase del desplegable nativo, repetida tal cual en el resto del proyecto. */
const SELECT =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-card px-2 text-base shadow-xs outline-none focus-visible:ring-[3px] sm:text-sm";

/**
 * El catálogo de materias universitarias: qué se ofrece, en qué período y quién
 * lo imparte.
 *
 * Son las materias de la CARRERA del becado. Las de Global Effect 360 tienen su
 * catálogo en Prematrícula y sus clases en `/academico/clases-360`: dos
 * programas distintos que esta pantalla no mezcla, porque quien administra uno
 * no necesariamente administra el otro.
 *
 * El filtro y la búsqueda no están aquí: los lleva la URL desde la página de
 * servidor. Así el enlace se puede compartir y recargar sin perder lo que se
 * estaba mirando, y la lista se recorta en SQL en vez de traer el catálogo
 * entero para esconder la mayoría.
 *
 * Las cifras de arriba se calculan sobre LO QUE SE VE, filtro incluido. Es lo
 * contrario de lo que hace el portal del estudiante con su índice —allí las
 * cifras son siempre del historial completo— y por una razón concreta: aquí no
 * hay ninguna cifra acumulada que decida nada, y "créditos activos" con un
 * período elegido significa exactamente lo que se quiere saber, cuánto pesa ese
 * cuatrimestre.
 */
export function GestionMaterias({
  modo = "gestion",
  materias,
  periodos,
  docentes,
  puedeEscribir,
  hayFiltro,
}: {
  materias: readonly MateriaGestionada[];
  periodos: readonly PeriodoSimple[];
  docentes: readonly DocenteAsignable[];
  puedeEscribir: boolean;
  /** `reporte`: solo las cifras y gráficas (viven en /reportes/academico); `gestion`: la pantalla de trabajo, sin ellas. */
  modo?: "gestion" | "reporte";
  /** Si la consulta llegó al tope y hay materias sin mostrar. */
  hayMas: boolean;
  /** Si hay búsqueda o período puestos: cambia lo que dice el estado vacío. */
  hayFiltro: boolean;
}) {
  const t = useTranslations("academic");
  const [editando, setEditando] = useState<string | null>(null);
  const [filtroDocente, setFiltroDocente] = useState<"todas" | "con" | "sin">("todas");

  const activas = materias.filter((m) => m.estado === "activa");
  const creditos = activas.reduce((suma, m) => suma + m.creditos, 0);

  const conDocente = activas.filter((m) => Boolean(m.profesor_usuario_id || m.profesor_nombre)).length;
  const sinDocente = activas.filter((m) => !m.profesor_usuario_id && !m.profesor_nombre).length;
  const inactivas = materias.length - activas.length;

  const serieCobertura = [
    { nombre: t("subjects.chartWithTeacher"), valor: conDocente, color: AZUL },
    { nombre: t("subjects.chartNoTeacher"), valor: sinDocente, color: AZUL_OSCURO },
    { nombre: t("subjects.chartInactive"), valor: inactivas, color: NEUTRO },
  ];

  const porDocente = new Map<string, number>();
  for (const m of activas) {
    const nombre = m.profesor_nombre ?? t("subjects.chartNoTeacher");
    porDocente.set(nombre, (porDocente.get(nombre) ?? 0) + 1);
  }
  const serieDocentes = [...porDocente.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([nombre, valor], idx) => ({
      nombre: nombre.length > 20 ? `${nombre.slice(0, 19)}…` : nombre,
      valor,
      color: nombre === t("subjects.chartNoTeacher") ? AZUL_OSCURO : idx === 0 ? AZUL_SUAVE : AZUL,
    }));

  const visibles = materias.filter((m) => {
    const tieneDocente = Boolean(m.profesor_usuario_id || m.profesor_nombre);
    if (filtroDocente === "con") return tieneDocente;
    if (filtroDocente === "sin") return !tieneDocente;
    return true;
  });

  const resumen = (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <CifraAcademica
          valor={materias.length}
          etiqueta={t("subjects.stats.total")}
          icono={Library}
        />
        <CifraAcademica
          valor={activas.length}
          etiqueta={t("subjects.stats.active")}
          icono={CheckCircle2}
          acento
        />
        <CifraAcademica
          valor={creditos}
          etiqueta={t("subjects.stats.credits")}
          icono={Layers}
        />
      </div>

      {materias.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">{t("subjects.chartCoverageTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid items-center gap-3 sm:grid-cols-2">
                <GraficaAnillo
                  datos={serieCobertura}
                  total={materias.length}
                  etiquetaTotal=""
                  vacio={t("subjects.chartEmpty")}
                />
                <ul className="divide-y divide-linea">
                  {serieCobertura.map((fila) => (
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
              <CardTitle className="text-sm font-semibold">{t("subjects.chartTeachersTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <GraficaBarras datos={serieDocentes} vacio={t("subjects.chartEmpty")} />
            </CardContent>
          </Card>
        </div>
      )}

    </>
  );
  if (modo === "reporte") return <div className="space-y-5">{resumen}</div>;

  return (
    <div className={cn("space-y-5", ANIMACION.entrada)}>
      <Card>
        <CardContent className="pt-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <CardTitle>
              <Library className="size-4" />
              {t("subjects.title")}
              <Badge className="ml-1 bg-marca-500/15 text-[10px] text-marca-600">
                {visibles.length}
              </Badge>
            </CardTitle>

            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { id: "todas", label: t("subjects.filterAll"), count: materias.length },
                  {
                    id: "con",
                    label: t("subjects.filterWithTeacher"),
                    count: materias.filter((m) => Boolean(m.profesor_usuario_id || m.profesor_nombre)).length,
                  },
                  {
                    id: "sin",
                    label: t("subjects.filterNoTeacher"),
                    count: materias.filter((m) => !m.profesor_usuario_id && !m.profesor_nombre).length,
                  },
                ] as const
              ).map((chip) => {
                const activo = filtroDocente === chip.id;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setFiltroDocente(chip.id)}
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors",
                      activo
                        ? "border-marca-500 bg-marca-50 text-marca-700"
                        : "border-linea bg-card text-tinta-2 hover:bg-muted/50",
                    )}
                  >
                    <span>{chip.label}</span>
                    <span className="tabular-nums opacity-75">{chip.count}</span>
                  </button>
                );
              })}

              {puedeEscribir && editando !== "nueva" && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setEditando("nueva")}
                >
                  <Plus className="size-3.5" />
                  {t("subjects.new")}
                </Button>
              )}
            </div>
          </div>

          {editando === "nueva" && (
            <FormularioMateria
              periodos={periodos}
              docentes={docentes}
              alTerminar={() => setEditando(null)}
            />
          )}

          {visibles.length === 0 ? (
            <div className={VACIO.contenedor}>
              <span className={VACIO.icono}>
                <Library className="size-6" />
              </span>
              <p className={VACIO.titulo}>
                {hayFiltro || filtroDocente !== "todas" ? t("noMatches") : t("subjects.empty")}
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {(() => {
                const grupos = new Map<string, { nombre: string; items: MateriaGestionada[] }>();
                for (const m of visibles) {
                  const clave = m.periodo_id ?? "__sin_periodo__";
                  const nombre = m.periodo ?? t("subjects.noTermGroup");
                  const grupo = grupos.get(clave) ?? { nombre, items: [] };
                  grupo.items.push(m);
                  grupos.set(clave, grupo);
                }
                return [...grupos.entries()].map(([clave, grupo]) => {
                  const conDoc = grupo.items.filter(
                    (m) => Boolean(m.profesor_usuario_id || m.profesor_nombre),
                  ).length;
                  return (
                    <details
                      key={clave}
                      open
                      className="group/sec rounded-card border border-linea bg-muted/15"
                    >
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-tinta select-none hover:bg-muted/30">
                        <div className="flex items-center gap-2">
                          <Clock className="size-4 text-marca-500" />
                          <span>{grupo.nombre}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-marca-500/15 text-[10px] text-marca-600 tabular-nums">
                            {t("subjects.assignedCount", {
                              con: conDoc,
                              total: grupo.items.length,
                            })}
                          </Badge>
                          <ChevronDown className="size-4 text-tinta-3 transition-transform group-open/sec:rotate-180" />
                        </div>
                      </summary>

                      <ul className="divide-y border-t border-linea bg-card px-4">
                        {grupo.items.map((materia) => (
                          <li key={materia.id} className="group py-3">
                            {editando === materia.id ? (
                              <FormularioMateria
                                materia={materia}
                                periodos={periodos}
                                docentes={docentes}
                                alTerminar={() => setEditando(null)}
                              />
                            ) : (
                              <FilaMateria
                                materia={materia}
                                docentes={docentes}
                                puedeEscribir={puedeEscribir}
                                alEditar={() => setEditando(materia.id)}
                              />
                            )}
                          </li>
                        ))}
                      </ul>
                    </details>
                  );
                });
              })()}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Una materia: nombre, código, asignación rápida de docente, horario y matrícula. */
function FilaMateria({
  materia,
  docentes,
  puedeEscribir,
  alEditar,
}: {
  materia: MateriaGestionada;
  docentes: readonly DocenteAsignable[];
  puedeEscribir: boolean;
  alEditar: () => void;
}) {
  const t = useTranslations("academic");
  const [docenteActual, setDocenteActual] = useState(materia.profesor_usuario_id ?? "");
  const [guardando, iniciar] = useTransition();
  const [errorAsig, setErrorAsig] = useState(false);

  const activa = materia.estado === "activa";

  function cambiarDocente(nuevoId: string) {
    const previo = docenteActual;
    setDocenteActual(nuevoId);
    setErrorAsig(false);
    iniciar(async () => {
      const res = await asignarDocenteMateria(materia.id, nuevoId || null);
      if (!res.ok) {
        setDocenteActual(previo);
        setErrorAsig(true);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-start gap-3">
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-150 group-hover:scale-110",
          activa ? CUADRO.marca : CUADRO.neutro,
        )}
      >
        <Library className="size-4" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="truncate text-sm font-medium">{materia.nombre}</p>

          {materia.codigo && (
            <span className="text-muted-foreground bg-muted/60 rounded px-1.5 py-0.5 font-mono text-[10px]">
              {materia.codigo}
            </span>
          )}
        </div>

        <p className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs">
          <span className="inline-flex items-center gap-1">
            <User className="size-3" />
            {materia.profesor_nombre ?? t("unassigned")}
          </span>

          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" />
            {materia.periodo ?? t("noTerm")}
          </span>

          {materia.aula && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" />
              {materia.aula}
            </span>
          )}
        </p>

        {materia.horario && (
          <p className="text-muted-foreground truncate text-[11px]">
            {materia.horario}
          </p>
        )}

        <p className="text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
          <span className="inline-flex items-center gap-1">
            <Layers className="size-3" />
            {t("subject.credits")}: <b>{materia.creditos}</b>
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="size-3" />
            {t("terms.counts.enrollments")}: <b>{materia.inscritos}</b>
          </span>
          <span className="inline-flex items-center gap-1">
            {t("subjects.tasks")}: <b>{materia.tareas}</b>
          </span>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {puedeEscribir && (
          <div className="flex items-center gap-1.5">
            <select
              aria-label={t("subjects.assignTeacherLabel")}
              value={docenteActual}
              disabled={guardando}
              onChange={(e) => cambiarDocente(e.target.value)}
              className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-8 max-w-44 rounded-md border bg-card px-2 text-xs shadow-xs outline-none focus-visible:ring-[3px]"
            >
              <option value="">{t("subjects.unassignedTeacher")}</option>
              {docentes.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nombre}
                </option>
              ))}
            </select>
            {guardando && <Loader2 className="size-3.5 animate-spin text-marca-500" />}
            {errorAsig && (
              <span className="text-[11px] font-medium text-tinta">
                {t("subjects.assignError")}
              </span>
            )}
          </div>
        )}

        <Badge
          className={cn(
            "shrink-0 text-[10px]",
            activa
              ? "bg-marca-500/15 text-marca-600"
              : "bg-muted text-tinta-2",
          )}
        >
          {t(`subjectStatus.${materia.estado}` as never)}
        </Badge>
      </div>

      {puedeEscribir && (
        <AccionesFila
          id={materia.id}
          nombre={materia.nombre}
          alEditar={alEditar}
          eliminar={eliminarMateria}
        />
      )}
    </div>
  );
}

/** Alta y edición. Sin `materia`, es un alta. */
function FormularioMateria({
  materia,
  periodos,
  docentes,
  alTerminar,
}: {
  materia?: MateriaGestionada;
  periodos: readonly PeriodoSimple[];
  docentes: readonly DocenteAsignable[];
  alTerminar: () => void;
}) {
  const t = useTranslations("academic");
  const [estado, enviar, enviando] = useActionState<EstadoCatalogo, FormData>(
    async (previo, datos) => {
      const resultado = await guardarMateria(previo, datos);
      if (resultado.estado === "ok") alTerminar();
      return resultado;
    },
    { estado: "inicial" },
  );

  /*
   * El profesor, en un solo campo con tres formas: nadie, un usuario, o alguien
   * externo. La materia que ya tenía un nombre pero ninguna cuenta enlazada
   * abre en «externa», que es lo que de verdad es: alguien que da la clase y no
   * entra al sistema. Si abriera en «sin asignar», guardar sin tocar nada le
   * borraría el nombre a quien la imparte.
   */
  const inicial = materia?.profesor_usuario_id
    ? materia.profesor_usuario_id
    : materia?.profesor_nombre
      ? "externo"
      : "";

  const [profesor, setProfesor] = useState(inicial);

  const clave = materia?.id ?? "nueva";

  return (
    <form action={enviar} className="space-y-3 border-t pt-3 first:border-t-0">
      <div>
        <p className="text-sm font-semibold">
          {materia ? t("editSubject.title") : t("newSubject.title")}
        </p>
      </div>

      <input type="hidden" name="id" value={materia?.id ?? ""} />

      <FormularioGuiado>
        <PasoFormulario titulo={t("pasos.materia")}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5 lg:col-span-2">
              <Label htmlFor={`m-nombre-${clave}`}>{t("subject.name")}</Label>
              <Input
                id={`m-nombre-${clave}`}
                name="nombre"
                defaultValue={materia?.nombre}
                placeholder={t("newSubject.namePlaceholder")}
                required
                maxLength={160}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`m-codigo-${clave}`}>{t("subject.code")}</Label>
              <Input
                id={`m-codigo-${clave}`}
                name="codigo"
                defaultValue={materia?.codigo ?? ""}
                placeholder="LID-101"
                maxLength={30}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`m-creditos-${clave}`}>{t("subject.credits")}</Label>
              <Input
                id={`m-creditos-${clave}`}
                name="creditos"
                type="number"
                min={0}
                max={20}
                defaultValue={materia?.creditos ?? 3}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`m-periodo-${clave}`}>{t("subject.term")}</Label>
              <select
                id={`m-periodo-${clave}`}
                name="periodo"
                defaultValue={materia?.periodo_id ?? ""}
                className={SELECT}
              >
                <option value="">{t("noTerm")}</option>
                {periodos.map((periodo) => (
                  <option key={periodo.id} value={periodo.id}>
                    {periodo.nombre} ·{" "}
                    {t(
                      periodo.tipo === "semestre"
                        ? "termKind.semester"
                        : "termKind.quarter",
                    )}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`m-estado-${clave}`}>{t("subject.status")}</Label>
              <select
                id={`m-estado-${clave}`}
                name="estado"
                defaultValue={materia?.estado ?? "activa"}
                className={SELECT}
              >
                {(["activa", "inactiva"] as const).map((valor) => (
                  <option key={valor} value={valor}>
                    {t(`subjectStatus.${valor}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`m-desc-${clave}`}>{t("subject.description")}</Label>
            <Textarea
              id={`m-desc-${clave}`}
              name="descripcion"
              defaultValue={materia?.descripcion ?? ""}
              maxLength={600}
              rows={2}
            />
          </div>
        </PasoFormulario>

        <PasoFormulario titulo={t("pasos.docencia")}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor={`m-profesor-${clave}`}>{t("subject.teacher")}</Label>
              <select
                id={`m-profesor-${clave}`}
                name="profesor"
                value={profesor}
                onChange={(evento) => setProfesor(evento.target.value)}
                className={SELECT}
              >
                <option value="">{t("teacherPicker.unassigned")}</option>
                {docentes.map((docente) => (
                  <option key={docente.id} value={docente.id}>
                    {docente.nombre}
                  </option>
                ))}
                <option value="externo">{t("teacherPicker.external")}</option>
              </select>
            </div>

            {profesor === "externo" && (
              <div className="space-y-1.5">
                <Label htmlFor={`m-externo-${clave}`}>
                  {t("teacherPicker.externalName")}
                </Label>
                <Input
                  id={`m-externo-${clave}`}
                  name="profesor_externo"
                  defaultValue={
                    materia?.profesor_usuario_id ? "" : (materia?.profesor_nombre ?? "")
                  }
                  maxLength={120}
                />
              </div>
            )}

            <div className="space-y-1.5 lg:col-span-2">
              <Label htmlFor={`m-horario-${clave}`}>{t("subject.schedule")}</Label>
              <Input
                id={`m-horario-${clave}`}
                name="horario"
                defaultValue={materia?.horario ?? ""}
                maxLength={120}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`m-aula-${clave}`}>{t("subject.room")}</Label>
              <Input
                id={`m-aula-${clave}`}
                name="aula"
                defaultValue={materia?.aula ?? ""}
                placeholder="Aula A-1"
                maxLength={60}
              />
            </div>
          </div>
        </PasoFormulario>

        {estado.estado !== "inicial" && estado.estado !== "ok" && (
          <p role="alert" className={ALERTA_RIESGO.contenedor}>
            <AlertCircle className={ALERTA_RIESGO.icono} />
            <span className={ALERTA_RIESGO.texto}>
              {estado.estado === "nombre_vacio"
                ? t("newSubject.nameRequired")
                : t("newSubject.error")}
            </span>
          </p>
        )}

        <AccionesFormulario>
          <div className="flex items-center gap-2">
            <Button
              type="submit"
              size="sm"
              cargando={enviando}
            >
              {enviando ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Save className="size-3.5" />
              )}
              {enviando
                ? materia
                  ? t("rowActions.saving")
                  : t("newSubject.creating")
                : materia
                  ? t("rowActions.save")
                  : t("newSubject.create")}
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
