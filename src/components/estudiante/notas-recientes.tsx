import { Star } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { LetraNota } from "@/components/estudiante/letra-nota";
import type { PeriodoConNotas } from "@/components/estudiante/periodos";
import { EnlaceSeccion, FILA, Seccion } from "@/components/estudiante/seccion";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { aprobada, promedio } from "@/lib/notas";
import { cn } from "@/lib/utils";

/**
 * Las notas del período más reciente, en el inicio del portal.
 *
 * Solo el último: el historial entero, con su filtro y su distribución, está
 * en `/portal/estudiante/calificaciones`, y repetirlo aquí convertía el inicio
 * en una segunda pantalla de notas más larga que la de verdad.
 */
export async function NotasRecientes({
  periodo,
}: {
  periodo: PeriodoConNotas | undefined;
}) {
  const t = await getTranslations("studentPortal");

  return (
    <Seccion
      titulo={t("gradesTitle")}
      accion={
        <EnlaceSeccion
          href="/portal/estudiante/calificaciones"
          texto={t("viewHistory")}
        />
      }
    >
      {!periodo ? (
        <EstadoVacio
          icono={Star}
          titulo={t("gradesEmpty")}
        />
      ) : (
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-linea pb-2">
            <p className="text-sm font-semibold">{periodo.nombre}</p>
            <p className="texto-meta">
              {t("termSummary", {
                gpa:
                  promedio(periodo.notas.map((n) => n.gpa))?.toFixed(2) ?? "—",
                average:
                  promedio(periodo.notas.map((n) => n.nota))?.toFixed(1) ?? "—",
              })}
            </p>
          </div>

          <ul>
            {periodo.notas.map((nota) => (
              <li key={nota.id} className={FILA}>
                <LetraNota letra={nota.letra} />

                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{nota.materia}</p>
                  <p className="text-sm text-tinta-2">
                    {t(`gradesPage.origin.${nota.origen}`)}
                  </p>
                </div>

                {/* Aprobada en el azul de texto; reprobada en tinta, que es
                    lo que más pesa. */}
                <span
                  className={cn(
                    "shrink-0 text-base font-semibold tabular-nums",
                    aprobada(nota.nota) ? "text-marca-600" : "text-tinta",
                  )}
                >
                  {nota.nota.toFixed(1)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Seccion>
  );
}
