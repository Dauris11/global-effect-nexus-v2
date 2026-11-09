import { BookOpen, Clock, GraduationCap, UserRound } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { visualDeInscripcion } from "@/components/estudiante/prematricula-estado";
import { Badge } from "@/components/ui/badge";
import { Dato, FilaDatos } from "@/components/ui/dato";
import { cn } from "@/lib/utils";
import type { InscripcionDelEstudiante } from "@/server/estudiantes/academico";

/**
 * Las materias de la CARRERA del estudiante, por período y con su estado
 * (activa, aprobada, reprobada, retirada).
 *
 * La gráfica de arriba dice cómo va el índice, pero no qué está cursando ahora
 * ni qué dejó: eso es lo que se pregunta al abrir un expediente de becado.
 * Global Effect 360 no va aquí: es otro programa, con sus clases y su promedio
 * propios (ver `Historial360`).
 */
export async function MateriasUniversidad({
  inscripciones,
}: {
  inscripciones: InscripcionDelEstudiante[];
}) {
  const t = await getTranslations("records.portada");

  const periodos = new Map<string, { nombre: string; filas: InscripcionDelEstudiante[] }>();
  for (const fila of inscripciones) {
    const grupo = periodos.get(fila.periodo_id);
    if (grupo) grupo.filas.push(fila);
    else periodos.set(fila.periodo_id, { nombre: fila.periodo, filas: [fila] });
  }

  return (
    <section className="min-w-0 space-y-4">
      <h2 className="texto-titulo-seccion">{t("universidadTitulo")}</h2>

      {periodos.size === 0 ? (
        <p className="rounded-card border border-linea bg-card p-4 text-sm text-tinta-2">
          {t("universidadVacia")}
        </p>
      ) : (
        [...periodos.entries()].map(([id, periodo]) => (
          <div key={id} className="space-y-2">
            <h3 className="texto-meta font-medium">{periodo.nombre}</h3>

            <ul className="divide-y divide-linea rounded-card border border-linea bg-card shadow-card">
              {periodo.filas.map((fila) => {
                const visual = visualDeInscripcion(fila.estado);

                return (
                  <li key={fila.id} className="space-y-2 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="min-w-0 truncate font-semibold">
                        {[fila.codigo, fila.materia].filter(Boolean).join(" · ")}
                      </p>

                      <Badge className={cn("gap-1", visual.clases)}>
                        <visual.icono aria-hidden />
                        {t(`estadoMateria.${estadoConocido(fila.estado)}`)}
                      </Badge>
                    </div>

                    <FilaDatos>
                      {fila.profesor && <Dato icono={UserRound}>{fila.profesor}</Dato>}
                      {fila.horario && <Dato icono={Clock}>{fila.horario}</Dato>}
                      {fila.creditos !== null && (
                        <Dato icono={GraduationCap}>
                          {t("creditos", { n: fila.creditos })}
                        </Dato>
                      )}
                      {fila.aula && <Dato icono={BookOpen}>{fila.aula}</Dato>}
                    </FilaDatos>
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}

const ESTADOS = ["activa", "aprobada", "reprobada", "retirada"] as const;

/** `inscripcion.estado` es TEXT libre: lo desconocido se lee como retirada. */
function estadoConocido(estado: string): (typeof ESTADOS)[number] {
  return (ESTADOS as readonly string[]).includes(estado)
    ? (estado as (typeof ESTADOS)[number])
    : "retirada";
}
