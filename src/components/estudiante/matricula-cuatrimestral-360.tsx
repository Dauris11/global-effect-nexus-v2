"use client";

import { useState, useTransition } from "react";
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  GraduationCap,
  Info,
  Loader2,
  MinusCircle,
  PlusCircle,
  Sparkles,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Materia360Matricula, VentanaMatricula360 } from "@/lib/moodle";
import { cn } from "@/lib/utils";
import {
  matricularMateria360Action,
  retirarMateria360Action,
} from "@/server/moodle/acciones";

interface MatriculaCuatrimestral360Props {
  materiasIniciales: Materia360Matricula[];
  ventana: VentanaMatricula360 | null;
}

export function MatriculaCuatrimestral360({
  materiasIniciales,
  ventana,
}: MatriculaCuatrimestral360Props) {
  const t = useTranslations("moodle");

  const [materias, setMaterias] = useState(materiasIniciales);
  const [rondaSeleccionada, setRondaSeleccionada] = useState<number>(
    ventana?.ronda ?? 1,
  );
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(
    null,
  );
  const [materiaProcesandoId, setMateriaProcesandoId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const ventanaAbierta = ventana?.abierta ?? false;

  const matricular = (materia: Materia360Matricula) => {
    if (!ventanaAbierta) return;
    setMensaje(null);
    setMateriaProcesandoId(materia.id);

    // Optimista
    setMaterias((prev) =>
      prev.map((m) =>
        m.id === materia.id
          ? {
              ...m,
              inscrita: true,
              cupo_ocupado: m.cupo_ocupado + 1,
              ronda_inscrita: rondaSeleccionada,
            }
          : m,
      ),
    );

    startTransition(async () => {
      const res = await matricularMateria360Action(materia.id, rondaSeleccionada);
      if (res.ok) {
        setMensaje({ tipo: "ok", texto: res.mensaje ?? t("enrollSuccess") });
      } else {
        setMensaje({ tipo: "error", texto: res.mensaje ?? t("enrollError") });
        // Revertir
        setMaterias((prev) =>
          prev.map((m) =>
            m.id === materia.id
              ? {
                  ...m,
                  inscrita: false,
                  cupo_ocupado: m.cupo_ocupado - 1,
                  ronda_inscrita: null,
                }
              : m,
          ),
        );
      }
      setMateriaProcesandoId(null);
    });
  };

  const retirar = (materia: Materia360Matricula) => {
    if (!materia.inscripcion_id || !ventanaAbierta) return;
    setMensaje(null);
    setMateriaProcesandoId(materia.id);

    // Optimista
    setMaterias((prev) =>
      prev.map((m) =>
        m.id === materia.id
          ? {
              ...m,
              inscrita: false,
              cupo_ocupado: Math.max(0, m.cupo_ocupado - 1),
              ronda_inscrita: null,
              inscripcion_id: null,
            }
          : m,
      ),
    );

    startTransition(async () => {
      const res = await retirarMateria360Action(materia.inscripcion_id!);
      if (res.ok) {
        setMensaje({ tipo: "ok", texto: res.mensaje ?? t("withdrawSuccess") });
      } else {
        setMensaje({ tipo: "error", texto: res.mensaje ?? t("withdrawError") });
      }
      setMateriaProcesandoId(null);
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. Banner de Ronda Cuatrimestral */}
      <div className="rounded-2xl border border-marca-500/20 bg-marca-50 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs uppercase tracking-wider text-marca-600">
                {t("periodEnrollmentTitle")}
              </span>
              <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-marca-600 shadow-2xs">
                {rondaSeleccionada === 1 ? t("round1Badge") : t("round2Badge")}
              </span>
            </div>

            <p className="text-xs text-tinta/70">
              {ventana?.mensaje ?? t("roundDescription")}
            </p>
          </div>

          {/* Selector de Ronda */}
          <div className="flex items-center gap-1.5 rounded-xl border border-linea-fuerte bg-white p-1 shadow-2xs">
            <button
              type="button"
              onClick={() => setRondaSeleccionada(1)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all active:scale-95",
                rondaSeleccionada === 1
                  ? "bg-marca-500 text-white shadow-xs"
                  : "text-tinta/70 hover:bg-muted",
              )}
            >
              {t("round1Button")}
            </button>
            <button
              type="button"
              onClick={() => setRondaSeleccionada(2)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all active:scale-95",
                rondaSeleccionada === 2
                  ? "bg-marca-500 text-white shadow-xs"
                  : "text-tinta/70 hover:bg-muted",
              )}
            >
              {t("round2Button")}
            </button>
          </div>
        </div>

        {/* Estado de Apertura */}
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-marca-500/15 pt-3 text-xs">
          {ventanaAbierta ? (
            <span className="inline-flex items-center gap-1 font-semibold text-[#1E9E6A]">
              <CheckCircle2 className="size-3.5" />
              {t("windowOpenUntil", { date: ventana?.cierra ?? "" })}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 font-semibold text-[#B4342B]">
              <Clock className="size-3.5" />
              {t("windowClosedNotice")}
            </span>
          )}
        </div>
      </div>

      {mensaje && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-xl p-3 text-xs",
            mensaje.tipo === "ok"
              ? "bg-[#1E9E6A]/10 text-[#1E9E6A]"
              : "border border-linea-fuerte bg-muted text-tinta",
          )}
        >
          {mensaje.tipo === "ok" ? (
            <CheckCircle2 className="size-4 shrink-0 text-[#1E9E6A]" />
          ) : (
            <AlertCircle className="size-4 shrink-0 text-[#B4342B]" />
          )}
          <span>{mensaje.texto}</span>
        </div>
      )}

      {/* 2. Rejilla de Asignaturas con Horarios y Cupos */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {materias.map((materia) => {
          const procesando = materiaProcesandoId === materia.id;
          const cupoLleno = materia.cupo_ocupado >= materia.cupo_maximo;
          const porcentaje = Math.min(
            100,
            Math.round((materia.cupo_ocupado / materia.cupo_maximo) * 100),
          );

          return (
            <Card
              key={materia.id}
              className={cn(
                "relative flex flex-col justify-between rounded-2xl border bg-white p-4 shadow-xs transition-all",
                materia.inscrita
                  ? "border-marca-500/40 ring-1 ring-marca-500/20"
                  : "border-linea-fuerte hover:border-marca-500/30",
              )}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    {materia.codigo && (
                      <span className="font-mono text-xs font-bold text-marca-600">
                        {materia.codigo}
                      </span>
                    )}
                    <h4 className="text-base font-bold text-tinta mt-0.5">
                      {materia.nombre}
                    </h4>
                  </div>

                  {materia.obligatoria && (
                    <Badge variant="outline" className="text-[11px] font-semibold shrink-0">
                      {t("mandatoryBadge")}
                    </Badge>
                  )}
                </div>

                {/* Horario, Aula y Docente */}
                <div className="space-y-1.5 text-xs text-tinta/80">
                  <div className="flex items-center gap-1.5">
                    <Clock className="size-3.5 shrink-0 text-marca-500" />
                    <span>{materia.horario}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Building2 className="size-3.5 shrink-0 text-marca-500" />
                    <span>{materia.aula}</span>
                  </div>

                  {materia.docente_nombre && (
                    <div className="flex items-center gap-1.5 text-tinta/60">
                      <GraduationCap className="size-3.5 shrink-0" />
                      <span>{materia.docente_nombre}</span>
                    </div>
                  )}
                </div>

                {/* Barra de Progreso de Cupo */}
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="font-semibold text-tinta/70">
                      {t("capacityLabel")}:
                    </span>
                    <span
                      className={cn(
                        "font-mono font-bold",
                        cupoLleno ? "text-[#B4342B]" : "text-marca-600",
                      )}
                    >
                      {materia.cupo_ocupado} / {materia.cupo_maximo} ({porcentaje}%)
                    </span>
                  </div>
                  <Progress value={porcentaje} className="h-1.5" />
                </div>
              </div>

              {/* Botón de Matrícula / Retiro Táctil (>= 44px) */}
              <div className="pt-4">
                {materia.inscrita ? (
                  <Button
                    variant="outline"
                    disabled={!ventanaAbierta || procesando}
                    onClick={() => retirar(materia)}
                    className="min-h-[44px] w-full border-[#B4342B]/30 text-[#B4342B] hover:bg-[#B4342B]/5 active:scale-95 text-xs font-semibold"
                  >
                    {procesando ? (
                      <Loader2 className="mr-1.5 size-4 animate-spin" />
                    ) : (
                      <MinusCircle className="mr-1.5 size-4" />
                    )}
                    {t("withdrawSubjectButton")} (Ronda {materia.ronda_inscrita ?? 1})
                  </Button>
                ) : (
                  <Button
                    disabled={!ventanaAbierta || cupoLleno || procesando}
                    onClick={() => matricular(materia)}
                    className="min-h-[44px] w-full bg-marca-500 text-white hover:bg-marca-600 active:scale-95 text-xs font-semibold"
                  >
                    {procesando ? (
                      <Loader2 className="mr-1.5 size-4 animate-spin" />
                    ) : (
                      <PlusCircle className="mr-1.5 size-4" />
                    )}
                    {cupoLleno ? t("noCapacityButton") : t("enrollSubjectButton")}
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
