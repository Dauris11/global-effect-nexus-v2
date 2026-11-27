"use client";

import { useMemo, useState, useTransition } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Clock,
  Download,
  ExternalLink,
  FileCheck2,
  Loader2,
  Save,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { StatusBadge } from "@/components/app/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Input } from "@/components/ui/input";
import { fechaCorta } from "@/lib/fechas";
import type { EntregaRevisable, TareaRevisable } from "@/lib/revision-entregas";
import { cn } from "@/lib/utils";
import { calificarEntregaMoodleAction } from "@/server/moodle/acciones";

type Filtro = "pendientes" | "calificadas" | "todas";

/**
 * El único sitio donde el docente califica. Elige la tarea, ve la lista de
 * quienes entregaron y, al lado, LO QUE ENVIÓ (el archivo en vista previa y el
 * texto), con la nota y el comentario debajo. «Guardar y siguiente» salta a la
 * próxima entrega por calificar de la misma tarea, para revisar sin volver a la
 * lista.
 *
 * Una nota guardada actualiza la lista al instante, sin recargar: el estado
 * local manda hasta que el servidor revalida.
 */
export function RevisorEntregas({
  tareas,
  tareaInicialId,
  idioma,
}: {
  tareas: readonly TareaRevisable[];
  tareaInicialId?: string;
  idioma: "es" | "en";
}) {
  const t = useTranslations("teacherPortal.review");
  const tSub = useTranslations("teacherPortal.submissions");

  const [tareaId, setTareaId] = useState(
    tareas.find((tarea) => tarea.id === tareaInicialId)?.id ?? tareas[0]?.id ?? "",
  );
  const [filtro, setFiltro] = useState<Filtro>("pendientes");
  const [elegidaId, setElegidaId] = useState<string | null>(null);
  // Lo ya calificado en esta sesión: nota y comentario por id de entrega.
  const [guardadas, setGuardadas] = useState<
    Record<string, { calificacion: number; comentario: string }>
  >({});

  const tarea = tareas.find((candidata) => candidata.id === tareaId);

  const entregas = useMemo(
    () =>
      (tarea?.entregas ?? []).map((entrega) => {
        const guardada = guardadas[entrega.id];

        return guardada
          ? { ...entrega, estado: "calificado", ...guardada }
          : entrega;
      }),
    [tarea, guardadas],
  );

  const pendientes = entregas.filter((entrega) => entrega.estado !== "calificado");
  const visibles = entregas.filter((entrega) =>
    filtro === "todas"
      ? true
      : filtro === "pendientes"
        ? entrega.estado !== "calificado"
        : entrega.estado === "calificado",
  );
  const elegida =
    visibles.find((entrega) => entrega.id === elegidaId) ?? visibles[0] ?? null;

  const totalPendientes = (tareaX: TareaRevisable) =>
    tareaX.entregas.filter(
      (entrega) => entrega.estado !== "calificado" && !guardadas[entrega.id],
    ).length;

  if (tareas.length === 0) {
    return <EstadoVacio icono={FileCheck2} titulo={tSub("empty")} />;
  }

  function alGuardar(id: string, calificacion: number, comentario: string) {
    setGuardadas((previas) => ({ ...previas, [id]: { calificacion, comentario } }));
    // Salta a la siguiente por calificar; si no queda ninguna, se queda en la actual.
    const siguiente = pendientes.find((entrega) => entrega.id !== id);
    if (siguiente) {
      setElegidaId(siguiente.id);

      return;
    }
    // Se acabó la tarea: pasa a la siguiente que aún tenga algo por calificar.
    const otra = tareas.find(
      (candidata) =>
        candidata.id !== tareaId &&
        candidata.entregas.some((entrega) => entrega.estado !== "calificado" && !guardadas[entrega.id]),
    );
    if (otra) {
      setTareaId(otra.id);
      setElegidaId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {(["pendientes", "calificadas", "todas"] as const).map((valor) => (
              <button
                key={valor}
                type="button"
                aria-pressed={filtro === valor}
                onClick={() => setFiltro(valor)}
                className={cn(
                  "inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium transition-colors",
                  filtro === valor
                    ? "border-marca-500 bg-marca-50 text-marca-700"
                    : "border-linea bg-card text-tinta-2 hover:bg-muted/50",
                )}
              >
                {t(`filter.${valor}`)}
              </button>
            ))}
          </div>

          <ul className="space-y-2">
            {tareas.map((candidata) => {
              const activa = candidata.id === tareaId;
              const pendientesDeEsta = totalPendientes(candidata);

              return (
                <li key={candidata.id} className="rounded-card border border-linea bg-card">
                  <button
                    type="button"
                    aria-expanded={activa}
                    onClick={() => {
                      setTareaId(candidata.id);
                      setElegidaId(null);
                    }}
                    className="flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2 text-left"
                  >
                    <span className="min-w-0">
                      <span className="text-body block truncate font-medium">{candidata.titulo}</span>
                      <span className="text-meta block truncate">{candidata.unidad}</span>
                    </span>
                    {pendientesDeEsta > 0 ? (
                      <StatusBadge status="pendiente" label={String(pendientesDeEsta)} />
                    ) : (
                      <StatusBadge status="completado" label={t("filter.done")} />
                    )}
                  </button>
                  {activa && <div className="space-y-2 border-t border-linea p-2">
          {visibles.length === 0 ? (
              <p className="py-8 text-center text-sm text-tinta-3">{tSub("empty")}</p>
            ) : (
              <ul className="space-y-1.5">
                {visibles.map((entrega) => {
                  const activa = elegida?.id === entrega.id;
                  const calificada = entrega.estado === "calificado";
                  const Icono = calificada ? CheckCircle2 : entrega.estado === "tarde" ? Clock : Circle;
  
                  return (
                    <li key={entrega.id}>
                      <button
                        type="button"
                        onClick={() => setElegidaId(entrega.id)}
                        aria-current={activa ? "true" : undefined}
                        className={cn(
                          "flex min-h-11 w-full items-center gap-2.5 rounded-control border px-3 py-2 text-left transition-colors",
                          activa
                            ? "border-marca-500 bg-marca-50"
                            : "border-linea bg-card hover:bg-muted/50",
                        )}
                      >
                        <Icono
                          className={cn(
                            "size-4 shrink-0",
                            calificada ? "text-status-success-fg" : "text-tinta-3",
                          )}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-tinta">
                          {entrega.estudiante}
                        </span>
                        {calificada && entrega.calificacion !== null && (
                          <span className="text-xs font-semibold text-tinta-2 tabular-nums">
                            {entrega.calificacion}/{tarea?.puntajeMaximo}
                          </span>
                        )}
                        {entrega.estado === "tarde" && (
                          <Badge variant="outline" className="text-[10px]">
                            {tSub("late")}
                          </Badge>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
  
                  </div>}
                </li>
              );
            })}
          </ul>
        </aside>

        <section aria-live="polite" className="min-w-0">
          {elegida && tarea ? (
            <DetalleEntrega
              key={elegida.id}
              entrega={elegida}
              puntajeMaximo={tarea.puntajeMaximo}
              idioma={idioma}
              hayOtraPendiente={pendientes.some((entrega) => entrega.id !== elegida.id)}
              alGuardar={alGuardar}
            />
          ) : (
            <EstadoVacio icono={FileCheck2} titulo={t("pick")} />
          )}
        </section>
      </div>
    </div>
  );
}

function DetalleEntrega({
  entrega,
  puntajeMaximo,
  idioma,
  hayOtraPendiente,
  alGuardar,
}: {
  entrega: EntregaRevisable;
  puntajeMaximo: number;
  idioma: "es" | "en";
  hayOtraPendiente: boolean;
  alGuardar: (id: string, calificacion: number, comentario: string) => void;
}) {
  const t = useTranslations("teacherPortal.review");
  const tSub = useTranslations("teacherPortal.submissions");
  const tProf = useTranslations("teacherPortal.assignedSubjects");
  const [nota, setNota] = useState(entrega.calificacion !== null ? String(entrega.calificacion) : "");
  const [comentario, setComentario] = useState(entrega.comentario ?? "");
  const [error, setError] = useState(false);
  const [guardando, iniciar] = useTransition();

  const sinContenido = !entrega.enlace && !entrega.textoRespuesta;

  function guardar() {
    setError(false);
    iniciar(async () => {
      const datos = new FormData();
      datos.set("entrega_id", entrega.id);
      datos.set("calificacion", nota);
      datos.set("comentario_profesor", comentario);
      const respuesta = await calificarEntregaMoodleAction(datos);

      if (respuesta.ok) alGuardar(entrega.id, Number(nota), comentario);
      else setError(true);
    });
  }

  // Enter guarda y salta a la siguiente: calificar diez entregas sin tocar el ratón.
  const alEnter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && nota.trim() !== "" && !guardando) {
      e.preventDefault();
      guardar();
    }
  };

  return (
    <div className="space-y-4 rounded-card border border-linea bg-card p-4 shadow-card md:p-5">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="texto-titulo-tarjeta">{entrega.estudiante}</h2>
          <p className="texto-meta">
            {entrega.fechaEntrega ? fechaCorta(entrega.fechaEntrega, idioma) : "—"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {entrega.estado === "tarde" && <Badge variant="outline">{tSub("late")}</Badge>}
          {entrega.enlace && (
            <>
              <a
                href={entrega.enlace}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-marca-600 hover:underline"
              >
                <ExternalLink className="size-4" />
                {tProf("openAttachment")}
              </a>
              <a
                href={entrega.enlace}
                download
                className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-marca-600 hover:underline"
              >
                <Download className="size-4" />
                {t("download")}
              </a>
            </>
          )}
        </div>
      </header>

      {entrega.enlace && entrega.tipoAdjunto === "pdf" && (
        <iframe
          src={entrega.enlace}
          title={t("previewOf", { nombre: entrega.estudiante })}
          className="h-[60vh] w-full rounded-control border border-linea bg-muted/30"
        />
      )}
      {entrega.enlace && entrega.tipoAdjunto === "imagen" && (
        // eslint-disable-next-line @next/next/no-img-element -- enlace firmado y externo: next/image no lo optimiza
        <img
          src={entrega.enlace}
          alt={t("previewOf", { nombre: entrega.estudiante })}
          className="max-h-[60vh] w-full rounded-control border border-linea bg-muted/30 object-contain"
        />
      )}

      {entrega.textoRespuesta && (
        <blockquote className="max-h-64 overflow-y-auto rounded-control bg-muted/50 p-3 text-sm whitespace-pre-wrap text-tinta">
          {entrega.textoRespuesta}
        </blockquote>
      )}

      {sinContenido && <p className="text-sm text-tinta-3">{t("nothingAttached")}</p>}

      <div className="grid gap-2 border-t border-linea pt-4 sm:grid-cols-[140px_minmax(0,1fr)]">
        <div className="space-y-1.5">
          <label htmlFor={`nota-${entrega.id}`} className="text-sm font-medium">
            {tSub("grade", { max: puntajeMaximo })}
          </label>
          <Input
            id={`nota-${entrega.id}`}
            type="number"
            min={0}
            max={puntajeMaximo}
            step="0.5"
            value={nota}
            autoFocus
            onChange={(e) => setNota(e.target.value)}
            onKeyDown={alEnter}
            placeholder={`/ ${puntajeMaximo}`}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`comentario-${entrega.id}`} className="text-sm font-medium">
            {tProf("feedbackPlaceholder")}
          </label>
          <Input
            id={`comentario-${entrega.id}`}
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            onKeyDown={alEnter}
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="flex items-center gap-1.5 text-sm font-medium text-status-danger-fg">
          <AlertCircle className="size-4" aria-hidden />
          {tProf("gradeError")}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="button" cargando={guardando} disabled={nota.trim() === ""} onClick={guardar}>
          {guardando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {hayOtraPendiente && entrega.estado !== "calificado" ? t("saveNext") : t("save")}
        </Button>
      </div>
    </div>
  );
}
