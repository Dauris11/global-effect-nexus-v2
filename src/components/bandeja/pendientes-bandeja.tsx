import {
  AlertCircle,
  BookOpen,
  CalendarX,
  ChevronRight,
  Clock,
  FileCheck2,
  Flame,
  Inbox,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import type { DatosBandeja } from "@/server/bandeja/consultas";

/**
 * Tarjetas KPI interactivas de lo que espera una decisión arriba de todo.
 * Cada tarjeta muestra el conteo destacado, su proporción respecto al total de
 * avisos activos y enlaza directo al módulo donde se resuelve.
 */
export function PendientesBandeja({
  pendientes,
}: {
  pendientes: NonNullable<DatosBandeja["pendientes"]>;
}) {
  const t = useTranslations("bandeja.attention");

  const avisos = [
    {
      clave: "urgentTasks",
      cuantos: pendientes.tareas_urgentes,
      href: "/administrativo/tareas",
      icono: Flame,
    },
    {
      clave: "overdueTasks",
      cuantos: pendientes.tareas_vencidas,
      href: "/administrativo/tareas",
      icono: Clock,
    },
    {
      clave: "submissions",
      cuantos: pendientes.entregas_por_revisar,
      href: "/academico/clases-360",
      icono: FileCheck2,
    },
    {
      clave: "unsponsored",
      cuantos: pendientes.becados_sin_patrocinador,
      href: "/patrocinadores/becas",
      icono: Users,
    },
    {
      clave: "terms",
      cuantos: pendientes.periodos_incoherentes,
      href: "/academico/periodos",
      icono: CalendarX,
    },
    {
      clave: "requests",
      cuantos: pendientes.solicitudes,
      href: "/administrativo/solicitudes",
      icono: Inbox,
    },
    {
      clave: "subjectsNoTerm",
      cuantos: pendientes.materias_sin_periodo,
      href: "/academico/materias",
      icono: BookOpen,
    },
  ] as const;

  const activos = avisos.filter((aviso) => aviso.cuantos > 0);
  const total = activos.reduce((suma, aviso) => suma + aviso.cuantos, 0);

  return (
    <Card className="p-5 md:p-6">
      <CardTitle className="mb-4">
        <AlertCircle className="size-4 text-marca-500" />
        {t("title")}
        {total > 0 && <Badge className="ml-1 bg-tinta text-background">{total}</Badge>}
      </CardTitle>

      {activos.length === 0 ? (
        <p className="py-4 text-center text-sm font-semibold text-tinta-2">{t("none")}</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {activos.map((aviso) => {
            const Icono = aviso.icono;
            const porcentaje = total > 0 ? Math.max(8, Math.round((aviso.cuantos / total) * 100)) : 0;

            return (
              <Link
                key={aviso.clave}
                href={aviso.href}
                className="group flex flex-col justify-between gap-3 rounded-card border border-linea bg-muted/20 p-4 transition-all hover:-translate-y-0.5 hover:border-marca-500/50 hover:bg-muted/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-2xl font-bold text-tinta tabular-nums">
                    {aviso.cuantos}
                  </span>
                  <span className="flex size-8 items-center justify-center rounded-lg bg-marca-50 text-marca-600 transition-colors group-hover:bg-marca-500 group-hover:text-white">
                    <Icono className="size-4" />
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-tinta-2 line-clamp-2">
                      {t(aviso.clave)}
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-tinta-3 transition-transform group-hover:translate-x-0.5 group-hover:text-marca-500" />
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-marca-500 transition-all"
                      style={{ width: `${porcentaje}%` }}
                    />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </Card>
  );
}
