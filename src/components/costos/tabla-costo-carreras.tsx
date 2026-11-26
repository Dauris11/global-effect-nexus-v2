"use client";

import { Table2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { EstadoVacio } from "@/components/ui/estado-vacio";
import { GraficoBarras } from "@/components/ui/grafico";
import { formatearMonto } from "@/lib/contabilidad/formato";
import type { FilaCostoCarrera } from "@/server/costos/consultas";

const dop = (n: number | null) => (n === null ? "—" : formatearMonto(n, "DOP"));

/**
 * Promedio por becado de cada carrera, en barras y en tabla (tarjetas en el
 * móvil). Los promedios solo cuentan a los becados con costo registrado: hasta
 * que el imputado se generalice, un cero por falta de dato no es un costo cero.
 */
export function TablaCostoCarreras({ filas }: { filas: FilaCostoCarrera[] }) {
  const t = useTranslations("costs");

  if (filas.length === 0) return <EstadoVacio icono={Table2} titulo={t("empty")} />;

  const barras = filas
    .filter((f) => f.promedio_por_becado !== null)
    .map((f) => ({ nombre: `${f.carrera} (${f.universidad})`, promedio: f.promedio_por_becado ?? 0 }));

  return (
    <>
      <section className="space-y-3">
        <h2 className="texto-titulo-seccion">{t("chart.title")}</h2>
        <div className="rounded-card border border-linea bg-card p-5">
          <GraficoBarras
            datos={barras}
            claveX="nombre"
            nombreEjeX={t("table.career")}
            series={[{ clave: "promedio", nombre: t("table.averageStudent") }]}
            etiqueta={t("chart.label")}
            vacio={t("chart.empty")}
            orientacion="filas"
            formato={(n) => formatearMonto(n, "DOP")}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="texto-titulo-seccion">{t("table.title")}</h2>
        <div className="hidden overflow-x-auto rounded-card border border-linea bg-card p-5 md:block">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="text-tinta-3 border-b border-linea text-left text-xs">
                <th className="py-2 font-medium">{t("table.university")}</th>
                <th className="py-2 font-medium">{t("table.career")}</th>
                <th className="py-2 text-right font-medium">{t("table.students")}</th>
                <th className="py-2 text-right font-medium">{t("table.total")}</th>
                <th className="py-2 text-right font-medium">{t("table.averageStudent")}</th>
                <th className="py-2 text-right font-medium">{t("table.averageTerm")}</th>
                <th className="py-2 text-right font-medium">{t("table.averageGraduate")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-linea">
              {filas.map((f) => (
                <tr key={`${f.universidad}-${f.carrera}`}>
                  <td className="py-2">{f.universidad}</td>
                  <td className="py-2">{f.carrera}</td>
                  <td className="py-2 text-right tabular-nums">{t("table.studentsOf", { con: f.con_costo, total: f.becados })}</td>
                  <td className="py-2 text-right tabular-nums">{dop(f.total_invertido)}</td>
                  <td className="py-2 text-right font-medium tabular-nums">{dop(f.promedio_por_becado)}</td>
                  <td className="py-2 text-right tabular-nums">{dop(f.promedio_por_cuatrimestre)}</td>
                  <td className="py-2 text-right tabular-nums">{dop(f.promedio_por_graduado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul className="space-y-3 md:hidden">
          {filas.map((f) => (
            <li key={`${f.universidad}-${f.carrera}`} className="space-y-1 rounded-card border border-linea bg-card p-4">
              <p className="font-semibold">{f.carrera}</p>
              <p className="texto-meta">
                {f.universidad} · {t("table.studentsOf", { con: f.con_costo, total: f.becados })}
              </p>
              <p className="text-sm">{t("table.averageStudent")}: <span className="font-semibold tabular-nums">{dop(f.promedio_por_becado)}</span></p>
              <p className="text-sm">{t("table.averageTerm")}: <span className="tabular-nums">{dop(f.promedio_por_cuatrimestre)}</span></p>
              <p className="text-sm">{t("table.averageGraduate")}: <span className="tabular-nums">{dop(f.promedio_por_graduado)}</span></p>
              <p className="text-sm">{t("table.total")}: <span className="tabular-nums">{dop(f.total_invertido)}</span></p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
