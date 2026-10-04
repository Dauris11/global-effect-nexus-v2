import { getTranslations } from "next-intl/server";

import { LetraNota } from "@/components/estudiante/letra-nota";
import type { PeriodoConNotas } from "@/components/estudiante/periodos";
import { Seccion } from "@/components/estudiante/seccion";
import { Badge } from "@/components/ui/badge";
import { aprobada, promedio } from "@/lib/notas";
import { cn } from "@/lib/utils";

/**
 * Las notas de un período, en las dos formas del patrón de listado
 * (docs/09-sistema-visual.md §4.6): tabla limpia en ≥ md y tarjetas en el
 * móvil, donde cinco columnas no caben sin correrse de lado.
 *
 * La letra lleva el color de `colorDeLetra` (`lib/notas.ts`); la cifra va en
 * el azul de texto si aprueba y en tinta si no, que es lo que más pesa.
 */
export async function TablaNotas({ periodo }: { periodo: PeriodoConNotas }) {
  const t = await getTranslations("studentPortal");

  const promedioPeriodo = promedio(periodo.notas.map((nota) => nota.nota));
  const indicePeriodo = promedio(periodo.notas.map((nota) => nota.gpa));

  const colorNota = (nota: number) =>
    aprobada(nota) ? "text-marca-600" : "text-tinta";

  return (
    <Seccion
      titulo={periodo.nombre}
      accion={
        <div className="flex items-center gap-2">
          <Badge variant="marca">
            {t("stats.average")} {promedioPeriodo?.toFixed(1) ?? "—"}
          </Badge>
          <Badge variant="marca">
            {t("gradesPage.gpaShort")} {indicePeriodo?.toFixed(2) ?? "—"}
          </Badge>
        </div>
      }
    >
      {/* Anchos fijos: cada período es una tabla aparte, y sin ellos las
          columnas de un período no se alinean con las del siguiente. */}
      <table className="hidden w-full table-fixed text-sm md:table">
        <colgroup>
          <col className="w-[44%]" />
          <col className="w-[22%]" />
          <col className="w-[12%]" />
          <col className="w-[11%]" />
          <col className="w-[11%]" />
        </colgroup>
        <thead>
          <tr className="border-b border-linea text-left">
            <th className="texto-meta py-2 pr-4 font-medium">
              {t("table.subject")}
            </th>
            <th className="texto-meta py-2 pr-4 font-medium">
              {t("gradesPage.typeColumn")}
            </th>
            <th className="texto-meta py-2 pr-4 font-medium">
              {t("table.letter")}
            </th>
            <th className="texto-meta py-2 pr-4 text-right font-medium">
              {t("table.grade")}
            </th>
            <th className="texto-meta py-2 text-right font-medium">
              {t("table.gpa")}
            </th>
          </tr>
        </thead>
        <tbody>
          {periodo.notas.map((nota) => (
            <tr
              key={nota.id}
              className="h-14 border-b border-linea transition-colors last:border-b-0 hover:bg-muted/50"
            >
              <td className="truncate pr-4 font-medium text-tinta">
                {nota.curso}
              </td>
              <td className="pr-4 text-tinta-2">
                {t(`gradesPage.type.${nota.tipo_evaluacion}`)}
              </td>
              <td className="pr-4">
                <LetraNota letra={nota.letra} pequena />
              </td>
              <td
                className={cn(
                  "pr-4 text-right font-semibold tabular-nums",
                  colorNota(nota.nota),
                )}
              >
                {nota.nota.toFixed(1)}
              </td>
              <td className="text-right tabular-nums text-tinta-2">
                {nota.gpa.toFixed(1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="space-y-3 md:hidden">
        {periodo.notas.map((nota) => (
          <li
            key={nota.id}
            className="flex items-center gap-3 rounded-card border border-linea bg-card p-4 shadow-card"
          >
            <LetraNota letra={nota.letra} />

            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 font-semibold">{nota.curso}</p>
              <p className="text-sm text-tinta-2">
                {t(`gradesPage.type.${nota.tipo_evaluacion}`)}
              </p>
            </div>

            <div className="shrink-0 text-right">
              <p
                className={cn(
                  "text-lg font-semibold tabular-nums",
                  colorNota(nota.nota),
                )}
              >
                {nota.nota.toFixed(1)}
              </p>
              <p className="texto-meta">
                {t("gradesPage.gpaShort")} {nota.gpa.toFixed(1)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Seccion>
  );
}
