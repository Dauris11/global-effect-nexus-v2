"use client";

import { useMemo, useState, useTransition } from "react";
import { ExternalLink, FileCheck2, Loader2, Save } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Input } from "@/components/ui/input";
import { fechaCorta } from "@/lib/fechas";
import { calificarEntregaMoodleAction } from "@/server/moodle/acciones";

export type EntregaBandeja = {
  id: string;
  asignacion: string;
  unidad: string;
  estudiante: string;
  tarde: boolean;
  fechaEntrega: string | null;
  textoRespuesta: string | null;
  enlace: string | null;
  puntajeMaximo: number;
};

/**
 * La cola de entregas por calificar, agrupada por tarea. Una entrega calificada
 * sale de la lista al instante: la cola solo guarda lo que falta.
 */
export function BandejaEntregas({
  entregas,
  idioma,
}: {
  entregas: readonly EntregaBandeja[];
  idioma: "es" | "en";
}) {
  const t = useTranslations("teacherPortal.submissions");
  const [hechas, setHechas] = useState<ReadonlySet<string>>(new Set());

  const grupos = useMemo(() => {
    const porTarea = new Map<string, { titulo: string; unidad: string; filas: EntregaBandeja[] }>();
    for (const entrega of entregas) {
      if (hechas.has(entrega.id)) continue;
      const clave = `${entrega.unidad}::${entrega.asignacion}`;
      const grupo = porTarea.get(clave) ?? { titulo: entrega.asignacion, unidad: entrega.unidad, filas: [] };
      grupo.filas.push(entrega);
      porTarea.set(clave, grupo);
    }
    return [...porTarea.values()];
  }, [entregas, hechas]);

  const pendientes = grupos.reduce((suma, g) => suma + g.filas.length, 0);

  if (pendientes === 0) {
    return <EstadoVacio icono={FileCheck2} titulo={t("empty")} />;
  }

  return (
    <div className="space-y-5">
      <p className="texto-meta">{t("count", { count: pendientes })}</p>
      {grupos.map((grupo) => (
        <Card key={`${grupo.unidad}::${grupo.titulo}`} className="space-y-3 p-5">
          <div>
            <h2 className="texto-titulo-tarjeta">{grupo.titulo}</h2>
            <p className="texto-meta">{grupo.unidad}</p>
          </div>
          <ul className="space-y-3">
            {grupo.filas.map((entrega) => (
              <FilaEntrega
                key={entrega.id}
                entrega={entrega}
                idioma={idioma}
                alCalificar={() => setHechas((previas) => new Set(previas).add(entrega.id))}
              />
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}

function FilaEntrega({
  entrega,
  idioma,
  alCalificar,
}: {
  entrega: EntregaBandeja;
  idioma: "es" | "en";
  alCalificar: () => void;
}) {
  const t = useTranslations("teacherPortal.submissions");
  const tProf = useTranslations("teacherPortal.assignedSubjects");
  const [nota, setNota] = useState("");
  const [comentario, setComentario] = useState("");
  const [error, setError] = useState(false);
  const [guardando, iniciar] = useTransition();

  function guardar() {
    setError(false);
    iniciar(async () => {
      const datos = new FormData();
      datos.set("entrega_id", entrega.id);
      datos.set("calificacion", nota);
      datos.set("comentario_profesor", comentario);
      const respuesta = await calificarEntregaMoodleAction(datos);
      if (respuesta.ok) alCalificar();
      else setError(true);
    });
  }

  return (
    <li className="space-y-2 rounded-control border border-linea bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-tinta">{entrega.estudiante}</p>
          <p className="texto-meta">
            {entrega.fechaEntrega ? fechaCorta(entrega.fechaEntrega, idioma) : "—"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {entrega.tarde && <Badge variant="outline">{t("late")}</Badge>}
          {entrega.enlace && (
            <a
              href={entrega.enlace}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-marca-600 underline"
            >
              {tProf("openAttachment")}
              <ExternalLink className="size-4" />
            </a>
          )}
        </div>
      </div>

      {entrega.textoRespuesta && (
        <p className="whitespace-pre-wrap text-sm text-tinta-2">{entrega.textoRespuesta}</p>
      )}

      <div className="grid gap-2 sm:grid-cols-[120px_1fr_auto]">
        <Input
          type="number"
          min={0}
          max={entrega.puntajeMaximo}
          step="0.5"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder={`/ ${entrega.puntajeMaximo}`}
          aria-label={t("grade", { max: entrega.puntajeMaximo })}
        />
        <Input
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          placeholder={tProf("feedbackPlaceholder")}
          aria-label={tProf("feedbackPlaceholder")}
        />
        <Button type="button" cargando={guardando} disabled={nota.trim() === ""} onClick={guardar}>
          {guardando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {tProf("grade")}
        </Button>
      </div>
      {error && <p className="text-sm font-medium text-tinta">{tProf("gradeError")}</p>}
    </li>
  );
}
