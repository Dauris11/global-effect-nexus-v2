"use client";

import { useState, useTransition } from "react";
import {
  AlertCircle,
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileCheck,
  FileText,
  FileUp,
  HardDrive,
  Info,
  Loader2,
  MessageSquare,
  Sparkles,
  Upload,
  User,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import type { AsignacionMoodleDetalle } from "@/lib/moodle";
import { cn } from "@/lib/utils";
import { entregarTareaMoodleAction } from "@/server/moodle/acciones";

interface BuzonTareaMoodleProps {
  asignacion: AsignacionMoodleDetalle;
  esVistaPrevia?: boolean;
}

export function BuzonTareaMoodle({
  asignacion,
  esVistaPrevia = false,
}: BuzonTareaMoodleProps) {
  const t = useTranslations("moodle");
  const locale = useLocale();
  const router = useRouter();

  const [archivoSeleccionado, setArchivoSeleccionado] = useState<File | null>(null);
  const [textoRespuesta, setTextoRespuesta] = useState(
    asignacion.entrega_texto_respuesta ?? "",
  );
  const [comentarioEstudiante, setComentarioEstudiante] = useState(
    asignacion.entrega_comentario_estudiante ?? "",
  );
  const [errorValidacion, setErrorValidacion] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [editandoEntrega, setEditandoEntrega] = useState(
    asignacion.entrega_estado === "pendiente" || !asignacion.entrega_id,
  );
  const [isPending, startTransition] = useTransition();

  const formatos = asignacion.formatos_permitidos.map((f) => f.toLowerCase().trim());

  const manejarCambioArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorValidacion(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Validación 1: Tamaño en MB
    const tamanoMb = file.size / (1024 * 1024);
    if (tamanoMb > asignacion.limite_mb) {
      setErrorValidacion(
        t("errorFileSize", {
          actual: tamanoMb.toFixed(1),
          max: asignacion.limite_mb,
        }),
      );
      e.target.value = "";
      return;
    }

    // Validación 2: Extensión
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (formatos.length > 0 && !formatos.includes(ext)) {
      setErrorValidacion(
        t("errorFileFormat", {
          ext: `.${ext}`,
          allowed: formatos.map((f) => `.${f}`).join(", "),
        }),
      );
      e.target.value = "";
      return;
    }

    setArchivoSeleccionado(file);
  };

  const ejecutarEntrega = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorValidacion(null);
    setMensajeExito(null);

    if (esVistaPrevia) {
      setMensajeExito(t("previewSuccessNotice"));
      return;
    }

    // `entrega_archivo_url` no viaja al navegador (el bucket es privado); lo
    // que dice si ya hay algo entregado es que exista la fila de la entrega.
    if (!archivoSeleccionado && !textoRespuesta.trim() && !asignacion.entrega_id) {
      setErrorValidacion(t("errorFileRequired"));
      return;
    }

    // El archivo viaja de verdad: el servidor lo sube y lo valida; el navegador
    // ya no inventa una URL ni declara su propio tamaño y formato.
    const formData = new FormData();
    formData.set("asignacion_id", asignacion.id);
    if (archivoSeleccionado) formData.set("archivo", archivoSeleccionado);
    formData.set("texto_respuesta", textoRespuesta);
    formData.set("comentario_estudiante", comentarioEstudiante);

    startTransition(async () => {
      const res = await entregarTareaMoodleAction(formData);
      const texto = t(`deliveryResult.${res.mensaje ?? "error"}` as never);
      if (res.ok) {
        setMensajeExito(texto);
        setEditandoEntrega(false);
        // La tarjeta y las cifras del aula son del servidor: sin esto seguían
        // diciendo "pendiente" hasta recargar a mano.
        router.refresh();
      } else {
        setErrorValidacion(texto);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. Cabecera de la Tarea Moodle */}
      <Card className="rounded-2xl border-linea-fuerte bg-card shadow-xs">
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-marca-600">
                {asignacion.materia_codigo ?? asignacion.materia_nombre}
              </span>
              <Badge variant="outline" className="text-xs">
                {asignacion.tipo.toUpperCase()}
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              {asignacion.vencida ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-[#B4342B]/10 px-2.5 py-1 text-xs font-semibold text-[#B4342B]">
                  <AlertCircle className="size-3.5" />
                  {t("overdueNotice")}
                </span>
              ) : asignacion.fecha_vencimiento ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2.5 py-1 text-xs text-tinta/80">
                  <Clock className="size-3.5 text-marca-500" />
                  {t("dueUntil")}: {fechaHoraRD(asignacion.fecha_vencimiento, locale)}
                </span>
              ) : null}

              <span className="inline-flex items-center gap-1 rounded-md bg-marca-50 px-2.5 py-1 text-xs font-bold text-marca-600">
                <Award className="size-3.5" />
                {asignacion.puntaje_maximo} {t("pointsLabel")}
              </span>
            </div>
          </div>

          <CardTitle className="mt-2 text-xl font-bold text-tinta">
            {asignacion.titulo}
          </CardTitle>

          {asignacion.docente_nombre && (
            <p className="flex items-center gap-1.5 text-xs text-tinta/60 pt-1">
              <User className="size-3.5" />
              {t("teacherLabel")}: {asignacion.docente_nombre}
            </p>
          )}
        </CardHeader>

        <CardContent className="space-y-4 pt-0">
          {/* Descripción de la tarea */}
          {asignacion.descripcion && (
            <div className="rounded-xl border border-linea-fuerte/50 bg-muted/20 p-4 text-sm text-tinta/80 leading-relaxed whitespace-pre-line">
              {asignacion.descripcion}
            </div>
          )}

          {/* Instrucciones Moodle */}
          {asignacion.instrucciones_entrega && (
            <div className="space-y-1.5">
              <h4 className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-tinta/70 uppercase">
                <Info className="size-3.5 text-marca-500" />
                {t("deliveryInstructions")}
              </h4>
              <div className="rounded-xl border border-linea-fuerte/40 bg-card p-3.5 text-xs text-tinta/80 whitespace-pre-line">
                {asignacion.instrucciones_entrega}
              </div>
            </div>
          )}

          {/* Restricciones Moodle (Formato y Tamaño) */}
          <div className="grid grid-cols-1 gap-3 rounded-xl border border-marca-500/20 bg-marca-50/50 p-3.5 sm:grid-cols-2">
            <div className="flex items-center gap-2 text-xs">
              <HardDrive className="size-4 shrink-0 text-marca-500" />
              <div>
                <p className="font-semibold text-tinta">{t("maxSizeTitle")}</p>
                <p className="text-tinta/60">
                  {asignacion.limite_mb} MB {t("perSubmission")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <FileCheck className="size-4 shrink-0 text-marca-500" />
              <div>
                <p className="font-semibold text-tinta">{t("allowedFormatsTitle")}</p>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {formatos.map((fmt) => (
                    <span
                      key={fmt}
                      className="rounded bg-card px-1.5 py-0.5 font-mono text-[11px] font-semibold text-marca-600 shadow-2xs"
                    >
                      .{fmt}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Feedback del Docente si ya fue calificada */}
      {asignacion.entrega_estado === "calificado" && (
        <Card className="rounded-2xl border-linea-fuerte bg-card shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="size-5 text-[#1E9E6A]" />
                <CardTitle className="text-base font-bold text-tinta">
                  {t("gradeFeedbackTitle")}
                </CardTitle>
              </div>
              <span className="rounded-xl bg-[#1E9E6A]/10 px-3 py-1 text-base font-bold text-[#1E9E6A]">
                {asignacion.calificacion} / {asignacion.puntaje_maximo}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {asignacion.comentario_profesor ? (
              <div className="rounded-xl border border-linea-fuerte/50 bg-muted/30 p-3.5 text-xs text-tinta/80">
                <p className="font-semibold text-tinta mb-1 flex items-center gap-1.5">
                  <MessageSquare className="size-3.5 text-marca-500" />
                  {t("teacherFeedbackNotes")}:
                </p>
                <p className="whitespace-pre-line leading-relaxed">
                  {asignacion.comentario_profesor}
                </p>
              </div>
            ) : (
              <p className="text-xs text-tinta/60">{t("noWrittenFeedback")}</p>
            )}

            {asignacion.revisada_en && (
              <p className="text-[11px] text-tinta/50">
                {t("reviewedAt")}: {asignacion.revisada_en}{" "}
                {asignacion.revisada_por_nombre && `(${asignacion.revisada_por_nombre})`}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* 3. Buzón de Entregas Moodle */}
      <Card className="rounded-2xl border-linea-fuerte bg-card shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-tinta">
              <FileUp className="size-5 text-marca-500" />
              {t("dropboxTitle")}
            </CardTitle>

            {asignacion.entrega_estado && (
              <Badge
                variant="outline"
                className={cn(
                  "text-xs font-semibold",
                  asignacion.entrega_estado === "calificado" &&
                    "border-transparent bg-[#1E9E6A]/10 text-[#1E9E6A]",
                  asignacion.entrega_estado === "entregado" &&
                    "border-transparent bg-marca-50 text-marca-600",
                  asignacion.entrega_estado === "tarde" &&
                    "border-transparent bg-[#B4342B]/10 text-[#B4342B]",
                  asignacion.entrega_estado === "pendiente" &&
                    "border-transparent bg-muted text-tinta/70",
                )}
              >
                {asignacion.entrega_estado === "calificado" && t("stateCalificado")}
                {asignacion.entrega_estado === "entregado" && t("stateEntregado")}
                {asignacion.entrega_estado === "tarde" && t("stateTarde")}
                {asignacion.entrega_estado === "pendiente" && t("statePendiente")}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {errorValidacion && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-linea-fuerte bg-muted p-3 text-xs text-tinta">
              <AlertCircle className="size-4 shrink-0 text-[#B4342B]" />
              <span>{errorValidacion}</span>
            </div>
          )}

          {mensajeExito && (
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-[#1E9E6A]/10 p-3 text-xs font-medium text-[#1E9E6A]">
              <CheckCircle2 className="size-4 shrink-0 text-[#1E9E6A]" />
              <span>{mensajeExito}</span>
            </div>
          )}

          {/* Formulario de Entrega */}
          {editandoEntrega ? (
            <form onSubmit={ejecutarEntrega} className="space-y-4">
              <div className="rounded-xl border-2 border-dashed border-marca-500/30 bg-marca-50/40 p-6 text-center">
                <input
                  type="file"
                  id="archivo-moodle"
                  accept={formatos.map((f) => `.${f}`).join(",")}
                  className="hidden"
                  onChange={manejarCambioArchivo}
                />

                <label
                  htmlFor="archivo-moodle"
                  className="flex flex-col items-center justify-center cursor-pointer space-y-2 active:scale-95 transition-all"
                >
                  <div className="flex size-12 items-center justify-center rounded-full bg-card shadow-xs text-marca-500">
                    <Upload className="size-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-tinta">
                      {archivoSeleccionado
                        ? archivoSeleccionado.name
                        : t("uploadFilePrompt")}
                    </p>
                    <p className="text-xs text-tinta/60">
                      {archivoSeleccionado
                        ? `${(archivoSeleccionado.size / (1024 * 1024)).toFixed(2)} MB`
                        : t("uploadFileLimits", {
                            max: asignacion.limite_mb,
                            formats: formatos.join(", "),
                          })}
                    </p>
                  </div>
                </label>
              </div>

              <div>
                <Label htmlFor="respuesta-escrita">{t("answerText")}</Label>
                <Textarea
                  id="respuesta-escrita"
                  value={textoRespuesta}
                  onChange={(e) => setTextoRespuesta(e.target.value)}
                  rows={5}
                  maxLength={20000}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="comentarios">{t("studentNotesOptional")}</Label>
                <Textarea
                  id="comentarios"
                  value={comentarioEstudiante}
                  onChange={(e) => setComentarioEstudiante(e.target.value)}
                  placeholder={t("studentNotesPlaceholder")}
                  rows={2}
                  className="mt-1"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                {asignacion.entrega_id && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditandoEntrega(false)}
                    className="min-h-[42px] border-linea-fuerte"
                  >
                    {t("cancel")}
                  </Button>
                )}
                <Button
                  type="submit"
                  disabled={isPending}
                  className="min-h-[42px] bg-marca-500 text-white hover:bg-marca-600 active:scale-95"
                >
                  {isPending ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <FileUp className="mr-2 size-4" />
                  )}
                  {t("submitAssignmentButton")}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              {/* Archivo ya entregado */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-linea-fuerte bg-muted/20 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-marca-50 text-marca-600">
                    <FileText className="size-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-tinta">
                      {asignacion.entrega_archivo_nombre ?? t("deliveredFileFallback")}
                    </p>
                    <p className="text-xs text-tinta/60">
                      {asignacion.entrega_archivo_tamano_mb
                        ? `${asignacion.entrega_archivo_tamano_mb} MB`
                        : ""}{" "}
                      • {t("deliveredOn")}: {fechaHoraRD(asignacion.entrega_fecha, locale)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {asignacion.entrega_archivo_url && (
                    <a
                      href={asignacion.entrega_archivo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-linea-fuerte bg-card px-3 text-xs font-semibold text-tinta hover:bg-muted active:scale-95"
                    >
                      <Download className="size-3.5" />
                      {t("downloadFile")}
                    </a>
                  )}

                  {asignacion.entrega_estado !== "calificado" && !asignacion.vencida && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditandoEntrega(true)}
                      className="min-h-[40px] border-marca-500 text-marca-600 hover:bg-marca-50 active:scale-95"
                    >
                      {t("editSubmission")}
                    </Button>
                  )}
                </div>
              </div>

              {asignacion.entrega_texto_respuesta && (
                <div className="rounded-xl border border-linea-fuerte/40 bg-card p-3.5 text-xs text-tinta">
                  <p className="mb-1 font-semibold text-tinta">
                    {t("answerText")}:
                  </p>
                  <p className="whitespace-pre-line leading-relaxed text-tinta/80">
                    {asignacion.entrega_texto_respuesta}
                  </p>
                </div>
              )}

              {asignacion.entrega_comentario_estudiante && (
                <div className="rounded-xl border border-linea-fuerte/40 bg-card p-3 text-xs text-tinta/70">
                  <span className="font-semibold text-tinta">
                    {t("yourNotes")}:
                  </span>{" "}
                  {asignacion.entrega_comentario_estudiante}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Fecha y hora en la zona de La Vega. Llegan en ISO (UTC) y pintarlas tal cual
 * enseñaba "2026-11-11T03:59:00.000Z" para una tarea que vence a las 23:59.
 */
function fechaHoraRD(valor: string | null, locale: string): string {
  if (!valor) return "—";
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return valor;

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Santo_Domingo",
  }).format(fecha);
}
