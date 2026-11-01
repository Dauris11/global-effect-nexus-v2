"use client";

import { useState } from "react";
import {
  Eye,
  EyeOff,
  GraduationCap,
  Sparkles,
  UserCheck,
  X,
} from "lucide-react";
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

interface VistaEstudianteModalProps {
  asignacion: AsignacionMoodleDetalle;
  abierto: boolean;
  onCerrar: () => void;
}

export function VistaEstudianteModal({
  asignacion,
  abierto,
  onCerrar,
}: VistaEstudianteModalProps) {
  const t = useTranslations("moodle");

  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader className="border-b border-linea-fuerte pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-full bg-marca-50 text-marca-600">
                <Eye className="size-4" />
              </span>
              <div>
                <DialogTitle className="text-lg font-bold text-tinta">
                  {t("previewStudentViewTitle")}
                </DialogTitle>
              </div>
            </div>

            <span className="rounded-full bg-marca-50 px-3 py-1 font-mono text-xs font-semibold text-marca-600">
              {t("previewBadge")}
            </span>
          </div>
        </DialogHeader>

        {/* Banner contextual de simulación */}
        <div className="mt-4 rounded-xl border border-marca-500/20 bg-marca-50 p-3.5 text-xs text-marca-700">
          <p className="font-semibold flex items-center gap-1.5">
            <UserCheck className="size-4 text-marca-500" />
            {t("previewNoticeHeading")}
          </p>
          <p className="mt-1 text-tinta/70 leading-relaxed">
            {t("previewNoticeBody")}
          </p>
        </div>

        {/* Vista interactiva exacta del estudiante */}
        <div className="mt-4">
          <BuzonTareaMoodle asignacion={asignacion} esVistaPrevia={true} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
