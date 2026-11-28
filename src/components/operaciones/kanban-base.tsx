"use client";

import { useState, useTransition, type ReactNode } from "react";
import { AlertCircle } from "lucide-react";

import { StatusBadge } from "@/components/app/status-badge";
import { ALERTA_RIESGO } from "@/lib/paleta";
import { visualEstado } from "@/lib/estados-trabajo";
import { cn } from "@/lib/utils";

/**
 * Un solo Kanban para proyectos, actividades y tareas.
 *
 * ARRASTRAR NO ES LA ÚNICA FORMA DE MOVER: cada tarjeta recibe `siguiente` y
 * `empujar` para ofrecer un botón que la lleva a la columna contigua, así quien
 * navega con teclado o lector de pantalla también cambia el estado. Las dos
 * formas llaman a la MISMA función `alMover`.
 *
 * La tarjeta se mueve en pantalla ANTES de que el servidor conteste; si la
 * escritura falla se devuelve a su columna y se avisa. El arrastre es HTML
 * nativo, como en el calendario: sin librería nueva.
 *
 * El color y el icono de cada columna salen de `visualEstado`
 * (`src/lib/estados-trabajo.ts`): el estado se lee por color Y por icono.
 */
export function KanbanBase<T>({
  columnas,
  etiquetaColumna,
  items,
  idDe,
  estadoDe,
  puedeMover,
  alMover,
  tarjeta,
  vacio,
  errorMover,
  className,
}: {
  columnas: readonly string[];
  etiquetaColumna: (columna: string) => string;
  items: readonly T[];
  idDe: (item: T) => string;
  estadoDe: (item: T) => string;
  puedeMover: (item: T) => boolean;
  /** Devuelve `true` si el servidor aceptó el cambio. */
  alMover: (id: string, destino: string) => Promise<boolean>;
  tarjeta: (
    item: T,
    contexto: { siguiente: string | null; empujar: () => void; puedeMover: boolean },
  ) => ReactNode;
  vacio: string;
  errorMover: string;
  className?: string;
}) {
  // Movimientos aún sin confirmar; se guardan aparte de `items` (que llega del
  // servidor) para que la respuesta buena pise el estado optimista.
  const [movidos, setMovidos] = useState<Record<string, string>>({});
  const [arrastrado, setArrastrado] = useState<string | null>(null);
  const [encima, setEncima] = useState<string | null>(null);
  const [fallo, setFallo] = useState(false);
  const [, empezar] = useTransition();

  const estadoActual = (item: T) => movidos[idDe(item)] ?? estadoDe(item);

  function mover(id: string, destino: string) {
    const item = items.find((candidato) => idDe(candidato) === id);

    if (!item || !puedeMover(item) || estadoActual(item) === destino) return;

    setFallo(false);
    setMovidos((previo) => ({ ...previo, [id]: destino }));

    empezar(async () => {
      const bien = await alMover(id, destino);

      if (!bien) {
        // Devolverla a su sitio: mentir sobre dónde está algo es peor que no
        // dejar moverlo.
        setMovidos((previo) => {
          const copia = { ...previo };
          delete copia[id];
          return copia;
        });
        setFallo(true);
      }
    });
  }

  return (
    <div className={cn("space-y-3", className)}>
      {fallo && (
        <p role="alert" className={ALERTA_RIESGO.contenedor}>
          <AlertCircle className={ALERTA_RIESGO.icono} />
          <span className={ALERTA_RIESGO.texto}>{errorMover}</span>
        </p>
      )}

      <div
        className="grid gap-3 md:grid-cols-2 xl:grid-cols-[repeat(var(--columnas),minmax(0,1fr))]"
        style={{ "--columnas": columnas.length } as React.CSSProperties}
      >
        {columnas.map((columna) => {
          const visual = visualEstado(columna);
          const Icono = visual.icono;
          const dentro = items.filter((item) => estadoActual(item) === columna);
          const sobre = encima === columna && arrastrado !== null;
          const indice = columnas.indexOf(columna);
          const siguiente = columnas[indice + 1] ?? null;

          return (
            <section
              key={columna}
              aria-label={etiquetaColumna(columna)}
              onDragOver={(evento) => {
                evento.preventDefault();
                if (encima !== columna) setEncima(columna);
              }}
              onDragLeave={() => {
                if (encima === columna) setEncima(null);
              }}
              onDrop={() => {
                if (arrastrado) mover(arrastrado, columna);
                setArrastrado(null);
                setEncima(null);
              }}
              className={cn(
                "min-h-40 rounded-card border border-t-2 border-linea p-3 transition-colors",
                visual.franja,
                "bg-card",
                sobre && "ring-2 ring-tinta/20",
              )}
            >
              <header className="mb-3 flex items-center justify-between gap-2">
                <p className={cn("flex items-center gap-1.5 text-sm font-semibold", visual.texto)}>
                  <Icono className="size-4" aria-hidden />
                  {etiquetaColumna(columna)}
                </p>
                <StatusBadge status={columna} label={String(dentro.length)} className="tabular-nums" />
              </header>

              {dentro.length === 0 ? (
                <p className="py-6 text-center text-xs text-tinta-3">{vacio}</p>
              ) : (
                <ul className="space-y-2">
                  {dentro.map((item) => {
                    const id = idDe(item);
                    const movible = puedeMover(item);

                    return (
                      <li
                        key={id}
                        draggable={movible}
                        onDragStart={() => setArrastrado(id)}
                        onDragEnd={() => {
                          setArrastrado(null);
                          setEncima(null);
                        }}
                        className={cn(
                          movible && "cursor-grab active:cursor-grabbing",
                          arrastrado === id && "opacity-50",
                        )}
                      >
                        {tarjeta(item, {
                          siguiente,
                          empujar: () => siguiente && mover(id, siguiente),
                          puedeMover: movible,
                        })}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
