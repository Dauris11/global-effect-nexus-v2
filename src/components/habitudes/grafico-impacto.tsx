"use client";

import { useTranslations } from "next-intl";

import { GraficoBarras } from "@/components/ui/grafico";
import type { ImpactoMensual } from "@/lib/habitudes";

/** Visitas y estudiantes alcanzados por mes: los gráficos viven solo en Reportes. */
export function GraficoImpacto({ meses }: { meses: readonly ImpactoMensual[] }) {
  const t = useTranslations("habitudes.reports");

  return (
    <GraficoBarras
      datos={meses.map((m) => ({ mes: m.mes, visitas: m.visitas, estudiantes: m.estudiantes }))}
      claveX="mes"
      series={[
        { clave: "visitas", nombre: t("visits") },
        { clave: "estudiantes", nombre: t("students") },
      ]}
      etiqueta={t("chartLabel")}
      vacio={t("empty")}
    />
  );
}
