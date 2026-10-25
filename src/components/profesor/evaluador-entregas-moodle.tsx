"use client";

import { useState, useTransition } from "react";
import {
  AlertCircle,
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileCheck,
  FileText,
  Loader2,
  MessageSquare,
  Sparkles,
  User,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { FilaEntregaDocente } from "@/lib/moodle";
import { cn } from "@/lib/utils";
import { calificarEntregaMoodleAction } from "@/server/moodle/acciones";

interface EvaluadorEntregasMoodleProps {
  entregasIniciales: FilaEntregaDocente[];
  puntajeMaximo?: number;
}

export function EvaluadorEntregasMoodle({
  entregasIniciales,
  puntajeMaximo = 100,
}: EvaluadorEntregasMoodleProps) {
  const t = useTranslations("moodle");

  const [entregas, setEntregas] = useState(entregasIniciales);
  const [entregaSeleccionada, setEntregaSeleccionada] =
    useState<FilaEntregaDocente | null>(null);
  const [modalCalificarAbierto, setModalCalificarAbierto] = useState(false);
  const [nota, setNota] = useState<string>("");
  const [feedback, setFeedback] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  const abrirCalificador = (entrega: FilaEntregaDocente) => {
    setEntregaSeleccionada(entrega);
    setNota(entrega.calificacion !== null ? String(entrega.calificacion) : "");
    setFeedback(entrega.comentario_profesor ?? "");
    setModalCalificarAbierto(true);
  };

  const aplicarPlantillaFeedback = (texto: string) => {
    setFeedback((prev) => (prev ? `${prev}\n${texto}` : texto));
  };

  const guardarCalificacion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entregaSeleccionada) return;

    const valorNota = parseFloat(nota);
    if (isNaN(valorNota) || valorNota < 0 || valorNota > puntajeMaximo) return;

    const datos = new FormData();
    datos.set("entrega_id", entregaSeleccionada.entrega_id);
    datos.set("calificacion", nota);
    datos.set("comentario_profesor", feedback);

    // Optimista
    setEntregas((prev) =>
      prev.map((item) =>
        item.entrega_id === entregaSeleccionada.entrega_id
          ? {
              ...item,
              calificacion: valorNota,
              comentario_profesor: feedback,
              estado: "calificado",
            }
          : item,
      ),
    );

    startTransition(async () => {
      const res = await calificarEntregaMoodleAction(datos);
      if (res.ok) {
        setModalCalificarAbierto(false);
        setEntregaSeleccionada(null);
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Listado de Entregas */}
      {entregas.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-linea-fuerte bg-card py-12 text-center shadow-xs">
          <FileText className="size-10 text-marca-500/60" />
          <h3 className="mt-3 text-base font-semibold text-tinta">
            {t("noSubmissionsTitle")}
          </h3>
          <p className="mt-1 text-sm text-tinta/60">
            {t("noSubmissionsSubtitle")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {entregas.map((entrega) => (
            <div
              key={entrega.entrega_id}
              className="flex flex-col justify-between gap-3 rounded-xl border border-linea-fuerte bg-card p-4 shadow-xs transition-all hover:border-marca-500/40 sm:flex-row sm:items-center"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-tinta">
                    {entrega.estudiante_nombre}
                  </span>
                  {entrega.estudiante_matricula && (
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-tinta/70">
                      {entrega.estudiante_matricula}
                    </span>
                  )}

                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs font-semibold",
                      entrega.estado === "calificado" &&
                        "border-transparent bg-[#1E9E6A]/10 text-[#1E9E6A]",
                      entrega.estado === "entregado" &&
                        "border-transparent bg-marca-50 text-marca-600",
                      entrega.estado === "tarde" &&
                        "border-transparent bg-[#B4342B]/10 text-[#B4342B]",
                      entrega.estado === "pendiente" &&
                        "border-transparent bg-muted text-tinta/70",
                    )}
                  >
                    {entrega.estado === "calificado" && t("stateCalificado")}
                    {entrega.estado === "entregado" && t("stateEntregado")}
                    {entrega.estado === "tarde" && t("stateTarde")}
                    {entrega.estado === "pendiente" && t("statePendiente")}
                  </Badge>

                  {entrega.es_tarde && (
                    <span className="inline-flex items-center gap-1 rounded bg-[#B4342B]/10 px-1.5 py-0.5 text-[11px] font-semibold text-[#B4342B]">
                      <Clock className="size-3" />
                      {t("lateBadge")}
                    </span>
                  )}
                </div>

                {entrega.archivo_nombre ? (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-tinta/70 pt-0.5">
                    <span className="flex items-center gap-1 font-medium text-tinta">
                      <FileText className="size-3.5 text-marca-500" />
                      {entrega.archivo_nombre}
                    </span>
                    {entrega.archivo_tamano_mb && (
                      <span>({entrega.archivo_tamano_mb} MB)</span>
                    )}
                    {entrega.fecha_entrega && (
                      <span className="text-tinta/50">
                        • {t("deliveredAt")}: {entrega.fecha_entrega}
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-tinta/50 italic">
                    {t("noFileAttached")}
                  </p>
                )}

                {entrega.comentario_estudiante && (
                  <p className="text-xs text-tinta/60 line-clamp-1 italic">
                    &ldquo;{entrega.comentario_estudiante}&rdquo;
                  </p>
                )}
              </div>

              {/* Acciones del Docente */}
              <div className="flex items-center gap-2 pt-2 sm:pt-0">
                {entrega.archivo_url && (
                  <a
                    href={entrega.archivo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[40px] items-center gap-1 rounded-lg border border-linea-fuerte bg-muted/40 px-3 text-xs font-semibold text-tinta hover:bg-muted active:scale-95"
                  >
                    <Download className="size-3.5" />
                    {t("download")}
                  </a>
                )}

                <Button
                  size="sm"
                  onClick={() => abrirCalificador(entrega)}
                  className={cn(
                    "min-h-[40px] active:scale-95",
                    entrega.estado === "calificado"
                      ? "border border-linea-fuerte bg-card text-tinta hover:bg-muted"
                      : "bg-marca-500 text-white hover:bg-marca-600",
                  )}
                >
                  <Award className="mr-1.5 size-3.5" />
                  {entrega.estado === "calificado"
                    ? `${entrega.calificacion} / ${puntajeMaximo}`
                    : t("gradeAction")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Calificación y Feedback */}
      <Dialog
        open={modalCalificarAbierto}
        onOpenChange={setModalCalificarAbierto}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Award className="size-5 text-marca-500" />
              {t("gradeSubmissionModalTitle")}
            </DialogTitle>
          </DialogHeader>

          {entregaSeleccionada && (
            <form onSubmit={guardarCalificacion} className="space-y-4 pt-2">
              <div className="rounded-xl border border-linea-fuerte bg-muted/30 p-3 text-xs space-y-1">
                <p className="font-semibold text-tinta">
                  {entregaSeleccionada.estudiante_nombre}
                </p>
                {entregaSeleccionada.archivo_nombre && (
                  <p className="text-tinta/70">
                    {t("fileLabel")}: {entregaSeleccionada.archivo_nombre} (
                    {entregaSeleccionada.archivo_tamano_mb} MB)
                  </p>
                )}
                {entregaSeleccionada.comentario_estudiante && (
                  <p className="text-tinta/70 italic">
                    {t("studentComment")}: &ldquo;{entregaSeleccionada.comentario_estudiante}&rdquo;
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="nota">
                  {t("gradeInputLabel")} (Máx: {puntajeMaximo})
                </Label>
                <Input
                  id="nota"
                  type="number"
                  step="0.1"
                  min="0"
                  max={puntajeMaximo}
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  placeholder="0.0"
                  required
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="feedback">{t("writtenFeedbackLabel")}</Label>
                <Textarea
                  id="feedback"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder={t("writtenFeedbackPlaceholder")}
                  rows={3}
                  className="mt-1"
                />

                {/* Plantillas de Feedback Rápido */}
                <div className="mt-2 space-y-1">
                  <p className="text-[11px] font-semibold text-tinta/60">
                    {t("quickFeedbackPresets")}:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      t("presetExcellent"),
                      t("presetGoodAnalysis"),
                      t("presetMissingDiagrams"),
                      t("presetFixFormatting"),
                    ].map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => aplicarPlantillaFeedback(preset)}
                        className="rounded border border-linea-fuerte/70 bg-card px-2 py-0.5 text-[11px] text-tinta/70 hover:bg-muted active:scale-95"
                      >
                        + {preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalCalificarAbierto(false)}
                >
                  {t("cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={isPending}
                  className="bg-marca-500 text-white hover:bg-marca-600 active:scale-95"
                >
                  {isPending ? (
                    <Loader2 className="mr-1.5 size-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-1.5 size-4" />
                  )}
                  {t("saveGradeButton")}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
