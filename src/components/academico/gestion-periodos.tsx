"use client";

import { useActionState, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  Clock,
  GraduationCap,
  Loader2,
  Plus,
  Save,
  Users,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { AccionesFila } from "@/components/academico/acciones-fila";
import { CifraAcademica } from "@/components/academico/cifra";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Locale } from "@/i18n/routing";
import { fechaCorta } from "@/lib/fechas";
import { ALERTA_RIESGO, ANIMACION, CUADRO, VACIO } from "@/lib/paleta";
import { cn } from "@/lib/utils";
import {
  eliminarPeriodo,
  guardarPeriodo,
  type EstadoCatalogo,
} from "@/server/academico/acciones";
import type { PeriodoGestionado } from "@/server/academico/consultas";

/**
 * Los períodos de la Fundación: crear un cuatrimestre, abrirlo y cerrarlo.
 *
 * Es la primera pantalla del módulo académico en el orden real de uso. Sin una
 * fila aquí no hay dónde colgar una materia ni una matrícula, y por
 * eso el estado vacío no dice "no hay nada" sino qué se desbloquea al crear el
 * primero.
 *
 * LO QUE ESTA PANTALLA HACE Y NINGUNA OTRA: avisar cuando el estado y las
 * fechas se contradicen. Un período marcado `activo` cuyas fechas ya pasaron
 * sigue recibiendo notas como si fuera el cuatrimestre en curso, y uno
 * `planificado` que ya empezó las manda al cuatrimestre anterior. Los dos casos
 * son invisibles mirando una lista de fechas —hay que restar mentalmente contra
 * hoy en cada fila— y los dos ensucian el historial de forma que cuesta
 * deshacer. Se avisan con el peso más alto de la marca, sin color de alarma.
 *
 * Quien mira sin `academico.escribir` ve exactamente lo mismo, sin botones:
 * `puedeEscribir` llega ya resuelto del servidor y las acciones lo vuelven a
 * comprobar antes de escribir.
 */
export function GestionPeriodos({
  periodos,
  puedeEscribir,
}: {
  periodos: readonly PeriodoGestionado[];
  puedeEscribir: boolean;
}) {
  const t = useTranslations("academic");
  const [editando, setEditando] = useState<string | null>(null);

  const activos = periodos.filter((p) => p.estado === "activo").length;
  const planificados = periodos.filter((p) => p.estado === "planificado").length;
  const completados = periodos.filter((p) => p.estado === "completado").length;

  return (
    <div className={cn("space-y-5", ANIMACION.entrada)}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CifraAcademica
          valor={periodos.length}
          etiqueta={t("terms.stats.total")}
          icono={CalendarRange}
        />
        <CifraAcademica
          valor={activos}
          etiqueta={t("terms.stats.active")}
          icono={CheckCircle2}
          acento
        />
        <CifraAcademica
          valor={planificados}
          etiqueta={t("terms.stats.planned")}
          icono={Clock}
        />
        <CifraAcademica
          valor={completados}
          etiqueta={t("terms.stats.done")}
          icono={GraduationCap}
        />
      </div>

      <Card>
        <CardContent className="pt-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <CardTitle>
              <CalendarDays className="size-4" />
              {t("terms.title")}
              <Badge className="ml-1 bg-[#2096BA]/15 text-[10px] text-[#187a99]">
                {periodos.length}
              </Badge>
            </CardTitle>

            {puedeEscribir && editando !== "nuevo" && (
              <Button
                type="button"
                size="sm"
                onClick={() => setEditando("nuevo")}
                className="transition-transform duration-150 active:scale-95"
              >
                <Plus className="size-3.5" />
                {t("terms.new")}
              </Button>
            )}
          </div>

          {editando === "nuevo" && (
            <FormularioPeriodo alTerminar={() => setEditando(null)} />
          )}

          {periodos.length === 0 ? (
            <div className={VACIO.contenedor}>
              <span className={VACIO.icono}>
                <CalendarDays className="size-6" />
              </span>
              <p className={VACIO.titulo}>{t("terms.empty")}</p>
              <p className={VACIO.descripcion}>{t("terms.emptyHint")}</p>
            </div>
          ) : (
            <ul className="mt-3 divide-y">
              {periodos.map((periodo) => (
                <li key={periodo.id} className="group py-3">
                  {editando === periodo.id ? (
                    <FormularioPeriodo
                      periodo={periodo}
                      alTerminar={() => setEditando(null)}
                    />
                  ) : (
                    <FilaPeriodo
                      periodo={periodo}
                      puedeEscribir={puedeEscribir}
                      alEditar={() => setEditando(periodo.id)}
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

/** Un período: fechas, estado, lo que cuelga de él y sus incoherencias. */
function FilaPeriodo({
  periodo,
  puedeEscribir,
  alEditar,
}: {
  periodo: PeriodoGestionado;
  puedeEscribir: boolean;
  alEditar: () => void;
}) {
  const t = useTranslations("academic");
  const idioma = useLocale() as Locale;

  /*
   * Las dos incoherencias que la pantalla existe para cazar. Se comparan las
   * banderas que trajo la consulta —calculadas con `CURRENT_DATE` en la base—
   * y no `new Date()`: el reloj del dispositivo de quien mira no puede decidir
   * qué cuatrimestre está en curso.
   */
  const cerroTarde = periodo.estado === "activo" && periodo.ya_termino;
  const abrioTarde = periodo.estado === "planificado" && periodo.ya_empezo;

  return (
    <div className="flex flex-wrap items-start gap-3">
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-150 group-hover:scale-110",
          periodo.en_curso ? CUADRO.fuerte : CUADRO.marca,
        )}
      >
        <CalendarDays className="size-4" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="truncate text-sm font-medium">{periodo.nombre}</p>

          {periodo.en_curso && (
            <Badge className="bg-[#0a6a8a] text-[10px] text-white">
              {t("terms.inProgress")}
            </Badge>
          )}
        </div>

        <p className="text-muted-foreground truncate text-xs">
          {fechaCorta(periodo.fecha_inicio, idioma)} —{" "}
          {fechaCorta(periodo.fecha_fin, idioma)} ·{" "}
          {t(periodo.tipo === "semestre" ? "termKind.semester" : "termKind.quarter")}
        </p>

        {/* Lo que cuelga: es la cifra que decide si el período se puede borrar
            o si lo que toca es cerrarlo. */}
        <p className="text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
          <span className="inline-flex items-center gap-1">
            <BookOpen className="size-3" />
            {t("terms.counts.subjects")}: <b>{periodo.materias}</b>
          </span>
          <span className="inline-flex items-center gap-1">
            <GraduationCap className="size-3" />
            {t("terms.counts.enrollments360")}: <b>{periodo.inscripciones_360}</b>
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="size-3" />
            {t("terms.counts.enrollments")}: <b>{periodo.inscripciones}</b>
          </span>
        </p>

        {(cerroTarde || abrioTarde) && (
          <p className={cn(ALERTA_RIESGO.contenedor, "mt-2")}>
            <AlertCircle className={ALERTA_RIESGO.icono} />
            <span className={ALERTA_RIESGO.texto}>
              {cerroTarde ? t("terms.mismatchEnded") : t("terms.mismatchStarted")}
            </span>
          </p>
        )}
      </div>

      <Badge
        className={cn(
          "shrink-0 text-[10px]",
          periodo.estado === "activo"
            ? "bg-[#2096BA]/15 text-[#187a99]"
            : periodo.estado === "completado"
              ? "bg-slate-200 text-tinta-2"
              : "bg-muted text-tinta-2",
        )}
      >
        {t(`termStatus.${periodo.estado}` as never)}
      </Badge>

      {puedeEscribir && (
        <AccionesFila
          id={periodo.id}
          nombre={periodo.nombre}
          alEditar={alEditar}
          eliminar={eliminarPeriodo}
          avisoBorrado={t("terms.deleteHint")}
          avisoEnUso={t("terms.inUseHint")}
        />
      )}
    </div>
  );
}

/** Alta y edición. Sin `periodo`, es un alta. */
function FormularioPeriodo({
  periodo,
  alTerminar,
}: {
  periodo?: PeriodoGestionado;
  alTerminar: () => void;
}) {
  const t = useTranslations("academic");
  const [estado, enviar, enviando] = useActionState<EstadoCatalogo, FormData>(
    async (previo, datos) => {
      const resultado = await guardarPeriodo(previo, datos);
      if (resultado.estado === "ok") alTerminar();
      return resultado;
    },
    { estado: "inicial" },
  );

  const clave = periodo?.id ?? "nuevo";

  return (
    <form action={enviar} className="space-y-3 border-t pt-3 first:border-t-0">
      <div>
        <p className="text-sm font-semibold">
          {periodo ? t("editTerm.title") : t("newTerm.title")}
        </p>
        <p className="text-muted-foreground text-xs">
          {periodo ? t("editTerm.subtitle") : t("newTerm.subtitle")}
        </p>
      </div>

      <input type="hidden" name="id" value={periodo?.id ?? ""} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1.5">
          <Label htmlFor={`p-nombre-${clave}`}>{t("term.name")}</Label>
          <Input
            id={`p-nombre-${clave}`}
            name="nombre"
            defaultValue={periodo?.nombre}
            placeholder="2026-I"
            required
            maxLength={60}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`p-tipo-${clave}`}>{t("termKind.label")}</Label>
          <select
            id={`p-tipo-${clave}`}
            name="tipo"
            defaultValue={periodo?.tipo ?? "cuatrimestre"}
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-card px-2 text-base shadow-xs outline-none focus-visible:ring-[3px] sm:text-sm"
          >
            <option value="cuatrimestre">{t("termKind.quarter")}</option>
            <option value="semestre">{t("termKind.semester")}</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`p-inicio-${clave}`}>{t("term.start")}</Label>
          <Input
            id={`p-inicio-${clave}`}
            name="inicio"
            type="date"
            defaultValue={periodo?.fecha_inicio ?? ""}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`p-fin-${clave}`}>{t("term.end")}</Label>
          <Input
            id={`p-fin-${clave}`}
            name="fin"
            type="date"
            defaultValue={periodo?.fecha_fin ?? ""}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`p-estado-${clave}`}>{t("term.status")}</Label>
          <select
            id={`p-estado-${clave}`}
            name="estado"
            defaultValue={periodo?.estado ?? "planificado"}
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-card px-2 text-base shadow-xs outline-none focus-visible:ring-[3px] sm:text-sm"
          >
            {(["planificado", "activo", "completado"] as const).map((valor) => (
              <option key={valor} value={valor}>
                {t(`termStatus.${valor}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-muted-foreground text-xs">{t("newTerm.nameHint")}</p>

      {estado.estado !== "inicial" && estado.estado !== "ok" && (
        <p role="alert" className={ALERTA_RIESGO.contenedor}>
          <AlertCircle className={ALERTA_RIESGO.icono} />
          <span className={ALERTA_RIESGO.texto}>
            {estado.estado === "nombre_vacio"
              ? t("newTerm.nameRequired")
              : estado.estado === "fechas_faltan"
                ? t("newTerm.datesRequired")
                : estado.estado === "fin_antes_de_inicio"
                  ? t("newTerm.endBeforeStart")
                  : estado.estado === "duplicado"
                    ? t("newTerm.duplicate")
                    : t("newTerm.error")}
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
            ? periodo
              ? t("rowActions.saving")
              : t("newTerm.creating")
            : periodo
              ? t("rowActions.save")
              : t("newTerm.create")}
        </Button>

        <Button type="button" variant="ghost" size="sm" onClick={alTerminar}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
