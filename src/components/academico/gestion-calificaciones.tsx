"use client";

import { useActionState, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Plus,
  Save,
  Star,
  User,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { AccionesFila } from "@/components/academico/acciones-fila";
import { CifraAcademica } from "@/components/academico/cifra";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  BANDA_VISUAL,
  BANDAS,
  bandaDe,
  colorDeNota,
  letraDe,
} from "@/lib/notas";
import { ALERTA_RIESGO, ANIMACION, CUADRO, VACIO } from "@/lib/paleta";
import { cn } from "@/lib/utils";
import {
  eliminarCalificacion,
  guardarCalificacion,
  type EstadoCatalogo,
} from "@/server/academico/acciones";
import type {
  NotaRegistrada,
  OpcionSimple,
  PeriodoSimple,
  ResumenNotas,
} from "@/server/academico/consultas";

/** Clase del desplegable nativo, la misma del resto del proyecto. */
const SELECT =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-white px-2 text-base shadow-xs outline-none focus-visible:ring-[3px] sm:text-sm";

/**
 * Calificaciones de los cursos técnicos: registrarlas, corregirlas y leerlas.
 *
 * Son las notas por evaluación de `calificacion`, que cuelga de `curso`. Las del
 * becado universitario están consolidadas por cuatrimestre en
 * `historial_calificacion` y son la materia de `/academico/historial`: aquí no
 * aparecen, y no es un olvido — mezclarlas daría una lista donde media docena de
 * columnas estarían siempre vacías.
 *
 * QUIÉN PUEDE QUÉ, y no coincide con el resto del módulo:
 *
 *   · Registrar y corregir pide `calificaciones.registrar`: `docente` y
 *     `super_admin`. **`admin` no lo tiene** —está así en `rbac.ts`, a
 *     propósito—, así que coordinación entra y lee, pero no pone notas.
 *   · El docente solo toca las de SUS cursos. Eso no se decide aquí: llega
 *     resuelto por fila en `editable`, calculado en el SQL, y las acciones lo
 *     vuelven a comprobar dentro de su propio WHERE.
 *
 * Leer, en cambio, es de todos los que entran. Una nota es del estudiante, no
 * del profesor que la puso, y quien lleva coordinación o expedientes necesita el
 * conjunto para ver quién está en riesgo.
 */
export function GestionCalificaciones({
  notas,
  resumen,
  cursos,
  estudiantes,
  periodos,
  puedeRegistrar,
  hayMas,
  hayFiltro,
}: {
  notas: readonly NotaRegistrada[];
  resumen: ResumenNotas;
  cursos: readonly OpcionSimple[];
  estudiantes: readonly OpcionSimple[];
  periodos: readonly PeriodoSimple[];
  puedeRegistrar: boolean;
  hayMas: boolean;
  hayFiltro: boolean;
}) {
  const t = useTranslations("academic");
  const [editando, setEditando] = useState<string | null>(null);

  const puedeAbrirFormulario =
    puedeRegistrar && cursos.length > 0 && estudiantes.length > 0;

  return (
    <div className={cn("space-y-5", ANIMACION.entrada)}>
      <div className="grid gap-3 sm:grid-cols-3">
        <CifraAcademica
          valor={resumen.total}
          etiqueta={t("grades.stats.total")}
          icono={ClipboardList}
        />
        <CifraAcademica
          valor={resumen.promedio?.toFixed(1) ?? "—"}
          etiqueta={t("grades.stats.average")}
          icono={Star}
          acento
        />
        <CifraAcademica
          valor={
            resumen.total > 0
              ? `${Math.round((resumen.aprobadas / resumen.total) * 100)}%`
              : "—"
          }
          etiqueta={t("grades.stats.passRate")}
          icono={CheckCircle2}
        />
      </div>

      <Distribucion resumen={resumen} />

      <Card>
        <CardContent className="pt-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <CardTitle>
              <Star className="size-4" />
              {t("grades.title")}
              <Badge className="ml-1 bg-[#2096BA]/15 text-[10px] text-[#187a99]">
                {resumen.total}
              </Badge>
            </CardTitle>

            {puedeAbrirFormulario && editando !== "nueva" && (
              <Button
                type="button"
                size="sm"
                onClick={() => setEditando("nueva")}
                className="transition-transform duration-150 active:scale-95"
              >
                <Plus className="size-3.5" />
                {t("grades.new")}
              </Button>
            )}
          </div>

          {/* Sin cursos o sin estudiantes no hay nota que registrar, y el botón
              llevaría a un formulario con dos desplegables vacíos. Se dice cuál
              de las dos cosas falta, que es lo que hay que ir a arreglar. */}
          {puedeRegistrar && !puedeAbrirFormulario && (
            <p className={cn(ALERTA_RIESGO.contenedor, "mb-3")}>
              <AlertCircle className={ALERTA_RIESGO.icono} />
              <span className={ALERTA_RIESGO.texto}>
                {cursos.length === 0
                  ? t("newGrade.noCourses")
                  : t("newGrade.noStudents")}
              </span>
            </p>
          )}

          {editando === "nueva" && (
            <FormularioNota
              cursos={cursos}
              estudiantes={estudiantes}
              periodos={periodos}
              alTerminar={() => setEditando(null)}
            />
          )}

          {notas.length === 0 ? (
            <div className={VACIO.contenedor}>
              <span className={VACIO.icono}>
                <Star className="size-6" />
              </span>
              <p className={VACIO.titulo}>
                {hayFiltro ? t("noMatches") : t("grades.empty")}
              </p>
              <p className={VACIO.descripcion}>
                {hayFiltro ? t("noMatchesHint") : t("grades.emptyHint")}
              </p>
            </div>
          ) : (
            <>
              <ul className="mt-3 divide-y">
                {notas.map((nota) => (
                  <li key={nota.id} className="group py-3">
                    {editando === nota.id ? (
                      <FormularioNota
                        nota={nota}
                        cursos={cursos}
                        estudiantes={estudiantes}
                        periodos={periodos}
                        alTerminar={() => setEditando(null)}
                      />
                    ) : (
                      <FilaNota
                        nota={nota}
                        puedeRegistrar={puedeRegistrar}
                        alEditar={() => setEditando(nota.id)}
                      />
                    )}
                  </li>
                ))}
              </ul>

              {hayMas && (
                <p className="text-muted-foreground mt-3 text-center text-xs">
                  {t("grades.limitHint")}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Distribución por banda.
 *
 * Cuatro barras y no cinco letras: aquí la pregunta no es "¿sacó B o C?" sino
 * "¿cuánta gente está reprobando?". La longitud de la barra lleva la
 * proporción y el número va escrito al lado, porque una barra corta y una barra
 * vacía se confunden de un vistazo.
 *
 * Las cifras salen del resumen agregado sobre la tabla entera, no de las filas
 * que se pintan: la lista está topada en 500 y una distribución de las 500 más
 * recientes no es la distribución del período.
 */
function Distribucion({ resumen }: { resumen: ResumenNotas }) {
  const t = useTranslations("academic");

  return (
    <Card>
      <CardContent className="pt-5">
        <CardTitle className="mb-3">
          <ClipboardList className="size-4" />
          {t("grades.distribution")}
        </CardTitle>

        {resumen.total === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">
            {t("grades.noAverage")}
          </p>
        ) : (
          <>
            <ul className="space-y-2">
              {BANDAS.map((banda) => {
                const cuantas = resumen[banda];
                const parte = Math.round((cuantas / resumen.total) * 100);

                return (
                  <li key={banda} className="flex items-center gap-3">
                    <span className="text-muted-foreground w-24 shrink-0 text-xs">
                      {t(`gradeBand.${banda}`)}
                    </span>

                    <span className="bg-muted h-2 min-w-0 flex-1 overflow-hidden rounded-full">
                      <span
                        className={cn(
                          "block h-full rounded-full transition-all duration-500",
                          BANDA_VISUAL[banda].barra,
                        )}
                        style={{ width: `${parte}%` }}
                      />
                    </span>

                    <span className="w-16 shrink-0 text-right text-xs">
                      <b>{cuantas}</b>{" "}
                      <span className="text-muted-foreground">{parte}%</span>
                    </span>
                  </li>
                );
              })}
            </ul>

            <p className="text-muted-foreground mt-3 text-xs">
              {t("grades.passRateHint", {
                passed: resumen.aprobadas,
                total: resumen.total,
              })}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** Una nota: de quién, de qué curso, y cuánto. */
function FilaNota({
  nota,
  puedeRegistrar,
  alEditar,
}: {
  nota: NotaRegistrada;
  puedeRegistrar: boolean;
  alEditar: () => void;
}) {
  const t = useTranslations("academic");

  const banda = bandaDe(nota.nota);

  return (
    <div className="flex flex-wrap items-start gap-3">
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-150 group-hover:scale-110",
          CUADRO.marca,
        )}
      >
        <User className="size-4" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{nota.estudiante}</p>

        <p className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs">
          <span className="inline-flex items-center gap-1">
            <BookOpen className="size-3" />
            {nota.curso}
          </span>
          <span>{nota.periodo}</span>
          <span>{t(`gradeType.${nota.tipo_evaluacion}` as never)}</span>
        </p>

        {nota.observaciones && (
          <p className="text-muted-foreground mt-1 line-clamp-2 text-[11px]">
            {nota.observaciones}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {/* La nota en grande con el color de su tramo, y la letra dentro: el
            número es el dato y el color solo lo confirma, así que el color no
            puede ser lo único que distinga un 69 de un 71. */}
        <span
          className={cn(
            "flex h-9 min-w-14 items-center justify-center gap-1 rounded-lg border px-2 text-sm font-bold",
            colorDeNota(nota.nota),
          )}
        >
          {nota.nota.toFixed(1)}
          <span className="text-[10px] font-semibold opacity-80">
            {letraDe(nota.nota)}
          </span>
        </span>

        <Badge className={cn("text-[10px]", BANDA_VISUAL[banda].pildora)}>
          {t(`gradeBand.${banda}`)}
        </Badge>
      </div>

      {puedeRegistrar && nota.editable && (
        <AccionesFila
          id={nota.id}
          nombre={`${nota.estudiante} · ${nota.curso}`}
          alEditar={alEditar}
          eliminar={eliminarCalificacion}
          avisoBorrado={t("grades.deleteHint")}
        />
      )}
    </div>
  );
}

/** Registrar o corregir. Sin `nota`, es un alta. */
function FormularioNota({
  nota,
  cursos,
  estudiantes,
  periodos,
  alTerminar,
}: {
  nota?: NotaRegistrada;
  cursos: readonly OpcionSimple[];
  estudiantes: readonly OpcionSimple[];
  periodos: readonly PeriodoSimple[];
  alTerminar: () => void;
}) {
  const t = useTranslations("academic");
  const [estado, enviar, enviando] = useActionState<EstadoCatalogo, FormData>(
    async (previo, datos) => {
      const resultado = await guardarCalificacion(previo, datos);
      if (resultado.estado === "ok") alTerminar();
      return resultado;
    },
    { estado: "inicial" },
  );

  /*
   * La nota se lleva en estado, y solo para pintar la banda mientras se
   * escribe (`newGrade.scoreHint` lo promete). El valor que se guarda es el del
   * campo, no este: si el estado y el campo se separaran por lo que sea, manda
   * lo que la persona ve escrito.
   */
  const [valor, setValor] = useState(nota ? String(nota.nota) : "");

  const numero = Number(valor);
  const hayNota = valor !== "" && Number.isFinite(numero) && numero >= 0 && numero <= 100;

  const clave = nota?.id ?? "nueva";

  return (
    <form action={enviar} className="space-y-3 border-t pt-3 first:border-t-0">
      <div>
        <p className="text-sm font-semibold">{t("newGrade.title")}</p>
        <p className="text-muted-foreground text-xs">{t("newGrade.subtitle")}</p>
      </div>

      <input type="hidden" name="id" value={nota?.id ?? ""} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor={`n-est-${clave}`}>{t("grade.student")}</Label>
          <select
            id={`n-est-${clave}`}
            name="estudiante"
            defaultValue={nota?.estudiante_id ?? ""}
            required
            className={SELECT}
          >
            <option value="">{t("choose")}</option>
            {estudiantes.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`n-curso-${clave}`}>{t("grade.course")}</Label>
          <select
            id={`n-curso-${clave}`}
            name="curso"
            defaultValue={nota?.curso_id ?? ""}
            required
            className={SELECT}
          >
            <option value="">{t("choose")}</option>
            {cursos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`n-periodo-${clave}`}>{t("grade.term")}</Label>
          <select
            id={`n-periodo-${clave}`}
            name="periodo"
            defaultValue={nota?.periodo_id ?? ""}
            required
            className={SELECT}
          >
            <option value="">{t("choose")}</option>
            {periodos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`n-tipo-${clave}`}>{t("grade.type")}</Label>
          <select
            id={`n-tipo-${clave}`}
            name="tipo"
            defaultValue={nota?.tipo_evaluacion ?? "examen"}
            className={SELECT}
          >
            {(
              ["examen", "tarea", "proyecto", "participacion", "final"] as const
            ).map((valor) => (
              <option key={valor} value={valor}>
                {t(`gradeType.${valor}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`n-nota-${clave}`}>{t("grade.score")}</Label>
          <div className="flex items-center gap-2">
            <Input
              id={`n-nota-${clave}`}
              name="nota"
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={valor}
              onChange={(evento) => setValor(evento.target.value)}
              required
            />

            {hayNota && (
              <span
                className={cn(
                  "flex h-9 shrink-0 items-center rounded-lg border px-2 text-xs font-bold",
                  colorDeNota(numero),
                )}
              >
                {letraDe(numero)}
              </span>
            )}
          </div>
          <p className="text-muted-foreground text-[11px]">
            {t("newGrade.scoreHint")}
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`n-obs-${clave}`}>{t("grade.notes")}</Label>
        <Textarea
          id={`n-obs-${clave}`}
          name="observaciones"
          defaultValue={nota?.observaciones ?? ""}
          maxLength={600}
          rows={2}
        />
      </div>

      {estado.estado !== "inicial" && estado.estado !== "ok" && (
        <p role="alert" className={ALERTA_RIESGO.contenedor}>
          <AlertCircle className={ALERTA_RIESGO.icono} />
          <span className={ALERTA_RIESGO.texto}>
            {estado.estado === "faltan_campos"
              ? t("newGrade.fieldsRequired")
              : estado.estado === "nota_invalida"
                ? t("newGrade.scoreInvalid")
                : estado.estado === "no_encontrado"
                  ? t("courses.errOwner")
                  : t("newGrade.error")}
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
          {enviando
            ? nota
              ? t("rowActions.saving")
              : t("newGrade.creating")
            : nota
              ? t("rowActions.save")
              : t("newGrade.create")}
        </Button>

        <Button type="button" variant="ghost" size="sm" onClick={alTerminar}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
