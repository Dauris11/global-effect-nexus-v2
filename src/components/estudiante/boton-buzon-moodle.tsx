"use client";

import { useState } from "react";
import { FolderUp, UploadCloud, CheckCircle2, Award } from "lucide-react";
import { useTranslations } from "next-intl";

import { BuzonTareaMoodle } from "@/components/estudiante/buzon-tarea-moodle";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AsignacionMoodleDetalle } from "@/lib/moodle";
import type { AsignacionDelEstudiante } from "@/server/estudiantes/aula";

interface BotonBuzonMoodleProps {
  fila: AsignacionDelEstudiante;
}

export function BotonBuzonMoodle({ fila }: BotonBuzonMoodleProps) {
  const t = useTranslations("moodle");
  const [abierto, setAbierto] = useState(false);

  const asignacionMoodle: AsignacionMoodleDetalle = {
    id: fila.id,
    titulo: fila.titulo,
    descripcion: fila.descripcion,
    tipo: fila.tipo,
    archivo_url: fila.archivo_url,
    fecha_publicacion:
      fila.fecha_publicacion instanceof Date
        ? fila.fecha_publicacion.toISOString()
        : String(fila.fecha_publicacion),
    fecha_vencimiento: fila.fecha_vencimiento
      ? fila.fecha_vencimiento instanceof Date
        ? fila.fecha_vencimiento.toISOString()
        : String(fila.fecha_vencimiento)
      : null,
    limite_mb: fila.limite_mb ?? 15,
    formatos_permitidos: fila.formatos_permitidos ?? [".pdf", ".docx", ".zip"],
    puntaje_maximo: fila.puntaje_maximo ?? 100,
    permite_entregas_tardias: fila.permite_entregas_tardias ?? true,
    instrucciones_entrega: fila.instrucciones_entrega ?? null,
    materia_nombre: fila.materia,
    materia_codigo: fila.materia_codigo,
    docente_nombre: fila.docente_nombre ?? null,
    vencida: fila.vencida,
    entrega_id: fila.entrega_id ?? null,
    entrega_estado: (fila.estado_entrega ?? "pendiente") as
      | "pendiente"
      | "entregado"
      | "calificado"
      | "tarde",
    entrega_archivo_url: fila.entrega_archivo_url ?? null,
    entrega_archivo_nombre: fila.entrega_archivo_nombre ?? null,
    entrega_archivo_tamano_mb: fila.entrega_archivo_tamano_mb ?? null,
    entrega_archivo_formato: fila.entrega_archivo_formato ?? null,
    entrega_texto_respuesta: fila.entrega_texto_respuesta ?? null,
    entrega_fecha: fila.fecha_entrega
      ? fila.fecha_entrega instanceof Date
        ? fila.fecha_entrega.toISOString()
        : String(fila.fecha_entrega)
      : null,
    entrega_comentario_estudiante: fila.entrega_comentario_estudiante ?? null,
    calificacion: fila.calificacion,
    comentario_profesor: fila.comentario_profesor,
    revisada_por_nombre: fila.revisada_por_nombre ?? null,
    revisada_en: fila.revisada_en ?? null,
  };

  const yaEntregada =
    fila.estado_entrega === "entregado" ||
    fila.estado_entrega === "tarde" ||
    fila.estado_entrega === "calificado";

  return (
    <>
      <Button
        type="button"
        variant={yaEntregada ? "outline" : "default"}
        onClick={() => setAbierto(true)}
        className="min-h-11 gap-2 active:scale-95 transition-all text-xs font-semibold"
      >
        {fila.estado_entrega === "calificado" ? (
          <>
            <Award className="size-4 text-marca-600" />
            <span>{t("viewGrade")}</span>
          </>
        ) : yaEntregada ? (
          <>
            <CheckCircle2 className="size-4 text-marca-600" />
            <span>{t("editSubmission")}</span>
          </>
        ) : (
          <>
            <FolderUp className="size-4" />
            <span>{t("dropboxButton")}</span>
          </>
        )}
      </Button>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader className="mb-2">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-tinta">
              <UploadCloud className="size-5 text-marca-600" />
              <span>{fila.titulo}</span>
            </DialogTitle>
          </DialogHeader>

          <BuzonTareaMoodle asignacion={asignacionMoodle} />
        </DialogContent>
      </Dialog>
    </>
  );
}
