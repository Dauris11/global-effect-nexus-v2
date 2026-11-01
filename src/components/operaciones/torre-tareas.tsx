"use client";

import { useMemo, useState, useTransition } from "react";
import {
  AlertCircle,
  CalendarClock,
  CalendarDays,
  CalendarOff,
  CalendarRange,
  CheckCircle2,
  FolderKanban,
  ListTodo,
  Loader2,
  MessageSquare,
  Pencil,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChipFiltro } from "@/components/ui/chip-filtro";
import { Dato } from "@/components/ui/dato";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { FilaChips } from "@/components/ui/fila-chips";
import { Progress } from "@/components/ui/progress";
import { Link } from "@/i18n/navigation";
import { PRIORIDAD, clasesDeEstado } from "@/lib/paleta";
import {
  ESTADOS_TAREA_COLABORADOR,
  FILTROS_TORRE,
  PASOS_PROGRESO,
  filtrarTareasTorre,
  type FiltroTorre,
  type TareaTorre,
} from "@/lib/torre-control";
import { cn } from "@/lib/utils";
import type { OpcionOperaciones } from "@/server/operaciones/consultas";
import { avanzarTarea } from "@/server/operaciones/torre-acciones";

import { AvisoError, DialogoComentarios, DialogoEditarTarea } from "./torre-dialogos";

const ICONO_FILTRO: Record<FiltroTorre, LucideIcon> = {
  abiertas: ListTodo,
  vencidas: AlertCircle,
  hoy: CalendarClock,
  semana: CalendarRange,
  sin_fecha: CalendarOff,
  completadas: CheckCircle2,
};

const SELECT_FILA =
  "h-11 rounded-control border border-linea-fuerte bg-card px-2 text-sm text-tinta outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Lista de tareas de la torre. Cada fila se mueve sola (estado y avance) sin
 * abrir nada: es lo que se hace diez veces al día, y un formulario por cambio
 * lo convertiría en trámite.
 */
export function TorreTareas({
  tareas,
  puedeCoordinar,
  personas,
}: {
  tareas: TareaTorre[];
  puedeCoordinar: boolean;
  personas: readonly OpcionOperaciones[];
}) {
  const t = useTranslations("torre");
  const [filtro, setFiltro] = useState<FiltroTorre>("abiertas");

  const conteos = useMemo(
    () =>
      Object.fromEntries(
        FILTROS_TORRE.map((f) => [f, filtrarTareasTorre(tareas, f).length]),
      ) as Record<FiltroTorre, number>,
    [tareas],
  );
  const visibles = useMemo(() => filtrarTareasTorre(tareas, filtro), [tareas, filtro]);

  return (
    <section className="space-y-4">
      <FilaChips etiqueta={t("filtersLabel")}>
        {FILTROS_TORRE.map((f) => (
          <ChipFiltro
            key={f}
            icono={ICONO_FILTRO[f]}
            etiqueta={`${t(`filters.${f}`)} · ${conteos[f]}`}
            activo={filtro === f}
            onClick={() => setFiltro(f)}
          />
        ))}
      </FilaChips>

      {visibles.length === 0 ? (
        <EstadoVacio icono={ListTodo} titulo={tareas.length ? t("empty") : t("emptyTower")} />
      ) : (
        <>
          <Card className="hidden overflow-hidden p-0 md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-linea text-left texto-meta">
                <tr>
                  <th className="px-4 py-3 font-medium">{t("cols.task")}</th>
                  <th className="px-4 py-3 font-medium">{t("cols.priority")}</th>
                  <th className="px-4 py-3 font-medium">{t("cols.due")}</th>
                  <th className="px-4 py-3 font-medium">{t("cols.status")}</th>
                  <th className="px-4 py-3 font-medium">{t("cols.progress")}</th>
                  <th className="px-4 py-3 text-right font-medium">{t("cols.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-linea">
                {visibles.map((tarea) => (
                  <FilaTarea key={tarea.id} tarea={tarea} puedeCoordinar={puedeCoordinar} personas={personas} />
                ))}
              </tbody>
            </table>
          </Card>

          <ul className="space-y-3 md:hidden">
            {visibles.map((tarea) => (
              <TarjetaTarea key={tarea.id} tarea={tarea} puedeCoordinar={puedeCoordinar} personas={personas} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

type PropsTarea = {
  tarea: TareaTorre;
  puedeCoordinar: boolean;
  personas: readonly OpcionOperaciones[];
};

/** Estado, avance y diálogos de una tarea: lo comparten la fila y la tarjeta. */
function useControlesTarea(tarea: TareaTorre) {
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciar] = useTransition();
  const [comentando, setComentando] = useState(false);
  const [editando, setEditando] = useState(false);

  function avanzar(cambio: { estado?: string; progreso?: number }) {
    iniciar(async () => {
      const r = await avanzarTarea({ id: tarea.id, ...cambio });
      setError(r.ok ? null : r.error);
    });
  }

  return { error, guardando, comentando, setComentando, editando, setEditando, avanzar };
}

function Selectores({ tarea, c }: { tarea: TareaTorre; c: ReturnType<typeof useControlesTarea> }) {
  const t = useTranslations("torre");
  const pasos = PASOS_PROGRESO.includes(tarea.progreso as never)
    ? PASOS_PROGRESO
    : [...PASOS_PROGRESO, tarea.progreso].sort((a, b) => a - b);

  return (
    <div className="flex items-center gap-2">
      <select
        aria-label={t("statusLabel", { titulo: tarea.titulo })}
        value={tarea.estado}
        disabled={c.guardando}
        onChange={(e) => c.avanzar({ estado: e.target.value })}
        className={SELECT_FILA}
      >
        {ESTADOS_TAREA_COLABORADOR.map((e) => (
          <option key={e} value={e}>
            {t(`status.${e}`)}
          </option>
        ))}
      </select>
      <select
        aria-label={t("progressLabel", { titulo: tarea.titulo })}
        value={tarea.progreso}
        disabled={c.guardando}
        onChange={(e) => c.avanzar({ progreso: Number(e.target.value) })}
        className={cn(SELECT_FILA, "w-20")}
      >
        {pasos.map((p) => (
          <option key={p} value={p}>
            {p}%
          </option>
        ))}
      </select>
      {c.guardando && <Loader2 className="size-4 animate-spin text-tinta-3" />}
    </div>
  );
}

function Botones({ tarea, puedeCoordinar, personas, c }: PropsTarea & { c: ReturnType<typeof useControlesTarea> }) {
  const t = useTranslations("torre");
  return (
    <div className="flex items-center justify-end gap-1">
      <Button variant="ghost" size="icon" onClick={() => c.setComentando(true)} aria-label={t("comments")}>
        <MessageSquare className="size-4" />
        {tarea.comentarios > 0 && <span className="text-xs">{tarea.comentarios}</span>}
      </Button>
      {puedeCoordinar && (
        <Button variant="ghost" size="icon" onClick={() => c.setEditando(true)} aria-label={t("edit")}>
          <Pencil className="size-4" />
        </Button>
      )}
      <DialogoComentarios tarea={tarea} abierto={c.comentando} alCambiar={c.setComentando} />
      {puedeCoordinar && (
        <DialogoEditarTarea tarea={tarea} personas={personas} abierto={c.editando} alCambiar={c.setEditando} />
      )}
    </div>
  );
}

function Titulo({ tarea }: { tarea: TareaTorre }) {
  const t = useTranslations("torre");
  return (
    <div className="min-w-0">
      <p className="font-medium text-tinta">{tarea.titulo}</p>
      <Dato icono={FolderKanban} className="mt-0.5">
        {tarea.proyecto_id ? (
          <Link href={`/administrativo/proyectos/${tarea.proyecto_id}`} className="hover:underline">
            {tarea.proyecto_nombre}
          </Link>
        ) : (
          t("noProject")
        )}
      </Dato>
    </div>
  );
}

function Vence({ tarea }: { tarea: TareaTorre }) {
  const t = useTranslations("torre");
  if (!tarea.fecha_limite) return <span className="texto-meta">{t("noDate")}</span>;
  if (tarea.vencida) {
    return (
      <Badge variant="solida">
        <AlertCircle />
        {tarea.fecha_limite}
      </Badge>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-1 text-sm", tarea.es_hoy ? "font-semibold text-marca-700" : "text-tinta-2")}>
      <CalendarDays className="size-4" />
      {tarea.fecha_limite}
    </span>
  );
}

function Prioridad({ tarea }: { tarea: TareaTorre }) {
  const t = useTranslations("torre");
  return <Badge className={PRIORIDAD[tarea.prioridad]?.clases}>{t(`priority.${tarea.prioridad}`)}</Badge>;
}

function FilaTarea(props: PropsTarea) {
  const { tarea } = props;
  const c = useControlesTarea(tarea);
  return (
    <tr className="align-middle">
      <td className="max-w-xs px-4 py-3">
        <Titulo tarea={tarea} />
        {c.error && <AvisoError clave={c.error} />}
      </td>
      <td className="px-4 py-3">
        <Prioridad tarea={tarea} />
      </td>
      <td className="px-4 py-3">
        <Vence tarea={tarea} />
      </td>
      <td className="px-4 py-3" colSpan={2}>
        <div className="flex items-center gap-3">
          <Selectores tarea={tarea} c={c} />
          <Progress value={tarea.progreso} className="w-20" />
        </div>
      </td>
      <td className="px-4 py-3">
        <Botones {...props} c={c} />
      </td>
    </tr>
  );
}

function TarjetaTarea(props: PropsTarea) {
  const { tarea } = props;
  const c = useControlesTarea(tarea);
  return (
    <li>
      <Card className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <Titulo tarea={tarea} />
          <Badge className={clasesDeEstado(tarea.estado)}>{tarea.progreso}%</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Prioridad tarea={tarea} />
          <Vence tarea={tarea} />
        </div>
        <Progress value={tarea.progreso} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Selectores tarea={tarea} c={c} />
          <Botones {...props} c={c} />
        </div>
        {c.error && <AvisoError clave={c.error} />}
      </Card>
    </li>
  );
}
