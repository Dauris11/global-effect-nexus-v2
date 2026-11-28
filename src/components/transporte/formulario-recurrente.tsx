"use client";

import { useState, useTransition } from "react";
import {
  AlertCircle,
  ArrowUpDown,
  CalendarDays,
  Check,
  Clock,
  Copy,
  MapPin,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";

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
import { cn } from "@/lib/utils";
import {
  DIAS_SEMANA_TRANSPORTE,
  type TransporteHorario,
  type TransporteInscripcionRecurrente,
  type TransporteParada,
} from "@/lib/transporte";
import { guardarInscripcionRecurrente } from "@/server/transporte/acciones";

interface ViajeConfig {
  horarioId: string;
  paradaAbordajeId: string;
  paradaDestinoId: string;
}

interface DiaEstado {
  activo: boolean;
  viajes: ViajeConfig[];
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
  const [error, setError] = useState<string | null>(null);

  const paradaInicialAbordaje = paradas[0]?.id ?? "";
  const paradaInicialDestino = paradas[paradas.length - 1]?.id ?? "";

  // Inicializar estado de Lunes (1) a Sábado (6)
  const [dias, setDias] = useState<Record<number, DiaEstado>>(() => {
    const estadoInicial: Record<number, DiaEstado> = {};

    DIAS_SEMANA_TRANSPORTE.forEach(({ dia }) => {
      const delDia = inscripcionesIniciales.filter(
        (i) => i.dia_semana === dia && i.activo,
      );

      if (delDia.length > 0) {
        estadoInicial[dia] = {
          activo: true,
          viajes: delDia.map((i) => ({
            horarioId: i.horario_id,
            paradaAbordajeId: i.parada_abordaje_id || paradaInicialAbordaje,
            paradaDestinoId: i.parada_destino_id || paradaInicialDestino,
          })),
        };
      } else {
        estadoInicial[dia] = {
          activo: false,
          viajes: [
            {
              horarioId: horarios[0]?.id ?? "",
              paradaAbordajeId: paradaInicialAbordaje,
              paradaDestinoId: paradaInicialDestino,
            },
          ],
        };
      }
    });

    return estadoInicial;
  });

  const toggleDia = (dia: number) => {
    setGuardadoExitoso(false);
    setDias((prev) => {
      const actual = prev[dia];
      const nuevoActivo = !actual.activo;
      return {
        ...prev,
        [dia]: {
          ...actual,
          activo: nuevoActivo,
          viajes:
            actual.viajes.length === 0
              ? [
                  {
                    horarioId: horarios[0]?.id ?? "",
                    paradaAbordajeId: paradaInicialAbordaje,
                    paradaDestinoId: paradaInicialDestino,
                  },
                ]
              : actual.viajes,
        },
      };
    });
  };

  const agregarViaje = (dia: number) => {
    setGuardadoExitoso(false);
    setDias((prev) => {
      const actual = prev[dia];
      // Buscar el primer horario que aún no esté configurado para este día
      const usados = new Set(actual.viajes.map((v) => v.horarioId));
      const disponible = horarios.find((h) => !usados.has(h.id)) ?? horarios[0];

      // Si ya hay un viaje previo, para el viaje de vuelta sugerimos invertir las paradas
      const ultimoViaje = actual.viajes[actual.viajes.length - 1];
      const abordajeSugerido = ultimoViaje ? ultimoViaje.paradaDestinoId : paradaInicialAbordaje;
      const destinoSugerido = ultimoViaje ? ultimoViaje.paradaAbordajeId : paradaInicialDestino;

      return {
        ...prev,
        [dia]: {
          ...actual,
          viajes: [
            ...actual.viajes,
            {
              horarioId: disponible?.id ?? "",
              paradaAbordajeId: abordajeSugerido,
              paradaDestinoId: destinoSugerido,
            },
          ],
        },
      };
    });
  };

  const eliminarViaje = (dia: number, indice: number) => {
    setGuardadoExitoso(false);
    setDias((prev) => {
      const actual = prev[dia];
      const nuevosViajes = actual.viajes.filter((_, i) => i !== indice);
      return {
        ...prev,
        [dia]: {
          ...actual,
          activo: nuevosViajes.length > 0 ? actual.activo : false,
          viajes:
            nuevosViajes.length > 0
              ? nuevosViajes
              : [
                  {
                    horarioId: horarios[0]?.id ?? "",
                    paradaAbordajeId: paradaInicialAbordaje,
                    paradaDestinoId: paradaInicialDestino,
                  },
                ],
        },
      };
    });
  };

  const actualizarViaje = (
    dia: number,
    indice: number,
    cambio: Partial<ViajeConfig>,
  ) => {
    setGuardadoExitoso(false);
    setDias((prev) => {
      const actual = prev[dia];
      const nuevosViajes = actual.viajes.map((v, i) =>
        i === indice ? { ...v, ...cambio } : v,
      );
      return {
        ...prev,
        [dia]: {
          ...actual,
          viajes: nuevosViajes,
        },
      };
    });
  };

  const invertirParadas = (dia: number, indice: number) => {
    setGuardadoExitoso(false);
    setDias((prev) => {
      const actual = prev[dia];
      const viajeActual = actual.viajes[indice];
      if (!viajeActual) return prev;

      const nuevosViajes = actual.viajes.map((v, i) =>
        i === indice
          ? {
              ...v,
              paradaAbordajeId: v.paradaDestinoId,
              paradaDestinoId: v.paradaAbordajeId,
            }
          : v,
      );
      return {
        ...prev,
        [dia]: {
          ...actual,
          viajes: nuevosViajes,
        },
      };
    });
  };

  // Copia la configuración del día a todos los demás días activos
  const copiarATodos = (diaOrigen: number) => {
    const config = dias[diaOrigen];
    if (!config) return;

    setGuardadoExitoso(false);
    setDias((prev) => {
      const nuevo = { ...prev };
      DIAS_SEMANA_TRANSPORTE.forEach(({ dia }) => {
        nuevo[dia] = {
          activo: true,
          viajes: config.viajes.map((v) => ({ ...v })),
        };
      });
      return nuevo;
    });
  };

  const manejarGuardar = () => {
    // Validar duplicados de horario en el mismo día
    for (const [diaStr, config] of Object.entries(dias)) {
      if (config.activo) {
        const horarioIds = config.viajes.map((v) => v.horarioId);
        const unicos = new Set(horarioIds);
        if (unicos.size !== horarioIds.length) {
          const diaNum = Number(diaStr);
          const nombreDia = t(
            `days.${DIAS_SEMANA_TRANSPORTE.find((d) => d.dia === diaNum)?.llave ?? "monday"}`,
          );
          setError(
            t("duplicateShiftInDay", {
              dia: nombreDia,
              defaultValue: `Tienes turnos duplicados el ${nombreDia}. Elige turnos distintos.`,
            }),
          );
          return;
        }
      }
    }

    const datosParaGuardar: {
      diaSemana: number;
      horarioId: string;
      paradaAbordajeId: string;
      paradaDestinoId: string;
    }[] = [];

    Object.entries(dias).forEach(([diaStr, config]) => {
      if (config.activo) {
        const diaSemana = Number(diaStr);
        config.viajes.forEach((v) => {
          datosParaGuardar.push({
            diaSemana,
            horarioId: v.horarioId,
            paradaAbordajeId: v.paradaAbordajeId,
            paradaDestinoId: v.paradaDestinoId,
          });
        });
      }
    });

    setError(null);
    iniciarTransicion(async () => {
      const res = await guardarInscripcionRecurrente(datosParaGuardar);
      if (res.ok) {
        setGuardadoExitoso(true);
        setTimeout(() => setGuardadoExitoso(false), 4000);
      } else {
        setError(
          res.mensaje === "paradas_iguales"
            ? t("sameStopError")
            : res.mensaje === "estudiante_no_enlazado"
              ? t("studentNotLinkedError")
              : t("actionError"),
        );
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="texto-titulo-tarjeta">{t("weeklyScheduleTitle")}</h3>
          <p className="mt-1 text-sm text-tinta-2">
            {t("weeklyScheduleSubtitle")}
          </p>
        </div>

        <Button onClick={manejarGuardar} cargando={cargando} className="gap-2">
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

      {error && (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-control bg-tinta p-3 text-sm text-background"
        >
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </p>
      )}

      {/* Tarjetas por día de la semana */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DIAS_SEMANA_TRANSPORTE.map(({ dia, llave }) => {
          const config = dias[dia];
          if (!config) return null;

          return (
            <Card
              key={dia}
              className={cn(
                "flex flex-col p-4 transition-all",
                !config.activo && "bg-muted/40 opacity-75 shadow-none",
              )}
            >
              <div className="flex items-center justify-between border-b border-linea/60 pb-3">
                <div className="flex items-center gap-2">
                  <CalendarDays className="size-4 text-marca-500" />
                  <span className="text-sm font-bold text-tinta capitalize">
                    {t(`days.${llave}`)}
                  </span>
                  {config.activo && (
                    <span className="ml-1 rounded-full bg-marca-50 px-2 py-0.5 text-xs font-semibold text-marca-700">
                      {config.viajes.length}{" "}
                      {config.viajes.length === 1
                        ? t("tripCountSingle", { defaultValue: "viaje" })
                        : t("tripCountPlural", { defaultValue: "viajes" })}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={config.activo}
                    aria-label={t(`days.${llave}`)}
                    onClick={() => toggleDia(dia)}
                    className={cn(
                      "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-500 after:absolute after:-inset-3 after:content-['']",
                      config.activo ? "bg-marca-500" : "bg-muted-foreground/30",
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none block size-4 rounded-full bg-background shadow-card ring-0 transition-transform",
                        config.activo ? "translate-x-4" : "translate-x-0",
                      )}
                    />
                  </button>
                  {config.activo && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      title={t("copyToAll")}
                      onClick={() => copiarATodos(dia)}
                    >
                      <Copy className="size-3.5 text-tinta-3" />
                    </Button>
                  )}
                </div>
              </div>

              {config.activo ? (
                <div className="mt-3 flex flex-1 flex-col justify-between space-y-4">
                  <div className="space-y-4">
                    {config.viajes.map((viaje, idx) => (
                      <div
                        key={idx}
                        className="relative rounded-control border border-linea bg-surface p-3 text-sm shadow-sm"
                      >
                        <div className="mb-2.5 flex items-center justify-between">
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-marca-700">
                            <Clock className="size-3.5 text-marca-500" />
                            {idx === 0
                              ? t("tripGoing", { defaultValue: "Ida" })
                              : idx === 1
                                ? t("tripReturn", { defaultValue: "Vuelta" })
                                : t("tripNumber", {
                                    n: idx + 1,
                                    defaultValue: `Viaje ${idx + 1}`,
                                  })}
                          </span>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="size-7 text-muted-foreground hover:text-marca-700"
                              title={t("swapStops", {
                                defaultValue: "Invertir paradas (ida / vuelta)",
                              })}
                              onClick={() => invertirParadas(dia, idx)}
                            >
                              <ArrowUpDown className="size-3.5" />
                            </Button>
                            {config.viajes.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className="size-7 text-muted-foreground hover:text-danger"
                                title={t("removeTrip", {
                                  defaultValue: "Quitar viaje",
                                })}
                                onClick={() => eliminarViaje(dia, idx)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="space-y-3">
                          {/* Selector de Turno de Viaje */}
                          <div className="space-y-1">
                            <Label className="text-xs text-tinta-2">
                              {t("tripShift")}
                            </Label>
                            <Select
                              value={viaje.horarioId}
                              onValueChange={(horarioId) =>
                                actualizarViaje(dia, idx, { horarioId })
                              }
                            >
                              <SelectTrigger className="h-8.5 text-xs">
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
                            <Label className="gap-1 text-xs text-tinta-2">
                              <MapPin className="size-3 text-marca-500" />
                              {t("pickupStop")}
                            </Label>
                            <Select
                              value={viaje.paradaAbordajeId}
                              onValueChange={(paradaAbordajeId) =>
                                actualizarViaje(dia, idx, { paradaAbordajeId })
                              }
                            >
                              <SelectTrigger className="h-8.5 text-xs">
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
                            <Label className="gap-1 text-xs text-tinta-2">
                              <MapPin className="size-3 text-marca-700" />
                              {t("dropoffStop")}
                            </Label>
                            <Select
                              value={viaje.paradaDestinoId}
                              onValueChange={(paradaDestinoId) =>
                                actualizarViaje(dia, idx, { paradaDestinoId })
                              }
                            >
                              <SelectTrigger className="h-8.5 text-xs">
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
                      </div>
                    ))}
                  </div>

                  {/* Botón para agregar otro viaje al día (hasta máximo 4 viajes) */}
                  {config.viajes.length < horarios.length && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => agregarViaje(dia)}
                      className="w-full gap-1.5 text-xs"
                    >
                      <Plus className="size-3.5" />
                      {t("addAnotherTrip", {
                        defaultValue: "Agregar otro viaje a este día",
                      })}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="py-8 text-center texto-meta">
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
