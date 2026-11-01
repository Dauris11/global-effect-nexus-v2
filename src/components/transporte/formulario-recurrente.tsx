"use client";

import { useState, useTransition } from "react";
import {
  CalendarDays,
  Check,
  Copy,
  MapPin,
  Save,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  DIAS_SEMANA_TRANSPORTE,
  type TransporteHorario,
  type TransporteInscripcionRecurrente,
  type TransporteParada,
} from "@/lib/transporte";
import { guardarInscripcionRecurrenteAction } from "@/server/transporte/acciones";

interface HorarioDiaEstado {
  activo: boolean;
  horarioId: string;
  paradaAbordajeId: string;
  paradaDestinoId: string;
}

export function FormularioRecurrente({
  inscripcionesIniciales,
  horarios,
  paradas,
}: {
  inscripcionesIniciales: TransporteInscripcionRecurrente[];
  horarios: TransporteHorario[];
  paradas: TransporteParada[];
}) {
  const t = useTranslations("transport");
  const [cargando, iniciarTransicion] = useTransition();
  const [guardadoExitoso, setGuardadoExitoso] = useState(false);

  // Inicializar estado de Lunes (1) a Sábado (6)
  const [dias, setDias] = useState<Record<number, HorarioDiaEstado>>(() => {
    const estadoInicial: Record<number, HorarioDiaEstado> = {};

    DIAS_SEMANA_TRANSPORTE.forEach(({ dia }) => {
      const existente = inscripcionesIniciales.find((i) => i.dia_semana === dia);
      estadoInicial[dia] = {
        activo: Boolean(existente && existente.activo),
        horarioId: existente?.horario_id ?? horarios[0]?.id ?? "",
        paradaAbordajeId:
          existente?.parada_abordaje_id ?? paradas[0]?.id ?? "",
        paradaDestinoId:
          existente?.parada_destino_id ??
          paradas[paradas.length - 1]?.id ??
          "",
      };
    });

    return estadoInicial;
  });

  const actualizarDia = (
    dia: number,
    cambio: Partial<HorarioDiaEstado>,
  ) => {
    setGuardadoExitoso(false);
    setDias((prev) => ({
      ...prev,
      [dia]: {
        ...prev[dia],
        ...cambio,
      },
    }));
  };

  // Copia la configuración del primer día activo a todos los demás
  const copiarATodos = (diaOrigen: number) => {
    const config = dias[diaOrigen];
    if (!config) return;

    setGuardadoExitoso(false);
    setDias((prev) => {
      const nuevo = { ...prev };
      DIAS_SEMANA_TRANSPORTE.forEach(({ dia }) => {
        nuevo[dia] = {
          ...config,
          activo: true,
        };
      });
      return nuevo;
    });
  };

  const manejarGuardar = () => {
    const datosParaGuardar = Object.entries(dias)
      .filter(([_, config]) => config.activo)
      .map(([diaStr, config]) => ({
        diaSemana: Number(diaStr),
        horarioId: config.horarioId,
        paradaAbordajeId: config.paradaAbordajeId,
        paradaDestinoId: config.paradaDestinoId,
      }));

    iniciarTransicion(async () => {
      const res = await guardarInscripcionRecurrenteAction(datosParaGuardar);
      if (res.ok) {
        setGuardadoExitoso(true);
        setTimeout(() => setGuardadoExitoso(false), 4000);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-tinta">
            {t("weeklyScheduleTitle")}
          </h3>
          <p className="text-xs text-tinta-2">
            {t("weeklyScheduleSubtitle")}
          </p>
        </div>

        <Button
          onClick={manejarGuardar}
          disabled={cargando}
          className="gap-2 font-semibold shadow-sm"
        >
          {guardadoExitoso ? (
            <>
              <Check className="size-4" />
              {t("savedSchedule")}
            </>
          ) : (
            <>
              <Save className="size-4" />
              {t("saveSchedule")}
            </>
          )}
        </Button>
      </div>

      {/* Tarjetas por día de la semana */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {DIAS_SEMANA_TRANSPORTE.map(({ dia, llave }) => {
          const config = dias[dia];
          if (!config) return null;

          return (
            <Card
              key={dia}
              className={`border-linea p-4 transition-all ${
                config.activo ? "bg-card shadow-sm" : "bg-muted/40 opacity-70"
              }`}
            >
              <div className="flex items-center justify-between border-b border-linea/60 pb-3">
                <div className="flex items-center gap-2">
                  <CalendarDays className="size-4 text-marca-500" />
                  <span className="text-sm font-bold text-tinta capitalize">
                    {t(`days.${llave}`)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={config.activo}
                    aria-label={t(`days.${llave}`)}
                    onClick={() =>
                      actualizarDia(dia, { activo: !config.activo })
                    }
                    className={cn(
                      "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-500",
                      config.activo ? "bg-marca-500" : "bg-muted-foreground/30",
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none block size-4 rounded-full bg-white shadow-md ring-0 transition-transform",
                        config.activo ? "translate-x-4" : "translate-x-0",
                      )}
                    />
                  </button>
                  {config.activo && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      title={t("copyToAll")}
                      onClick={() => copiarATodos(dia)}
                    >
                      <Copy className="size-3.5 text-tinta-3" />
                    </Button>
                  )}
                </div>
              </div>

              {config.activo ? (
                <div className="mt-3 space-y-2.5 text-xs">
                  {/* Selector de Viaje */}
                  <div className="space-y-1">
                    <label className="font-medium text-tinta-2">
                      {t("tripShift")}
                    </label>
                    <Select
                      value={config.horarioId}
                      onValueChange={(horarioId) =>
                        actualizarDia(dia, { horarioId })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {horarios.map((h) => (
                          <SelectItem key={h.id} value={h.id}>
                            {h.nombre} ({h.hora_salida})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Parada de Abordaje */}
                  <div className="space-y-1">
                    <label className="flex items-center gap-1 font-medium text-tinta-2">
                      <MapPin className="size-3 text-marca-500" />
                      {t("pickupStop")}
                    </label>
                    <Select
                      value={config.paradaAbordajeId}
                      onValueChange={(paradaAbordajeId) =>
                        actualizarDia(dia, { paradaAbordajeId })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {paradas.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.orden}. {p.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Parada de Destino */}
                  <div className="space-y-1">
                    <label className="flex items-center gap-1 font-medium text-tinta-2">
                      <MapPin className="size-3 text-marca-700" />
                      {t("dropoffStop")}
                    </label>
                    <Select
                      value={config.paradaDestinoId}
                      onValueChange={(paradaDestinoId) =>
                        actualizarDia(dia, { paradaDestinoId })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {paradas.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.orden}. {p.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-tinta-3">
                  {t("noTripThisDay")}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

