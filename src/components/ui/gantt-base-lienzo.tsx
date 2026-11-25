"use client";

import "@svar-ui/react-gantt/all.css";
import "./gantt-base.css";

import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Gantt, Tooltip, Willow, type IApi, type ITask } from "@svar-ui/react-gantt";
import { useCallback, useMemo, type FC } from "react";

import { aDia, aMs, diasEntre } from "@/lib/linea-tiempo";

export type EscalaGantt = "dia" | "semana" | "mes";

/**
 * Pieza interna de `GanttBase`: es lo único que toca la librería. Vive aparte
 * para cargarse solo en el navegador (`next/dynamic`, sin SSR) y para que la
 * página móvil, que dibuja una lista, no descargue el diagrama.
 */

export type TareaGantt = ITask & {
  clave?: string;
  tono?: string;
  aviso?: boolean;
  editable?: boolean;
  seccion?: boolean;
  total?: number;
  clase?: string;
  claseEtiqueta?: string;
  grupo?: string | null;
  detalle?: string | null;
  marcas?: { fecha: string; etiqueta: string }[];
  dependencias?: number;
};

export type EnlaceGantt = { id: string; source: string; target: string; type: "e2s" };

/** `YYYY-MM-DD` a medianoche local: la librería trabaja con la hora local. */
export const aFechaLocal = (dia: string) => {
  const [a, m, d] = dia.split("-").map(Number);
  return new Date(a, m - 1, d);
};

/** Día local de una fecha de la librería, `YYYY-MM-DD`. */
export const aDiaLocal = (f: Date) =>
  `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;

type Props = {
  tareas: TareaGantt[];
  enlaces: EnlaceGantt[];
  inicio: string;
  fin: string;
  hoy: string;
  escala: EscalaGantt;
  idioma: "es" | "en";
  /** Sin esto no hay arrastre: es la vista de solo lectura. */
  editable: boolean;
  etiquetas: { tarea: string; hoy: string; programada: string; atencion: string };
  alCambiarFechas: (id: string, inicio: string, fin: string) => void;
  alSeleccionar: (id: string | null) => void;
  apiRef: (api: IApi) => void;
};

export function GanttLienzo({
  tareas,
  enlaces,
  inicio,
  fin,
  hoy,
  escala,
  idioma,
  editable,
  etiquetas,
  alCambiarFechas,
  alSeleccionar,
  apiRef,
}: Props) {
  const fmt = useCallback(
    (opciones: Intl.DateTimeFormatOptions, f: Date) =>
      new Intl.DateTimeFormat(idioma, opciones).format(f).replace(".", ""),
    [idioma],
  );

  // Tres escalas: el ancho de la celda sale de cuántos días caben a la vista.
  const { scales, cellWidth } = useMemo(() => {
    const mesAnio = (f: Date) => fmt({ month: "long", year: "numeric" }, f);
    if (escala === "dia") {
      return {
        scales: [
          { unit: "month", step: 1, format: mesAnio },
          { unit: "day", step: 1, format: (f: Date) => String(f.getDate()) },
        ],
        cellWidth: 40,
      };
    }
    if (escala === "semana") {
      return {
        scales: [
          { unit: "month", step: 1, format: mesAnio },
          {
            unit: "week",
            step: 1,
            format: (f: Date, sig?: Date) => {
              const ultimo = new Date((sig ?? f).getTime() - 86_400_000);
              return `${f.getDate()}–${ultimo.getDate()}`;
            },
          },
        ],
        cellWidth: 84,
      };
    }
    return {
      scales: [
        { unit: "year", step: 1, format: (f: Date) => String(f.getFullYear()) },
        { unit: "month", step: 1, format: (f: Date) => fmt({ month: "short" }, f) },
      ],
      cellWidth: 72,
    };
  }, [escala, fmt]);

  const columnas = useMemo(
    () => [
      {
        id: "text",
        header: etiquetas.tarea,
        flexgrow: 1,
        width: 260,
        treetoggle: true,
        cell: celdaNombre(etiquetas.atencion) as never,
      },
    ],
    [etiquetas.tarea, etiquetas.atencion],
  );

  const marcadores = useMemo(
    () => [{ start: aFechaLocal(hoy), text: etiquetas.hoy, css: "gb-hoy" }],
    [hoy, etiquetas.hoy],
  );

  const plantilla: FC<{ data: ITask }> = useMemo(
    () =>
      function PlantillaBarra({ data }) {
        const t = data as TareaGantt;
        const apagada = t.tono === "apagado";
        const total = t.end && t.start ? diasEntre(aDiaLocal(t.start), aDiaLocal(t.end)) : 0;
        return (
          <div className={`gb-contenido gb-tono-${t.tono ?? "marca"}`}>
            {t.aviso && <AlertCircle className="size-3.5 shrink-0" aria-label={etiquetas.atencion} />}
            {apagada && <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />}
            <span className="gb-contenido-texto">{t.text}</span>
            {t.marcas?.map((m) => {
              const pos = total > 0 && t.start ? diasEntre(aDiaLocal(t.start), m.fecha) / total : -1;
              if (pos < 0 || pos > 1) return null;
              return (
                <span
                  key={m.fecha}
                  className="gb-marca"
                  style={{ left: `${pos * 100}%` }}
                  title={`${etiquetas.programada}: ${fmt({ day: "numeric", month: "short", year: "numeric" }, aFechaLocal(m.fecha))}`}
                />
              );
            })}
          </div>
        );
      },
    [etiquetas.programada, etiquetas.atencion, fmt],
  );

  const contenidoTooltip: FC<{ data: { task?: ITask } }> = useMemo(
    () =>
      function ContenidoTooltip({ data }) {
        const t = data.task as TareaGantt | undefined;
        if (!t || !t.start) return null;
        const finIncl = t.end ? aDia(aMs(aDiaLocal(t.end)) - 86_400_000) : aDiaLocal(t.start);
        const f = (d: Date | string) =>
          fmt({ day: "numeric", month: "short", year: "numeric" }, typeof d === "string" ? aFechaLocal(d) : d);
        return (
          <div className="gb-tooltip">
            <strong>{t.text}</strong>
            {t.claseEtiqueta && !t.seccion && <span>{[t.claseEtiqueta, t.grupo].filter(Boolean).join(" · ")}</span>}
            <span>
              {f(t.start)} → {f(finIncl)}
            </span>
            {t.detalle && <span>{t.detalle}</span>}
          </div>
        );
      },
    [fmt],
  );

  const iniciar = useCallback(
    (api: IApi) => {
      apiRef(api);

      // La edición se limita a mover y estirar fechas de lo editable: el resto
      // de acciones de la librería (borrar, enlazar, reordenar, abrir editor)
      // se cancelan aquí. El servidor vuelve a validar al guardar.
      const esEditable = (id: unknown) => Boolean(api.getTask(id as string)?.editable);
      api.intercept("drag-task", (ev: { id: string | number; top?: number }) => ev.top === undefined && esEditable(ev.id));
      api.intercept("update-task", (ev: { id: string | number; task: Partial<ITask> }) => {
        const mueveFechas = "start" in ev.task || "end" in ev.task;
        return mueveFechas && esEditable(ev.id);
      });
      for (const accion of ["add-link", "delete-link", "update-link", "add-task", "delete-task", "move-task", "indent-task", "copy-task", "show-editor"]) {
        api.intercept(accion, () => false);
      }

      api.on("update-task", (ev: { id: string | number; inProgress?: boolean }) => {
        if (ev.inProgress) return;
        const t = api.getTask(ev.id);
        if (!t?.start) return;
        const desde = aDiaLocal(t.start);
        // Un hito es un solo día; en una barra el fin de la librería es exclusivo.
        const ultimo = t.type === "milestone" || !t.end ? desde : aDia(aMs(aDiaLocal(t.end)) - 86_400_000);
        alCambiarFechas(String(ev.id), desde, ultimo < desde ? desde : ultimo);
      });
      api.on("select-task", (ev: { id: string | number }) => {
        const t = api.getTask(ev.id) as TareaGantt | undefined;
        alSeleccionar(t && !t.seccion ? String(ev.id) : null);
      });

      // Al abrir y al cambiar de escala, lo primero que se ve es hoy.
      const dia = aFechaLocal(hoy);
      if (dia >= aFechaLocal(inicio) && dia <= aFechaLocal(fin)) {
        setTimeout(() => api.exec("scroll-chart", { date: new Date(dia.getTime() - 5 * 86_400_000) }), 0);
      }
    },
    [alCambiarFechas, alSeleccionar, apiRef, fin, hoy, inicio],
  );

  return (
    <div className="gb-gantt h-[min(70vh,720px)] min-h-[320px]">
      <Willow fonts={false}>
        <Tooltip content={contenidoTooltip as never}>
          <Gantt
            tasks={tareas}
            links={enlaces}
            scales={scales}
            cellWidth={cellWidth}
            cellHeight={44}
            scaleHeight={36}
            start={aFechaLocal(inicio)}
            end={new Date(aFechaLocal(fin).getTime() + 86_400_000)}
            columns={columnas}
            gridWidth={280}
            markers={marcadores}
            readonly={!editable}
            taskTemplate={plantilla}
            highlightTime={(f, unidad) =>
              unidad === "day" && (f.getDay() === 0 || f.getDay() === 6) ? "gb-fin-semana" : ""
            }
            init={iniciar}
          />
        </Tooltip>
      </Willow>
    </div>
  );
}

/** Celda del árbol: las secciones van en versalitas con su conteo. */
const celdaNombre = (atencion: string) =>
  function CeldaNombre({ row }: { row: TareaGantt }) {
    if (row.seccion) {
      return (
        <span className="gb-celda gb-celda-seccion">
          <span className="gb-contenido-texto">{row.text}</span>
          <span className="gb-celda-conteo">{row.total}</span>
        </span>
      );
    }
    return (
      <span className="gb-celda">
        {row.aviso && <AlertCircle className="size-3.5 shrink-0" aria-label={atencion} />}
        <span className="gb-contenido-texto">{row.text}</span>
      </span>
    );
  };
