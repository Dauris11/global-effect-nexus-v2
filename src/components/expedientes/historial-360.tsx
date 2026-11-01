import { CalendarCheck, CalendarDays, UserCheck } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Dato, FilaDatos } from "@/components/ui/dato";
import { fechaCorta } from "@/lib/fechas";
import { ESTADO_360_VISUAL } from "@/lib/estado-360";
import { cn } from "@/lib/utils";
import type { Historial360 } from "@/server/estudiantes/historial-360";

/**
 * Las materias de Global Effect 360 de un estudiante, por cuatrimestre.
 *
 * Es un bloque APARTE de la carrera: son programas distintos y su promedio es
 * propio, nunca parte del índice académico. Sin materias no pinta nada, para no
 * enseñar una sección vacía a quien aún no entró al programa.
 *
 * Componente de servidor: lo comparten la ficha del expediente y el historial
 * académico, que lo reciben ya cargado.
 */
export async function Historial360({ datos }: { datos: Historial360 }) {
  if (datos.periodos.length === 0) return null;

  const t = await getTranslations("historial360");
  const idioma = (await getLocale()) === "en" ? "en" : "es";

  return (
    <section className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="texto-titulo-seccion">{t("title")}</h2>
        <Badge variant="marca">
          {t("average")} {datos.promedio?.toFixed(1) ?? "—"}
        </Badge>
      </div>

      {datos.periodos.map((periodo) => (
        <div key={periodo.id} className="space-y-2">
          <h3 className="texto-meta font-medium">{periodo.nombre}</h3>

          <ul className="divide-y divide-linea rounded-card border border-linea bg-card shadow-card">
            {periodo.materias.map((materia) => {
              const visual = ESTADO_360_VISUAL[materia.estado];

              return (
                <li key={materia.id} className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="min-w-0 truncate font-semibold">
                      {materia.materia}
                    </p>

                    <Badge className={cn("gap-1", visual.insignia)}>
                      <visual.icono aria-hidden />
                      {t(`status.${materia.estado}`)}
                    </Badge>
                  </div>

                  <FilaDatos>
                    {materia.nota !== null && (
                      <Dato icono={CalendarCheck}>
                        {t("grade")}: <b>{materia.nota.toFixed(1)}</b>
                      </Dato>
                    )}

                    <Dato icono={CalendarDays}>
                      {materia.marcadas === 0
                        ? t("noAttendance")
                        : t("attendance", {
                            presentes: materia.presentes,
                            total: materia.marcadas,
                          })}
                    </Dato>

                    {materia.decidida_por && materia.decidida_en && (
                      <Dato icono={UserCheck}>
                        {t("decidedBy", {
                          nombre: materia.decidida_por,
                          fecha: fechaCorta(materia.decidida_en, idioma),
                        })}
                      </Dato>
                    )}
                  </FilaDatos>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}
