import type { Metadata } from "next";
import { CalendarRange, Layers, Star } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Cabecera } from "@/components/estudiante/cabecera";
import { DistribucionLetras } from "@/components/estudiante/distribucion-letras";
import { agruparPorPeriodo } from "@/components/estudiante/periodos";
import { Seccion } from "@/components/estudiante/seccion";
import { TablaNotas } from "@/components/estudiante/tabla-notas";
import { Badge } from "@/components/ui/badge";
import { ChipFiltro } from "@/components/ui/chip-filtro";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { FilaChips } from "@/components/ui/fila-chips";
import { StatCard } from "@/components/ui/stat-card";
import { requerirRol } from "@/lib/auth";
import { aprobada, promedio } from "@/lib/notas";
import {
  estudianteDeUsuario,
  notas360DelEstudiante,
  notasDelEstudiante,
} from "@/server/estudiantes/portal";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "studentPortal" });

  return { title: t("gradesPage.title") };
}

/**
 * Calificaciones del estudiante, con el detalle que no cabe en el inicio:
 * distribución por letra y filtro por período.
 *
 * El filtro va por URL (`?periodo=<id>`) y no en estado de cliente, para que la
 * pantalla siga siendo un componente de servidor y el enlace se pueda compartir
 * o recargar sin perder lo que se estaba viendo. Por eso los chips son enlaces.
 *
 * Las cifras de arriba son SIEMPRE del historial completo, aunque haya filtro
 * puesto: el índice académico es acumulado y decide la beca, así que verlo
 * cambiar al pulsar un período daría la impresión de que la Fundación lo calcula
 * por cuatrimestre.
 *
 * La carrera y Global Effect 360 son programas distintos: van en bloques
 * separados y las cifras de arriba son solo de la carrera. La letra y el índice
 * de cada fila llegan ya resueltos: los del historial universitario vienen
 * guardados y no se recalculan.
 */
export default async function PaginaCalificaciones({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ periodo?: string }>;
}) {
  const { locale } = await params;
  const { periodo: periodoElegido } = await searchParams;

  const usuario = await requerirRol(["estudiante"]);
  const estudiante = await estudianteDeUsuario(usuario.id);

  const t = await getTranslations({ locale, namespace: "studentPortal" });

  const [notas, notas360] = await Promise.all([
    notasDelEstudiante(estudiante.id),
    notas360DelEstudiante(estudiante.id),
  ]);

  // Global Effect 360 es otro programa: su promedio es propio y nunca entra en
  // el índice ni en las cifras de la carrera.
  const promedio360 = promedio(notas360.map((nota) => nota.nota));
  const periodos360 = agruparPorPeriodo(notas360);

  const todas = notas.map((nota) => nota.nota);
  const promedioGeneral = promedio(todas);
  // El índice es el promedio de los índices de cada fila, no una conversión del
  // promedio: en el historial universitario cada fila trae el suyo ya escrito.
  const indice = promedio(notas.map((nota) => nota.gpa));
  const aprobadas = todas.filter(aprobada).length;

  const periodos = agruparPorPeriodo(notas);

  // Un id de período que no exista se ignora en vez de dar error: llega de la
  // URL y puede quedar obsoleto en un enlace guardado.
  const hayFiltro = periodos.some((periodo) => periodo.id === periodoElegido);
  const visibles = hayFiltro
    ? periodos.filter((periodo) => periodo.id === periodoElegido)
    : periodos;

  const notasVisibles = visibles.flatMap((periodo) => periodo.notas);

  return (
    <div className="animate-entrada mx-auto max-w-5xl space-y-8 md:space-y-10">
      <Cabecera
        titulo={t("gradesPage.title")}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <StatCard
          variant="centrada"
          valor={promedioGeneral === null ? "—" : promedioGeneral.toFixed(1)}
          etiqueta={t("stats.average")}
        />
        <StatCard
          variant="centrada"
          valor={indice === null ? "—" : indice.toFixed(2)}
          etiqueta={`${t("gradesPage.gpaShort")} ${t("gpaScale")}`}
        />
        <StatCard
          variant="centrada"
          valor={String(notas.length)}
          etiqueta={t("gradesPage.stats.evaluations")}
        />
        <StatCard
          variant="centrada"
          valor={String(aprobadas)}
          etiqueta={t("stats.passed")}
        />
      </div>

      {notas.length === 0 && notas360.length === 0 ? (
        <EstadoVacio
          icono={Star}
          titulo={t("gradesEmpty")}
        />
      ) : (
        <>
          {periodos.length > 1 && (
            <FilaChips etiqueta={t("gradesPage.title")}>
              <ChipFiltro
                icono={Layers}
                etiqueta={t("gradesPage.allTerms")}
                activo={!hayFiltro}
                href="/portal/estudiante/calificaciones"
              />
              {periodos.map((periodo) => (
                <ChipFiltro
                  key={periodo.id}
                  icono={CalendarRange}
                  etiqueta={periodo.nombre}
                  activo={periodo.id === periodoElegido}
                  href={`/portal/estudiante/calificaciones?periodo=${encodeURIComponent(periodo.id)}`}
                />
              ))}
            </FilaChips>
          )}

          {notas.length > 0 && (
            <>
              <DistribucionLetras notas={notasVisibles} />

              {visibles.map((periodo) => (
                <TablaNotas key={periodo.id} periodo={periodo} />
              ))}
            </>
          )}

          {notas360.length > 0 && (
            <Seccion
              titulo={t("gradesPage.origin.g360")}
              accion={
                <Badge variant="marca">
                  {t("gradesPage.average360")} {promedio360?.toFixed(1) ?? "—"}
                </Badge>
              }
            >
              {periodos360.map((periodo) => (
                <TablaNotas key={periodo.id} periodo={periodo} conIndice={false} />
              ))}
            </Seccion>
          )}
        </>
      )}
    </div>
  );
}
