"use client";

import { useState, useTransition } from "react";
import { CalendarClock, Check, FolderKanban, ListTodo } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Dato, FilaDatos } from "@/components/ui/dato";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { fechaCorta } from "@/lib/fechas";
import { PRIORIDAD } from "@/lib/paleta";
import type { PrioridadTarea, TareaTorre } from "@/lib/torre-control";
import { cn } from "@/lib/utils";
import { avanzarTarea } from "@/server/operaciones/torre-acciones";

const MAXIMO = 8;

type Filtro = "todas" | "vencidas" | "urgentes";

export type EtiquetasTareasBandeja = {
  vacio: string;
  vacioFiltro: string;
  vencida: string;
  sinFecha: string;
  sinProyecto: string;
  todas: string;
  vencidas: string;
  urgentes: string;
  completar: string;
  error: string;
  prioridades: Record<PrioridadTarea, string>;
};

export function TareasBandejaInteractiva({
  tareasIniciales,
  idioma,
  etiquetas,
}: {
  tareasIniciales: readonly TareaTorre[];
  idioma: Locale;
  etiquetas: EtiquetasTareasBandeja;
}) {
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [completadasIds, setCompletadasIds] = useState<string[]>([]);
  const [fallo, setFallo] = useState(false);
  const [pendienteId, setPendienteId] = useState<string | null>(null);
  const [, empezar] = useTransition();

  const abiertas = tareasIniciales.filter(
    (t) => t.estado !== "completada" && !completadasIds.includes(t.id),
  );
  const vencidasCount = abiertas.filter((t) => t.vencida).length;
  const urgentesCount = abiertas.filter((t) => t.prioridad === "urgente").length;

  const visibles = abiertas.filter((t) => {
    if (filtro === "vencidas") return t.vencida;
    if (filtro === "urgentes") return t.prioridad === "urgente";
    return true;
  });

  function completar(id: string) {
    setFallo(false);
    setPendienteId(id);
    setCompletadasIds((prev) => [...prev, id]);

    empezar(async () => {
      const res = await avanzarTarea({ id, estado: "completada" });
      if (!res.ok) {
        setCompletadasIds((prev) => prev.filter((item) => item !== id));
        setFallo(true);
      }
      setPendienteId(null);
    });
  }

  if (abiertas.length === 0) {
    return <EstadoVacio icono={ListTodo} titulo={etiquetas.vacio} />;
  }

  const chips: { clave: Filtro; etiqueta: string; cantidad: number }[] = [
    { clave: "todas", etiqueta: etiquetas.todas, cantidad: abiertas.length },
    { clave: "vencidas", etiqueta: etiquetas.vencidas, cantidad: vencidasCount },
    { clave: "urgentes", etiqueta: etiquetas.urgentes, cantidad: urgentesCount },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {chips.map((chip) => {
          const activo = filtro === chip.clave;
          return (
            <button
              key={chip.clave}
              type="button"
              onClick={() => setFiltro(chip.clave)}
              className={cn(
                "inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors",
                activo
                  ? "border-marca-500 bg-marca-50 text-marca-700"
                  : "border-linea bg-card text-tinta-2 hover:bg-muted/50",
              )}
            >
              <span>{chip.etiqueta}</span>
              <span className="tabular-nums opacity-75">{chip.cantidad}</span>
            </button>
          );
        })}
      </div>

      {fallo && (
        <p role="alert" className="text-xs font-medium text-tinta">
          {etiquetas.error}
        </p>
      )}

      {visibles.length === 0 ? (
        <p className="py-4 text-center text-xs text-tinta-3">{etiquetas.vacioFiltro}</p>
      ) : (
        <ul>
          {visibles.slice(0, MAXIMO).map((tarea) => (
            <li
              key={tarea.id}
              className={cn(
                "-mx-2 flex items-start gap-2.5 border-b border-linea px-2 py-3 last:border-b-0",
                tarea.vencida && "border-l-2 border-l-tinta bg-muted/40",
              )}
            >
              <button
                type="button"
                aria-label={etiquetas.completar}
                title={etiquetas.completar}
                disabled={pendienteId === tarea.id}
                onClick={() => completar(tarea.id)}
                className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-linea-fuerte text-transparent transition-colors hover:border-marca-500 hover:bg-marca-50 hover:text-marca-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Check className="size-3" />
              </button>

              <span
                aria-hidden
                className={cn(
                  "mt-1.5 size-2.5 shrink-0 rounded-full",
                  PRIORIDAD[tarea.prioridad].punto,
                )}
              />

              <Link
                href="/administrativo/tareas"
                className="group min-w-0 flex-1 space-y-1 rounded-control p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <p className="truncate text-sm font-semibold text-tinta transition-colors group-hover:text-marca-600">
                  {tarea.titulo}
                </p>
                <FilaDatos>
                  <Dato icono={CalendarClock}>
                    {tarea.fecha_limite
                      ? fechaCorta(tarea.fecha_limite, idioma)
                      : etiquetas.sinFecha}
                  </Dato>
                  <Dato icono={FolderKanban}>
                    {tarea.proyecto_nombre ?? etiquetas.sinProyecto}
                  </Dato>
                </FilaDatos>
              </Link>

              <div className="flex shrink-0 flex-col items-end gap-1">
                {tarea.vencida && (
                  <Badge className="bg-tinta text-background">{etiquetas.vencida}</Badge>
                )}
                <Badge className={PRIORIDAD[tarea.prioridad].clases}>
                  {etiquetas.prioridades[tarea.prioridad]}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

