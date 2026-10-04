import { getTranslations } from "next-intl/server";

import { LetraNota } from "@/components/estudiante/letra-nota";
import { Seccion } from "@/components/estudiante/seccion";
import { Progress } from "@/components/ui/progress";
import type { Letra } from "@/lib/notas";
import type { NotaDelEstudiante } from "@/server/estudiantes/portal";

/** Las cinco letras en orden, para que la distribución no dependa de los datos. */
const LETRAS: readonly Letra[] = ["A", "B", "C", "D", "F"];

/**
 * Cuántas notas hay de cada letra, sobre las notas visibles: acompaña al
 * filtro de período, y es lo único de la pantalla de calificaciones que se
 * recalcula con él.
 */
export async function DistribucionLetras({
  notas,
}: {
  notas: readonly NotaDelEstudiante[];
}) {
  const t = await getTranslations("studentPortal");

  return (
    <Seccion titulo={t("gradesPage.distribution")}>
      <ul className="space-y-3">
        {LETRAS.map((letra) => {
          const cuenta = notas.filter((nota) => nota.letra === letra).length;
          const porcentaje =
            notas.length === 0 ? 0 : (cuenta / notas.length) * 100;

          return (
            <li key={letra} className="flex items-center gap-3">
              <LetraNota letra={letra} pequena />
              <Progress
                value={porcentaje}
                className="flex-1"
                aria-label={`${letra}: ${t("gradesPage.count", { count: cuenta })}`}
              />
              <span className="texto-meta w-20 shrink-0 text-right tabular-nums">
                {t("gradesPage.count", { count: cuenta })}
              </span>
            </li>
          );
        })}
      </ul>
    </Seccion>
  );
}
