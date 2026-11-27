import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { GestionClases360 } from "@/components/academico/gestion-clases-360";
import { GestionMaterias } from "@/components/academico/gestion-materias";
import { GestionPeriodos } from "@/components/academico/gestion-periodos";
import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirPermiso } from "@/lib/auth";
import { docentesAsignables, materiasGestionadas, periodosGestionados, periodosSimples } from "@/server/academico/consultas";
import { asistenciaDeClases360 } from "@/server/profesor/asistencia";
import { asignacionesDeClases360, clases360, entregasDeClases360, entregasPorRevisar, inscritosDeClase360, periodosParaTareas360 } from "@/server/profesor/consultas";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "reports" });

  return { title: t("title") };
}

/**
 * Reportes académicos: las cifras y gráficas que salieron de Períodos, Materias y Clases de 360 (esas pantallas
 * son de trabajo y arrancan en su lista). Cada componente se pinta en su modo `reporte`.
 */
export default async function ReportesAcademico({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requerirPermiso("academico.leer");

  const [t, periodos, materias, periodosLista, docentes, clases, entregasBrutas, todasBrutas, asistencia, periodosDeTarea, asignaciones, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "reports" }),
    periodosGestionados(),
    materiasGestionadas({ periodoId: null, busqueda: "" }),
    periodosSimples(),
    docentesAsignables(),
    clases360(null),
    entregasPorRevisar(null, 20),
    entregasDeClases360(null),
    asistenciaDeClases360(null),
    periodosParaTareas360(null),
    asignacionesDeClases360(null),
    mensajesCliente(["academic"]),
  ]);
  const porClase = await Promise.all(clases.map(async (c) => [c.id, await inscritosDeClase360(c.id)] as const));
  // Para contar entregas no hacen falta los enlaces firmados.
  const sinEnlace = <T extends object>(filas: readonly T[]) => filas.map((e) => ({ ...e, enlace: null }));
  const entregasPorAsignacion: Record<string, ReturnType<typeof sinEnlace>> = {};
  for (const e of sinEnlace(todasBrutas)) (entregasPorAsignacion[(e as { asignacion_id: string }).asignacion_id] ??= []).push(e as never);

  return (
    <PageContainer className="space-y-8">
      <PageHeader title={t("title")} />
      <NextIntlClientProvider messages={mensajes}>
        <GestionPeriodos periodos={periodos} puedeEscribir={false} modo="reporte" />
        <GestionMaterias
          materias={materias}
          periodos={periodosLista}
          docentes={docentes}
          puedeEscribir={false}
          hayMas={false}
          hayFiltro={false}
          modo="reporte"
        />
        <GestionClases360
          clases={clases}
          inscritosPorClase={Object.fromEntries(porClase)}
          entregas={sinEnlace(entregasBrutas.filter((e) => e.materia_360_id != null)) as never}
          asistencia={asistencia}
          periodosDeTarea={periodosDeTarea}
          asignacionesPorClase={asignaciones}
          entregasPorAsignacion={entregasPorAsignacion as never}
          puedeProgramar={false}
          puedeCalificar={false}
          modo="reporte"
        />
      </NextIntlClientProvider>
    </PageContainer>
  );
}
