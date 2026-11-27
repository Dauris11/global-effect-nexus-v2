"use client";

import { useState } from "react";
import { ChevronDown, ClipboardCheck, FileText, Megaphone, Paperclip } from "lucide-react";
import { useTranslations } from "next-intl";

import { StatusBadge } from "@/components/app/status-badge";
import { PanelEntrega } from "@/components/estudiante/clases/panel-entrega";
import type { TareaVista } from "@/lib/clases";
import { cn } from "@/lib/utils";

export type SeccionTareas = {
  id: string;
  titulo: string;
  tareas: TareaVista[];
  /** Con `colapsable`, si arranca desplegada. */
  abierta?: boolean;
};

const ICONO = {
  tarea: ClipboardCheck,
  examen: FileText,
  material: Paperclip,
  anuncio: Megaphone,
} as const;

/**
 * Lista de tareas (y de materiales) en secciones, con el panel de entrega.
 *
 * Es cliente porque abrir el panel tiene que ser instantáneo (entregar = 2
 * clics): con el panel en la URL cada apertura sería un viaje al servidor. Las
 * secciones pueden ser grupos de estado («Vencidas», «Esta semana»…) o semanas
 * de contenido, plegables con `<details>`, que se pliegan sin JavaScript.
 */
export function ListaAgrupada({
  secciones,
  colapsable = false,
  mostrarClase = true,
}: {
  secciones: readonly SeccionTareas[];
  colapsable?: boolean;
  /** En el detalle de una clase el nombre de la clase sobra. */
  mostrarClase?: boolean;
}) {
  const [seleccion, setSeleccion] = useState<TareaVista | null>(null);
  const [abierto, setAbierto] = useState(false);

  const abrir = (tarea: TareaVista) => {
    setSeleccion(tarea);
    setAbierto(true);
  };

  return (
    <>
      <div className="space-y-6">
        {secciones.map((seccion) => {
          const lista = (
            <ul className="divide-y divide-linea overflow-hidden rounded-card border border-linea bg-card">
              {seccion.tareas.map((tarea) => (
                <Fila key={tarea.id} tarea={tarea} mostrarClase={mostrarClase} onAbrir={abrir} />
              ))}
            </ul>
          );

          return colapsable ? (
            <details key={seccion.id} open={seccion.abierta} className="group space-y-3">
              <summary className="text-section flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
                <span>
                  {seccion.titulo}
                  <span className="text-meta ml-2 tabular-nums">{seccion.tareas.length}</span>
                </span>
                <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180" />
              </summary>
              {lista}
            </details>
          ) : (
            <section key={seccion.id} className="space-y-3">
              <h2 className="text-section">
                {seccion.titulo}
                <span className="text-meta ml-2 tabular-nums">{seccion.tareas.length}</span>
              </h2>
              {lista}
            </section>
          );
        })}
      </div>

      <PanelEntrega tarea={seleccion} abierto={abierto} onCerrar={() => setAbierto(false)} />
    </>
  );
}

function Fila({
  tarea,
  mostrarClase,
  onAbrir,
}: {
  tarea: TareaVista;
  mostrarClase: boolean;
  onAbrir: (tarea: TareaVista) => void;
}) {
  const t = useTranslations("studentClasses");
  const Icono = ICONO[tarea.tipo];
  const evaluable = tarea.tipo === "tarea" || tarea.tipo === "examen";
  const estado = tarea.vencida ? "vencida" : tarea.estado;

  return (
    <li className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
      <Icono aria-hidden className="size-5 shrink-0 text-tinta-2" />
      <button
        type="button"
        onClick={() => onAbrir(tarea)}
        className={cn(
          "flex min-h-11 min-w-0 flex-1 flex-col items-start justify-center text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        )}
      >
        <span className="text-body w-full truncate font-medium">{tarea.titulo}</span>
        <span className="text-meta w-full truncate">
          {[mostrarClase ? tarea.materia : null, tarea.venceTexto ? t("tasks.due", { fecha: tarea.venceTexto }) : null]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </button>
      {evaluable ? (
        <div className="flex shrink-0 items-center gap-2">
          {tarea.estado === "calificado" && tarea.calificacion !== null && (
            <span className="text-label tabular-nums">
              {tarea.calificacion}/{tarea.puntaje}
            </span>
          )}
          <StatusBadge status={estado} label={estado === "pendiente" ? t("state.pending") : undefined} />
        </div>
      ) : tarea.archivoUrl ? (
        <a
          href={tarea.archivoUrl}
          target="_blank"
          rel="noreferrer"
          className="text-label inline-flex min-h-11 items-center text-marca-600 hover:underline"
        >
          {t("panel.openFile")}
        </a>
      ) : null}
    </li>
  );
}
