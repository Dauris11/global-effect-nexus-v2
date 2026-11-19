"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { TipoIncidenciaTransporte } from "@/lib/transporte";

export function DialogoIncidenciaChofer({
  abierto,
  tipoIncidencia,
  descripcionIncidencia,
  cargando,
  alCambiarAbierto,
  alCambiarTipo,
  alCambiarDescripcion,
  alEnviar,
}: {
  abierto: boolean;
  tipoIncidencia: TipoIncidenciaTransporte;
  descripcionIncidencia: string;
  cargando: boolean;
  alCambiarAbierto: (abierto: boolean) => void;
  alCambiarTipo: (tipo: TipoIncidenciaTransporte) => void;
  alCambiarDescripcion: (texto: string) => void;
  alEnviar: () => void;
}) {
  const t = useTranslations("transport");

  return (
    <Dialog open={abierto} onOpenChange={alCambiarAbierto}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5" />
            {t("reportIncidentTitle")}
          </DialogTitle>
          <DialogDescription>{t("reportIncidentDesc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["averia_mecanica", t("incidentType.mechanical")],
                ["transito_pesado", t("incidentType.traffic")],
                ["desvio_ruta", t("incidentType.detour")],
                ["accidente", t("incidentType.emergency")],
              ] as const
            ).map(([tipo, etiqueta]) => (
              <Button
                key={tipo}
                type="button"
                variant={tipoIncidencia === tipo ? "default" : "outline"}
                size="sm"
                onClick={() => alCambiarTipo(tipo)}
                className="h-10 text-xs font-semibold"
              >
                {etiqueta}
              </Button>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label>{t("incidentDetailsLabel")}</Label>
            <Textarea
              rows={3}
              value={descripcionIncidencia}
              onChange={(e) => alCambiarDescripcion(e.target.value)}
              placeholder={t("incidentDetailsPlaceholder")}
              className="text-xs"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => alCambiarAbierto(false)}
          >
            {t("cancel")}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={alEnviar}
            disabled={cargando || !descripcionIncidencia.trim()}
          >
            {t("sendIncidentAlert")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
