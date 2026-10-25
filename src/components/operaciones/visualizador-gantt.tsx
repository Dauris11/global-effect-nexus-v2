"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Layers,
  Milestone,
  Sliders,
  Sparkles,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ProyectoDetalleGantt, TareaGantt } from "@/server/operaciones/gantt-consultas";
import { actualizarFechasTareaGantt } from "@/server/operaciones/gantt-acciones";

export function VisualizadorGantt({
  proyecto,
  puedeEditar,
}: {
  proyecto: ProyectoDetalleGantt;
  puedeEditar: boolean;
}) {
  const [zoom, setZoom] = useState<"dias" | "semanas">("dias");
  const [tareaSeleccionada, setTareaSeleccionada] = useState<TareaGantt | null>(null);

  // Calcular el rango cronológico global del proyecto
  const { fechaInicioMin, fechaFinMax, totalDias } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;

    if (proyecto.tareas.length === 0) {
      const hoy = new Date();
      return {
        fechaInicioMin: hoy,
        fechaFinMax: new Date(hoy.getTime() + 30 * 86400000),
        totalDias: 30,
      };
    }

    for (const t of proyecto.tareas) {
      const dInicio = new Date(t.fecha_inicio).getTime();
      const dFin = new Date(t.fecha_limite).getTime();
      if (!isNaN(dInicio) && dInicio < min) min = dInicio;
      if (!isNaN(dFin) && dFin > max) max = dFin;
    }

    // Agregar un margen de 2 días a la izquierda y 5 a la derecha
    const fMin = new Date(min - 2 * 86400000);
    const fMax = new Date(max + 5 * 86400000);
    const diff = Math.max(15, Math.ceil((fMax.getTime() - fMin.getTime()) / 86400000));

    return {
      fechaInicioMin: fMin,
      fechaFinMax: fMax,
      totalDias: diff,
    };
  }, [proyecto.tareas]);

  const anchoDiaPx = zoom === "dias" ? 36 : 18;
  const anchoTotalGantt = totalDias * anchoDiaPx;

  // Generar cabecera de fechas
  const diasCabecera = useMemo(() => {
    const arr: { fecha: Date; diaMes: number; nombreDia: string }[] = [];
    for (let i = 0; i < totalDias; i++) {
      const d = new Date(fechaInicioMin.getTime() + i * 86400000);
      arr.push({
        fecha: d,
        diaMes: d.getDate(),
        nombreDia: d.toLocaleDateString("es-DO", { weekday: "narrow" }),
      });
    }
    return arr;
  }, [fechaInicioMin, totalDias]);

  // Cálculo de posición y ancho en porcentaje o píxeles
  const calcularPosicionBarra = (fechaInicio: string, fechaFin: string) => {
    const tInicio = new Date(fechaInicio).getTime();
    const tFin = new Date(fechaFin).getTime();
    const diasDesdeInicio = Math.max(
      0,
      (tInicio - fechaInicioMin.getTime()) / 86400000,
    );
    const duracionDias = Math.max(
      1,
      Math.ceil((tFin - tInicio) / 86400000) + 1,
    );

    return {
      left: diasDesdeInicio * anchoDiaPx,
      width: duracionDias * anchoDiaPx,
    };
  };

  return (
    <div className="space-y-4">
      {/* Controles del diagrama */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-linea pb-3">
        <div className="flex items-center gap-2">
          <Badge variant="neutra" className="font-mono text-xs">
            {proyecto.tareas.length} Tareas en Cronograma
          </Badge>
          <Badge variant="marca" className="font-mono text-xs">
            {proyecto.fases.length} Fases
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-linea bg-superficie p-0.5">
            <button
              type="button"
              onClick={() => setZoom("dias")}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                zoom === "dias" ? "bg-marca-500 text-white" : "text-tinta-2 hover:text-tinta"
              }`}
            >
              Días
            </button>
            <button
              type="button"
              onClick={() => setZoom("semanas")}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                zoom === "semanas" ? "bg-marca-500 text-white" : "text-tinta-2 hover:text-tinta"
              }`}
            >
              Semanas
            </button>
          </div>
        </div>
      </div>

      {/* Contenedor del Gantt */}
      <div className="flex overflow-hidden rounded-2xl border border-linea bg-superficie shadow-card">
        {/* Columna Izquierda: Nombres de tareas y responsables */}
        <div className="w-64 shrink-0 border-r border-linea bg-superficie">
          {/* Cabecera izquierda */}
          <div className="h-14 border-b border-linea bg-muted/30 px-4 py-3 font-semibold text-xs text-tinta flex items-center">
            Actividades / Tareas
          </div>
          {/* Filas de títulos */}
          <div className="divide-y divide-linea">
            {proyecto.tareas.map((tarea) => (
              <div
                key={tarea.id}
                onClick={() => setTareaSeleccionada(tarea)}
                className={`flex h-12 cursor-pointer items-center justify-between px-3 text-xs transition-colors hover:bg-muted/40 ${
                  tareaSeleccionada?.id === tarea.id ? "bg-marca-50/40 font-semibold text-marca-600" : "text-tinta"
                }`}
              >
                <div className="truncate pr-2">
                  <p className="truncate font-medium">{tarea.titulo}</p>
                  <p className="text-[10px] text-tinta-3">{tarea.asignados || "Sin asignar"}</p>
                </div>
                <span className="font-mono text-[10px] text-tinta-2">{tarea.progreso}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Columna Derecha: Timeline gráfico desplazable */}
        <div className="flex-1 overflow-x-auto">
          <div style={{ width: anchoTotalGantt }} className="relative select-none">
            {/* Cabecera de fechas */}
            <div className="flex h-14 border-b border-linea bg-muted/20">
              {diasCabecera.map((dia, idx) => (
                <div
                  key={idx}
                  style={{ width: anchoDiaPx }}
                  className="flex flex-col items-center justify-center border-r border-linea/40 text-[10px]"
                >
                  <span className="font-mono text-tinta font-bold">{dia.diaMes}</span>
                  <span className="text-[9px] text-tinta-3 uppercase">{dia.nombreDia}</span>
                </div>
              ))}
            </div>

            {/* Filas del Gantt con barras de tareas */}
            <div className="relative divide-y divide-linea/60">
              {/* Líneas guía verticales */}
              <div className="pointer-events-none absolute inset-0 flex">
                {diasCabecera.map((_, idx) => (
                  <div
                    key={idx}
                    style={{ width: anchoDiaPx }}
                    className="border-r border-linea/20"
                  />
                ))}
              </div>

              {/* Barras de actividades */}
              {proyecto.tareas.map((tarea) => {
                const pos = calcularPosicionBarra(tarea.fecha_inicio, tarea.fecha_limite);
                const esActiva = tareaSeleccionada?.id === tarea.id;

                return (
                  <div key={tarea.id} className="relative h-12">
                    <div
                      style={{
                        left: pos.left,
                        width: pos.width,
                      }}
                      onClick={() => setTareaSeleccionada(tarea)}
                      className={`group absolute top-2.5 h-7 cursor-pointer rounded-lg px-2 text-white shadow-xs transition-all flex items-center justify-between ${
                        tarea.es_hito
                          ? "bg-alerta-500"
                          : tarea.estado === "completada"
                            ? "bg-exito-500"
                            : "bg-marca-500 hover:bg-marca-600"
                      } ${esActiva ? "ring-2 ring-tinta shadow-md scale-[1.02]" : ""}`}
                    >
                      {/* Progreso visual interno */}
                      <div
                        style={{ width: `${tarea.progreso}%` }}
                        className="absolute left-0 top-0 bottom-0 rounded-lg bg-black/15 pointer-events-none"
                      />

                      <span className="relative z-10 truncate text-[11px] font-medium pr-1">
                        {tarea.titulo}
                      </span>
                      <span className="relative z-10 font-mono text-[9px] opacity-90">
                        {tarea.progreso}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Modal / Panel lateral de detalle de tarea */}
      {tareaSeleccionada && (
        <Card className="border-linea bg-superficie">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between border-b border-linea pb-3">
              <div>
                <span className="texto-meta text-xs">Detalle de Actividad</span>
                <h3 className="text-base font-bold text-tinta">{tareaSeleccionada.titulo}</h3>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTareaSeleccionada(null)}
                className="text-xs"
              >
                Cerrar
              </Button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
              <div>
                <p className="texto-meta">Fecha Inicio</p>
                <p className="font-mono font-semibold text-tinta">{tareaSeleccionada.fecha_inicio}</p>
              </div>
              <div>
                <p className="texto-meta">Fecha Límite</p>
                <p className="font-mono font-semibold text-tinta">{tareaSeleccionada.fecha_limite}</p>
              </div>
              <div>
                <p className="texto-meta">Progreso</p>
                <p className="font-mono font-bold text-marca-600">{tareaSeleccionada.progreso}%</p>
              </div>
              <div>
                <p className="texto-meta">Asignado a</p>
                <p className="font-medium text-tinta">{tareaSeleccionada.asignados || "Sin asignar"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
