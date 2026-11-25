"use client";

import { useMemo, useState } from "react";
import { CalendarRange, HandCoins, Layers, Receipt, Scale, Wallet } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Seccion } from "@/components/expedientes/detalle/ficha";
import { PanelRegistroCostos } from "@/components/costos/panel-registro-costos";
import { Badge } from "@/components/ui/badge";
import { ChipFiltro } from "@/components/ui/chip-filtro";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { FilaChips } from "@/components/ui/fila-chips";
import { GraficoAnillo, LeyendaGrafico } from "@/components/ui/grafico";
import { StatCard } from "@/components/ui/stat-card";
import { formatearMonto } from "@/lib/contabilidad/formato";
import { PILARES_COSTO } from "@/lib/costos";
import { fechaCorta } from "@/lib/fechas";
import type { DatosRegistroCostos, GastoEstudiante, PeriodoCosto, ResumenCostoEstudiante } from "@/server/costos/consultas";

const TOTAL_PILAR: Record<(typeof PILARES_COSTO)[number], keyof ResumenCostoEstudiante> = {
  universidad: "total_universidad",
  materiales: "total_materiales",
  transporte: "total_transporte",
  tramites: "total_rendiciones",
};

const dop = (n: number) => formatearMonto(n, "DOP");

/**
 * Pestaña «Costos» del expediente: cuánto ha invertido la Fundación en este
 * becado. Solo se monta si la página comprobó `expedientes.costos.leer`; las
 * cifras no viajan al navegador de nadie más, y el estudiante no las ve ni en
 * su portal ni en su vista del expediente (regla dura del plan).
 */
export function TabCostos({
  resumen,
  gastos,
  periodos,
  registro,
}: {
  resumen: ResumenCostoEstudiante;
  gastos: GastoEstudiante[];
  periodos: PeriodoCosto[];
  /** Solo para quien puede escribir (`contabilidad.registrar` y `expedientes.costos.leer`): materiales y transporte a mano. */
  registro?: DatosRegistroCostos | null;
}) {
  const t = useTranslations("records.costs");
  const idioma = useLocale() === "en" ? "en" : "es";
  const [periodoId, setPeriodoId] = useState<string>("todos");

  const periodo = periodos.find((p) => p.id === periodoId);
  const visibles = useMemo(
    () => (periodo ? gastos.filter((g) => g.fecha >= periodo.desde && g.fecha <= periodo.hasta) : gastos),
    [gastos, periodo],
  );
  const totalVisible = visibles.reduce((suma, g) => suma + g.monto, 0);

  const porciones = PILARES_COSTO.map((p) => ({
    nombre: t(`pillar.${p}`),
    valor: Number(resumen[TOTAL_PILAR[p]]),
  }));
  const hayAportes = resumen.aportes_patrocinador > 0;
  const balance = resumen.aportes_patrocinador - resumen.costo_total_acumulado;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icono={Wallet} acento etiqueta={t("kpi.total")} valor={dop(resumen.costo_total_acumulado)} />
        <StatCard
          icono={CalendarRange}
          etiqueta={t("kpi.average", { n: resumen.cuatrimestres_cursados })}
          valor={dop(resumen.costo_total_acumulado / resumen.cuatrimestres_cursados)}
        />
        <StatCard icono={HandCoins} etiqueta={t("kpi.sponsor")} valor={hayAportes ? dop(resumen.aportes_patrocinador) : "—"} />
        <StatCard
          icono={Scale}
          etiqueta={t("kpi.balance")}
          valor={hayAportes ? `${balance >= 0 ? "+" : ""}${dop(balance)}` : "—"}
        />
      </div>
      <p className="texto-meta">{t("hint")}</p>

      <Seccion titulo={t("chart.title")}>
        <div className="grid items-center gap-6 md:grid-cols-[minmax(0,260px)_1fr]">
          <GraficoAnillo
            datos={porciones}
            etiqueta={t("chart.label")}
            vacio={t("chart.empty")}
            centro={{ valor: dop(resumen.costo_total_acumulado), etiqueta: t("chart.center") }}
            altura={220}
          />
          <LeyendaGrafico
            enLista
            items={porciones.map((p) => ({
              nombre: p.nombre,
              valor: `${dop(p.valor)} · ${
                resumen.costo_total_acumulado > 0 ? Math.round((p.valor / resumen.costo_total_acumulado) * 100) : 0
              }%`,
            }))}
          />
        </div>
      </Seccion>

      <Seccion titulo={t("table.title")}>
        {periodos.length > 0 && (
          <FilaChips etiqueta={t("table.filter")} className="mb-4">
            <ChipFiltro icono={Layers} etiqueta={t("table.all")} activo={periodoId === "todos"} onClick={() => setPeriodoId("todos")} />
            {periodos.map((p) => (
              <ChipFiltro key={p.id} icono={CalendarRange} etiqueta={p.nombre} activo={periodoId === p.id} onClick={() => setPeriodoId(p.id)} />
            ))}
          </FilaChips>
        )}

        {visibles.length === 0 ? (
          <EstadoVacio icono={Receipt} titulo={t("table.empty")} texto={t("table.emptyHint")} />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-tinta-3 border-b border-linea text-left text-xs">
                    <th className="py-2 font-medium">{t("table.date")}</th>
                    <th className="py-2 font-medium">{t("table.pillar")}</th>
                    <th className="py-2 font-medium">{t("table.concept")}</th>
                    <th className="py-2 font-medium">{t("table.origin")}</th>
                    <th className="py-2 font-medium">{t("table.reference")}</th>
                    <th className="py-2 text-right font-medium">{t("table.amount")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-linea">
                  {visibles.map((g, i) => (
                    <tr key={`${g.fuente}-${i}`}>
                      <td className="py-2 whitespace-nowrap">{fechaCorta(g.fecha, idioma)}</td>
                      <td className="py-2"><Badge variant="neutra">{t(`pillar.${g.pilar}`)}</Badge></td>
                      <td className="py-2">{g.concepto}</td>
                      <td className="text-tinta-2 py-2">{g.origen ?? "—"}</td>
                      <td className="text-tinta-2 py-2 font-mono text-xs">{g.referencia ?? "—"}</td>
                      <td className="py-2 text-right font-medium tabular-nums">{dop(g.monto)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-linea-fuerte">
                    <td colSpan={5} className="py-2 font-semibold">{t("table.total")}</td>
                    <td className="py-2 text-right font-semibold tabular-nums">{dop(totalVisible)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <ul className="divide-y divide-linea md:hidden">
              {visibles.map((g, i) => (
                <li key={`${g.fuente}-${i}`} className="space-y-1 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 break-words font-medium">{g.concepto}</p>
                    <p className="shrink-0 font-semibold tabular-nums">{dop(g.monto)}</p>
                  </div>
                  <div className="texto-meta flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Badge variant="neutra">{t(`pillar.${g.pilar}`)}</Badge>
                    <span>{fechaCorta(g.fecha, idioma)}</span>
                    {g.origen && <span>{g.origen}</span>}
                    {g.referencia && <span className="font-mono">{g.referencia}</span>}
                  </div>
                </li>
              ))}
              <li className="flex justify-between py-3 font-semibold">
                <span>{t("table.total")}</span>
                <span className="tabular-nums">{dop(totalVisible)}</span>
              </li>
            </ul>
          </>
        )}
      </Seccion>

      {registro && <PanelRegistroCostos datos={registro} />}
    </>
  );
}
