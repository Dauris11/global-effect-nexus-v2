import { CalendarCheck, Percent, UserCheck, UserX } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Card, CardContent } from "@/components/ui/card";
import { Dato, FilaDatos } from "@/components/ui/dato";
import type { AsistenciaDeMateria } from "@/server/profesor/asistencia";

/**
 * Asistencia del estudiante por materia, en el período que cursa. Solo cifras
 * con icono: el porcentaje cuenta las clases ya marcadas, no las futuras.
 */
export async function AsistenciaEstudiante360({
  filas,
  locale,
}: {
  filas: readonly AsistenciaDeMateria[];
  locale: string;
}) {
  const t = await getTranslations({ locale, namespace: "global360" });

  return (
    <section className="space-y-4 border-t border-linea pt-8">
      <h2 className="texto-titulo-seccion">{t("attendanceTitle")}</h2>

      <ul className="grid gap-4 md:grid-cols-2">
        {filas.map((f) => (
          <li key={`${f.materia_id}-${f.periodo}`}>
            <Card>
              <CardContent className="space-y-2 pt-5">
                <p className="texto-titulo-tarjeta truncate">{f.materia}</p>
                <FilaDatos>
                  <Dato icono={CalendarCheck}>
                    {t("attendanceHeld", { marcadas: f.marcadas, total: f.sesiones })}
                  </Dato>
                  <Dato icono={UserCheck}>{t("attendancePresent", { n: f.presentes })}</Dato>
                  <Dato icono={UserX}>{t("attendanceAbsent", { n: f.ausentes })}</Dato>
                  {f.porcentaje !== null && (
                    <Dato icono={Percent}>{t("attendancePercent", { n: f.porcentaje })}</Dato>
                  )}
                </FilaDatos>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
