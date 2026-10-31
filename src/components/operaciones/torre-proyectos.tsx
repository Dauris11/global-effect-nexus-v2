import { FolderKanban, Star } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Progress } from "@/components/ui/progress";
import { Link } from "@/i18n/navigation";
import { clasesDeEstado } from "@/lib/paleta";
import type { ProyectoTorre } from "@/lib/torre-control";

/**
 * Proyectos de la persona con su avance contado (tareas hechas sobre vivas),
 * no el `proyecto.progreso` escrito a mano: ver `proyectosConAvance`.
 */
export async function TorreProyectos({ proyectos }: { proyectos: ProyectoTorre[] }) {
  const t = await getTranslations("torre");
  const ta = await getTranslations("admin");

  return (
    <section className="space-y-3">
      <h2 className="texto-titulo-seccion">{t("projects")}</h2>
      {proyectos.length === 0 ? (
        <EstadoVacio icono={FolderKanban} titulo={t("projectsEmpty")} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {proyectos.map((p) => {
            const avance = p.tareas ? Math.round((p.hechas / p.tareas) * 100) : 0;
            return (
              <li key={p.id}>
                <Link href={`/administrativo/proyectos/${p.id}`} className="block rounded-card focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                  <Card className="h-full space-y-3 p-4 transition-shadow hover:shadow-elevada">
                    <div className="flex items-start justify-between gap-2">
                      <p className="texto-titulo-tarjeta">{p.nombre}</p>
                      <Badge className={clasesDeEstado(p.estado)}>
                        {ta(`projectStatus.${p.estado}` as never)}
                      </Badge>
                    </div>
                    <Progress value={avance} />
                    <div className="flex flex-wrap items-center justify-between gap-2 texto-meta">
                      <span>{t("tasksDone", { hechas: p.hechas, total: p.tareas })}</span>
                      <span>{t("myOpen", { n: p.mis_abiertas })}</span>
                    </div>
                    {p.responsable_nombre && (
                      <p className="flex items-center gap-1 texto-meta">
                        {p.es_responsable && <Star className="size-4 text-marca-500" />}
                        {t("lead")}: {p.responsable_nombre}
                      </p>
                    )}
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
