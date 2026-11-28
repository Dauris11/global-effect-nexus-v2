"use client";

import { useState, useTransition } from "react";
import {
  AlertTriangle,
  Bus,
  Clock,
  Loader2,
  MapPin,
  Power,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Dato, FilaDatos } from "@/components/ui/dato";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import type { PasajeroViaje } from "@/lib/transporte";
import { cn } from "@/lib/utils";
import { alternarHorarioTransporte } from "@/server/transporte/acciones";
import type {
  IncidenciaAdminTransporte,
  TurnoConConteoAdmin,
} from "@/server/transporte/consultas";

export function PanelAdminTransporte({
  turnosIniciales,
  pasajerosPorHorario,
  incidencias,
}: {
  turnosIniciales: readonly TurnoConConteoAdmin[];
  pasajerosPorHorario: Record<string, PasajeroViaje[]>;
  incidencias: readonly IncidenciaAdminTransporte[];
}) {
  const t = useTranslations("transport");
  const tAdmin = useTranslations("transport.admin");

  const [turnos, setTurnos] = useState([...turnosIniciales]);
  const [turnoSeleccionado, setTurnoSeleccionado] = useState<string>(
    turnosIniciales[0]?.id ?? "",
  );
  const [cambiandoId, setCambiandoId] = useState<string | null>(null);
  const [, iniciarTransicion] = useTransition();

  const turnoActual = turnos.find((x) => x.id === turnoSeleccionado) ?? turnos[0];
  const pasajerosTurno = turnoActual
    ? (pasajerosPorHorario[turnoActual.id] ?? [])
    : [];

  const alternarTurno = (turno: TurnoConConteoAdmin) => {
    const siguiente = !turno.activo;
    setCambiandoId(turno.id);
    setTurnos((prev) =>
      prev.map((x) => (x.id === turno.id ? { ...x, activo: siguiente } : x)),
    );

    iniciarTransicion(async () => {
      const res = await alternarHorarioTransporte(turno.id, siguiente);
      if (!res.ok) {
        setTurnos((prev) =>
          prev.map((x) =>
            x.id === turno.id ? { ...x, activo: turno.activo } : x,
          ),
        );
      }
      setCambiandoId(null);
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 1. Turnos oficiales y viajes de hoy */}
        <Card>
          <CardContent className="space-y-4 pt-5">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="size-4 text-marca-500" />
              {tAdmin("shiftsTitle")}
            </CardTitle>

            <ul className="divide-y divide-linea">
              {turnos.map((turno) => {
                const seleccionado = turno.id === turnoActual?.id;
                const cargando = cambiandoId === turno.id;

                return (
                  <li
                    key={turno.id}
                    className={cn(
                      "flex flex-wrap items-center justify-between gap-3 py-3 transition-colors",
                      seleccionado && "rounded-control bg-marca-50/40 px-2.5",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setTurnoSeleccionado(turno.id)}
                      className="min-w-0 flex-1 cursor-pointer text-left"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-tinta">
                          {turno.nombre}
                        </span>
                        <Badge
                          variant={turno.activo ? "marca" : "neutra"}
                          className="text-[10px]"
                        >
                          {turno.activo
                            ? tAdmin("shiftActive")
                            : tAdmin("shiftPaused")}
                        </Badge>
                        {turno.viaje_hoy_estado && (
                          <Badge variant="outline" className="text-[10px]">
                            {t(`status.${turno.viaje_hoy_estado}` as never)}
                          </Badge>
                        )}
                      </div>

                      <FilaDatos className="mt-1 text-xs text-tinta-2">
                        <Dato icono={Clock}>{turno.hora_salida}</Dato>
                        <Dato icono={Users}>
                          {t("passengerCount", { count: turno.pasajeros_hoy })}
                        </Dato>
                        <Dato icono={Bus}>
                          {turno.chofer_hoy_nombre ?? tAdmin("noDriverYet")}
                        </Dato>
                      </FilaDatos>
                    </button>

                    <Button
                      type="button"
                      size="sm"
                      variant={turno.activo ? "outline" : "default"}
                      disabled={cargando}
                      onClick={() => alternarTurno(turno)}
                      className="gap-1.5"
                    >
                      {cargando ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Power className="size-3.5" />
                      )}
                      {turno.activo
                        ? tAdmin("pauseShift")
                        : tAdmin("activateShift")}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        {/* 2. Lista de pasajeros del turno seleccionado */}
        <Card>
          <CardContent className="space-y-4 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="size-4 text-marca-500" />
                {tAdmin("passengersTitle")}
              </CardTitle>
              {turnoActual && (
                <Badge variant="marca">
                  {turnoActual.nombre} · {turnoActual.hora_salida}
                </Badge>
              )}
            </div>

            {pasajerosTurno.length === 0 ? (
              <EstadoVacio
                icono={Users}
                titulo={tAdmin("noPassengersShift")}
              />
            ) : (
              <ul className="max-h-80 divide-y divide-linea overflow-y-auto pr-1">
                {pasajerosTurno.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-tinta">
                        {p.nombre}
                      </p>
                      <FilaDatos className="mt-0.5 text-tinta-2">
                        <Dato icono={MapPin}>
                          {p.parada_abordaje_nombre} → {p.parada_destino_nombre}
                        </Dato>
                      </FilaDatos>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {p.tipo === "recurrente"
                        ? tAdmin("typeRecurring")
                        : tAdmin("typeDaily")}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 3. Bitácora de incidencias reportadas por choferes */}
      <Card>
        <CardContent className="space-y-4 pt-5">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="size-4 text-marca-500" />
            {tAdmin("incidentsTitle")}
            {incidencias.length > 0 && (
              <Badge className="ml-1 bg-tinta text-[10px] text-background">
                {incidencias.length}
              </Badge>
            )}
          </CardTitle>

          {incidencias.length === 0 ? (
            <EstadoVacio icono={Bus} titulo={tAdmin("noIncidents")} />
          ) : (
            <ul className="divide-y divide-linea">
              {incidencias.map((inc) => (
                <li
                  key={inc.id}
                  className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {inc.tipo}
                      </Badge>
                      <span className="font-semibold text-tinta">
                        {inc.horario_nombre}
                      </span>
                      <span className="text-xs text-tinta-3">
                        {inc.fecha} · {inc.creado_en}
                      </span>
                    </div>
                    <p className="text-xs text-tinta-2">{inc.descripcion}</p>
                  </div>
                  {inc.chofer_nombre && (
                    <span className="text-xs font-medium text-tinta-3">
                      {tAdmin("driverLabel")}: {inc.chofer_nombre}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
