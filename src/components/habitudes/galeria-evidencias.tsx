"use client";

import { useState } from "react";
import {
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  GraduationCap,
  MapPin,
  Sparkles,
  User,
  Users,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { HabitudesLiceo, HabitudesVisitaEvidencia } from "@/lib/habitudes";
import { cn } from "@/lib/utils";

interface GaleriaEvidenciasProps {
  visitasIniciales: HabitudesVisitaEvidencia[];
  liceos: HabitudesLiceo[];
}

export function GaleriaEvidencias({
  visitasIniciales,
  liceos,
}: GaleriaEvidenciasProps) {
  const t = useTranslations("habitudes");

  const [visitas, setVisitas] = useState(visitasIniciales);
  const [liceoFiltro, setLiceoFiltro] = useState<string>("todos");
  const [fotoModal, setFotoModal] = useState<{ url: string; titulo: string } | null>(
    null,
  );

  const visitasFiltradas = visitas.filter((v) => {
    return liceoFiltro === "todos" || v.liceo_id === liceoFiltro;
  });

  return (
    <div className="space-y-6">
      {/* Filtro por Liceo */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-tinta/70 mr-1">
          {t("filterByHighSchool")}:
        </span>
        <button
          type="button"
          onClick={() => setLiceoFiltro("todos")}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-semibold transition-all active:scale-95",
            liceoFiltro === "todos"
              ? "bg-marca-600 text-white"
              : "border border-linea-fuerte bg-card text-tinta-2 hover:bg-muted/60",
          )}
        >
          {t("catAll")} ({visitas.length})
        </button>
        {liceos.map((lic) => {
          const cuenta = visitas.filter((v) => v.liceo_id === lic.id).length;
          return (
            <button
              key={lic.id}
              type="button"
              onClick={() => setLiceoFiltro(lic.id)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold transition-all active:scale-95",
                liceoFiltro === lic.id
                  ? "bg-marca-600 text-white"
                  : "border border-linea-fuerte bg-card text-tinta-2 hover:bg-muted/60",
              )}
            >
              {lic.nombre} ({cuenta})
            </button>
          );
        })}
      </div>

      {/* Lista de Visitas con Galería */}
      {visitasFiltradas.length === 0 ? (
        <Card className="border-dashed border-2 py-12 text-center">
          <CardContent className="space-y-2">
            <Building2 className="mx-auto size-8 text-tinta/30" />
            <p className="font-semibold text-tinta">{t("emptyVisitsTitle")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {visitasFiltradas.map((visita) => (
            <Card
              key={visita.id}
              className="border-linea-fuerte bg-card p-5 shadow-xs transition-shadow hover:shadow-md"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="marca" className="font-semibold text-xs">
                      {visita.liceo_nombre}
                    </Badge>
                    <Badge variant="neutra" className="capitalize text-[11px]">
                      {visita.tanda}
                    </Badge>
                    <span className="flex items-center gap-1 text-xs text-tinta/60">
                      <Calendar className="size-3.5" />
                      {visita.fecha_visita}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-tinta">
                    {visita.tema_impartido}
                  </h3>

                  <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-tinta-2">
                    <span className="flex items-center gap-1 font-semibold text-marca-700">
                      <Users className="size-3.5" />
                      {visita.estudiantes_impactados} {t("studentsImpactedLabel")}
                    </span>
                    <span className="flex items-center gap-1 text-tinta/60">
                      <User className="size-3.5" />
                      {visita.facilitador_nombre}
                    </span>
                    <span className="flex items-center gap-1 text-tinta/60">
                      <MapPin className="size-3.5" />
                      {visita.distrito_educativo}
                    </span>
                  </p>

                  {visita.observaciones && (
                    <blockquote className="rounded-r-lg border-l-2 border-marca-500 bg-muted/40 p-2.5 text-xs text-tinta-2 italic">
                      &ldquo;{visita.observaciones}&rdquo;
                    </blockquote>
                  )}
                </div>

                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-marca-50 px-3 py-1 text-xs font-semibold text-marca-700">
                  <CheckCircle2 className="size-3.5" />
                  {t("statusCompleted")}
                </span>
              </div>

              {/* Mosaico de Fotografías de Evidencia */}
              {visita.fotos_urls && visita.fotos_urls.length > 0 && (
                <div className="mt-4 border-t border-linea pt-3">
                  <p className="mb-2 text-xs font-semibold text-tinta/70">
                    {t("photoEvidenceLabel")} ({visita.fotos_urls.length}):
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {visita.fotos_urls.map((foto, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() =>
                          setFotoModal({
                            url: foto,
                            titulo: `${visita.liceo_nombre} — ${visita.tema_impartido}`,
                          })
                        }
                        className="group relative aspect-video overflow-hidden rounded-lg border border-linea-fuerte bg-muted text-left transition-transform active:scale-95 hover:opacity-90"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={foto}
                          alt={`Evidencia ${idx + 1}`}
                          className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <span className="absolute bottom-1 right-1 flex size-6 items-center justify-center rounded-full bg-tinta/70 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                          <Eye className="size-3.5" />
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Lightbox / Modal de Fotografía en Alta Resolución */}
      <Dialog open={!!fotoModal} onOpenChange={(v) => !v && setFotoModal(null)}>
        <DialogContent className="max-w-3xl p-4">
          <DialogHeader className="mb-2">
            <DialogTitle className="text-sm font-semibold truncate text-tinta">
              {fotoModal?.titulo}
            </DialogTitle>
          </DialogHeader>
          {fotoModal && (
            <div className="overflow-hidden rounded-lg bg-black/90">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={fotoModal.url}
                alt={fotoModal.titulo}
                className="max-h-[75vh] w-full object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
