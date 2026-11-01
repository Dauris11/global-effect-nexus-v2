import { Crown, FolderKanban } from "lucide-react";
import { useTranslations } from "next-intl";

import { TarjetaBandeja } from "@/components/bandeja/tarjeta-bandeja";
import { Dato, FilaDatos } from "@/components/ui/dato";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Progress } from "@/components/ui/progress";
import { Link } from "@/i18n/navigation";
import type { ProyectoTorre } from "@/lib/torre-control";

/** Porcentaje de tareas hechas; un proyecto sin tareas marca 0, no NaN. */
export function avanceDeProyecto(proyecto: Pick<ProyectoTorre, "hechas" | "tareas">): number {
  return proyecto.tareas === 0 ? 0 : Math.round((proyecto.hechas / proyecto.tareas) * 100);
}

/**
 * Los proyectos de la persona con su avance (tareas hechas sobre el total).
 * Los completados se omiten: la bandeja es lo que sigue en marcha.
 */
export function ProyectosBandeja({ proyectos }: { proyectos: readonly ProyectoTorre[] }) {
  const t = useTranslations("bandeja");

  const enMarcha = proyectos.filter((p) => p.estado !== "completado" && p.estado !== "cancelado");

  return (
    <TarjetaBandeja
      icono={FolderKanban}
      titulo={t("projects.title")}
      verTodo={{ href: "/administrativo/proyectos", etiqueta: t("seeAll") }}
    >
      {enMarcha.length === 0 ? (
        <EstadoVacio icono={FolderKanban} titulo={t("projects.empty")} />
      ) : (
        <ul>
          {enMarcha.slice(0, 6).map((proyecto) => (
            <li key={proyecto.id} className="-mx-2 border-b border-linea px-2 py-3 last:border-b-0">
              <Link
                href={`/administrativo/proyectos/${proyecto.id}`}
                className="block space-y-2 rounded-control focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate text-sm font-semibold text-tinta">{proyecto.nombre}</p>
                  <span className="shrink-0 text-sm font-semibold text-tinta tabular-nums">
                    {avanceDeProyecto(proyecto)}%
                  </span>
                </div>

                <Progress value={avanceDeProyecto(proyecto)} />

                <FilaDatos>
                  <Dato icono={FolderKanban}>
                    {t("projects.done", { hechas: proyecto.hechas, total: proyecto.tareas })}
                  </Dato>
                  {proyecto.es_responsable && <Dato icono={Crown}>{t("projects.lead")}</Dato>}
                </FilaDatos>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </TarjetaBandeja>
  );
}
