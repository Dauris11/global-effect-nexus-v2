import { Building2, CircleCheck, Clock, GraduationCap } from "lucide-react";
import { useTranslations } from "next-intl";

import { AccionesMateria } from "@/components/global360/acciones-materia";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Materia360Matricula } from "@/lib/moodle";
import { cn } from "@/lib/utils";
import type {
  TandaDelEstudiante,
  Ventana,
} from "@/server/global360/consultas";

/**
 * El catálogo de Global Effect 360 para elegir la materia de la tanda abierta:
 * horario, aula, docente y cupo de cada una.
 *
 * Componente de servidor: el estado de verdad lo trae la página después de
 * cada acción (`revalidatePath`), y un estado optimista en el navegador solo
 * podía contradecir a la base. Lo único cliente es el botón.
 *
 * Qué botón sale lo decide la tanda abierta, no la materia:
 *
 *   · tanda libre        → "Elegir" en las materias que puede tomar
 *   · tanda ya ocupada   → solo "Quitar" en la que eligió para ella
 *   · sin ventana abierta→ ninguno; la lista queda de consulta
 *
 * Una materia aprobada o ya elegida para la otra tanda no se ofrece: el
 * servidor la rechazaría igual, y ofrecerla sería sembrar una duda.
 */
export function MatriculaCuatrimestral360({
  materias,
  ventana,
  tandas,
}: {
  materias: readonly Materia360Matricula[];
  ventana: Ventana | null;
  tandas: readonly TandaDelEstudiante[];
}) {
  const t = useTranslations("global360");

  const tandaAbierta = ventana?.abierta ? ventana.ronda : null;
  const ocupada = tandas.find((tanda) => tanda.ronda === tandaAbierta) ?? null;

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h2 className="texto-titulo-seccion">
          {tandaAbierta
            ? t("chooseForTanda", { n: tandaAbierta })
            : t("catalogStudentTitle")}
        </h2>
      </div>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {materias.map((materia) => {
          const cupoLleno = materia.cupo_ocupado >= materia.cupo_maximo;
          const porcentaje = Math.min(
            100,
            Math.round((materia.cupo_ocupado / Math.max(1, materia.cupo_maximo)) * 100),
          );
          const enTanda = tandas.find((tanda) => tanda.materia_id === materia.id);

          let acciones: React.ReactNode = null;

          if (tandaAbierta !== null && !materia.aprobada) {
            if (ocupada?.materia_id === materia.id) {
              acciones =
                ocupada.estado === "prematriculada" ? (
                  <AccionesMateria materiaId={materia.id} elegida />
                ) : null;
            } else if (!ocupada && !enTanda) {
              acciones = (
                <AccionesMateria
                  materiaId={materia.id}
                  elegida={false}
                  sinCupo={cupoLleno}
                />
              );
            }
          }

          return (
            <li key={materia.id}>
              <Card
                className={cn(
                  "h-full justify-between gap-4 p-4",
                  enTanda && "border-marca-500",
                )}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      {materia.codigo && (
                        <p className="texto-meta font-medium">{materia.codigo}</p>
                      )}
                      <p className="texto-titulo-tarjeta">{materia.nombre}</p>
                    </div>

                    {materia.aprobada ? (
                      <Badge variant="solida">
                        <CircleCheck aria-hidden />
                        {t("situation.aprobada")}
                      </Badge>
                    ) : enTanda ? (
                      <Badge variant="marca">
                        {t(enTanda.ronda === 1 ? "tanda1" : "tanda2")}
                      </Badge>
                    ) : null}
                  </div>

                  <div className="space-y-1.5 text-sm text-tinta-2">
                    <Dato icono={Clock}>{materia.horario ?? t("scheduleTbd")}</Dato>
                    <Dato icono={Building2}>{materia.aula ?? t("roomTbd")}</Dato>
                    {materia.docente_nombre && (
                      <Dato icono={GraduationCap}>{materia.docente_nombre}</Dato>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="texto-meta flex justify-between">
                      <span>{t("capacity")}</span>
                      <span
                        className={cn(
                          "tabular-nums",
                          cupoLleno && "font-semibold text-tinta",
                        )}
                      >
                        {materia.cupo_ocupado} / {materia.cupo_maximo}
                      </span>
                    </div>
                    <Progress value={porcentaje} className="h-1.5" />
                  </div>
                </div>

                {acciones}
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Dato({
  icono: Icono,
  children,
}: {
  icono: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <span className="flex items-center gap-2">
      <Icono className="size-4 shrink-0 text-tinta-3" />
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}
