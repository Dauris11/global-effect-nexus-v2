import { AlertCircle, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import type { DatosBandeja } from "@/server/bandeja/consultas";

/**
 * Lo que espera una decisión, arriba de todo: es lo único con alguien al otro
 * lado y cada aviso enlaza a donde se resuelve. Los avisos en cero no se
 * dibujan, porque la lista es de trabajo pendiente y un "0 vencidas" escondería
 * al que sí tiene número. Si no queda ninguno se dice como buena noticia.
 */
export function PendientesBandeja({
  pendientes,
}: {
  pendientes: NonNullable<DatosBandeja["pendientes"]>;
}) {
  const t = useTranslations("bandeja.attention");

  const avisos = [
    { clave: "urgentTasks", cuantos: pendientes.tareas_urgentes, href: "/administrativo/tareas" },
    { clave: "overdueTasks", cuantos: pendientes.tareas_vencidas, href: "/administrativo/tareas" },
    { clave: "submissions", cuantos: pendientes.entregas_por_revisar, href: "/academico/clases-360" },
    { clave: "unsponsored", cuantos: pendientes.becados_sin_patrocinador, href: "/patrocinadores/becas" },
    { clave: "terms", cuantos: pendientes.periodos_incoherentes, href: "/academico/periodos" },
    { clave: "requests", cuantos: pendientes.solicitudes, href: "/administrativo/solicitudes" },
    { clave: "subjectsNoTerm", cuantos: pendientes.materias_sin_periodo, href: "/academico/materias" },
  ] as const;
  const activos = avisos.filter((aviso) => aviso.cuantos > 0);
  const total = activos.reduce((suma, aviso) => suma + aviso.cuantos, 0);

  return (
    <Card className="p-5 md:p-6">
      <CardTitle className="mb-1">
        <AlertCircle className="size-4" />
        {t("title")}
        {total > 0 && <Badge className="ml-1 bg-tinta text-background">{total}</Badge>}
      </CardTitle>

      {activos.length === 0 ? (
        <p className="py-4 text-center text-sm font-semibold text-tinta-2">{t("none")}</p>
      ) : (
        <ul className="divide-y divide-linea">
          {activos.map((aviso) => (
            <li key={aviso.clave}>
              <Link
                href={aviso.href}
                className="group -mx-2 flex min-h-11 items-center gap-3 rounded-control px-2 py-2 transition-colors hover:bg-muted/50"
              >
                {/* El número en tinta y a la izquierda: es lo que se escanea. */}
                <span className="flex size-8 shrink-0 items-center justify-center rounded-control bg-tinta text-sm font-semibold text-background">
                  {aviso.cuantos}
                </span>
                <span className="min-w-0 flex-1 text-sm">{t(aviso.clave)}</span>
                <ChevronRight className="size-4 shrink-0 text-tinta-3 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
