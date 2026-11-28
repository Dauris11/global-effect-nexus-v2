"use client";

import {
  AlertTriangle,
  Bus,
  CalendarDays,
  Clock,
  Navigation,
  Play,
  Receipt,
  Square,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "@/i18n/navigation";
import type {
  TransporteHorario,
  TransporteParada,
  TransporteViaje,
} from "@/lib/transporte";

export function CabeceraChofer({
  viajeActivo,
  horarioSeleccionadoId,
  horariosDisponibles,
  paradas,
  posicionGps,
  cargando,
  alCambiarHorario,
  alCambiarParadaManual,
  alIniciarViaje,
  alFinalizarViaje,
  alAbrirIncidencia,
}: {
  viajeActivo: TransporteViaje | null;
  horarioSeleccionadoId: string;
  horariosDisponibles: TransporteHorario[];
  paradas: TransporteParada[];
  posicionGps: {
    lat: number;
    lng: number;
    rumbo: number;
    velocidad: number;
  } | null;
  cargando: boolean;
  alCambiarHorario: (id: string) => void;
  alCambiarParadaManual: (paradaId: string) => void;
  alIniciarViaje: () => void;
  alFinalizarViaje: () => void;
  alAbrirIncidencia: () => void;
}) {
  const t = useTranslations("transport");

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3 border-b border-linea pb-4">
        <div className="flex items-center gap-2.5">
          <span className="flex size-10 items-center justify-center rounded-control bg-marca-50 text-marca-600">
            <Bus className="size-5" />
          </span>
          <div>
            <h2 className="texto-titulo-tarjeta">{t("driverCockpit")}</h2>
          </div>
        </div>

        {/* En espera → neutral, En ruta → progress, Finalizado → success (ux-rules §9). */}
        <StatusBadge
          status={viajeActivo ? viajeActivo.estado : "inactivo"}
          label={t(`driverStatus.${viajeActivo ? viajeActivo.estado : "standby"}` as never)}
        />
      </div>

      <div className="mt-4 space-y-3">
        {!viajeActivo ? (
          <div className="space-y-2">
            <Label>{t("selectTrip")}</Label>
            <Select
              value={horarioSeleccionadoId}
              onValueChange={alCambiarHorario}
              disabled={cargando}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("chooseTripPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {horariosDisponibles.map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    {h.nombre} ({h.hora_salida})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-control bg-muted/60 p-3.5 text-sm">
              <p className="font-semibold text-tinta">
                {viajeActivo.horario_nombre}
              </p>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-tinta-2">
                <span className="flex items-center gap-1">
                  <Clock className="size-3" /> {t("departure")}:{" "}
                  {viajeActivo.hora_salida}
                </span>
                {posicionGps && (
                  <span className="flex items-center gap-1 font-medium text-marca-600">
                    <Navigation className="size-3" />{" "}
                    {Math.round(posicionGps.velocidad)} km/h
                  </span>
                )}
              </div>
            </div>

            {paradas.length > 0 && (
              <div className="space-y-1.5">
                <Label>{t("manualStopSelectorLabel")}</Label>
                <Select
                  value={viajeActivo.parada_actual_id ?? undefined}
                  onValueChange={alCambiarParadaManual}
                  disabled={cargando}
                >
                  <SelectTrigger className="w-full text-xs">
                    <SelectValue placeholder={t("selectStopPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {paradas.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">
                        {p.orden}. {p.nombre}{" "}
                        {p.referencia ? `(${p.referencia})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 space-y-3">
        {!viajeActivo ? (
          // En el teléfono «Iniciar viaje» queda fijo sobre la barra de pestañas (h-16),
          // a 56 px de alto: es lo primero que se toca al subir a la guagua.
          <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-linea bg-background/95 p-3 backdrop-blur-md md:static md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
            <Button
              size="lg"
              onClick={alIniciarViaje}
              disabled={cargando || !horarioSeleccionadoId}
              className="w-full text-base"
            >
              <Play className="mr-2 size-5 fill-current" />
              {t("startTrip")}
            </Button>
          </div>
        ) : (
          <>
            <Button
              size="lg"
              variant="outline"
              onClick={alFinalizarViaje}
              cargando={cargando}
              className="w-full text-base"
            >
              <Square className="mr-2 size-5 fill-current" />
              {t("finishTrip")}
            </Button>

            <Button
              size="lg"
              variant="destructive"
              onClick={alAbrirIncidencia}
              cargando={cargando}
              className="w-full text-sm"
            >
              <AlertTriangle className="mr-2 size-4" />
              {t("reportBreakdownButton")}
            </Button>
          </>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2 border-t border-linea pt-3">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="justify-center gap-1.5"
        >
          <Link href="/administrativo/solicitudes?tipo=compra">
            <Receipt className="size-3.5" />
            <span>{t("requestMaintenanceOrPurchase")}</span>
          </Link>
        </Button>
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="justify-center gap-1.5"
        >
          <Link href="/reuniones">
            <CalendarDays className="size-3.5" />
            <span>{t("viewMeetings")}</span>
          </Link>
        </Button>
      </div>
    </Card>
  );
}
