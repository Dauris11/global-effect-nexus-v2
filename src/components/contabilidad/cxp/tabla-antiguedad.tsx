import { useTranslations } from "next-intl";

import { Monto } from "@/components/contabilidad/comun";
import type { FilaAntiguedad, TramoAntiguedad } from "@/server/contabilidad/cxp/consultas";
import { TRAMOS_ANTIGUEDAD } from "@/server/contabilidad/cxp/consultas";

export function TablaAntiguedad({ datos }: { datos: FilaAntiguedad[] }) {
  const t = useTranslations("contab.cxp");

  if (datos.length === 0) return null;

  return (
    <div className="rounded-tarjeta border border-linea bg-background p-5 space-y-3">
      <h2 className="texto-titulo-seccion">{t("antiguedad")}</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-linea text-xs text-tinta-2 uppercase">
            <tr>
              <th className="pb-2">Moneda</th>
              {TRAMOS_ANTIGUEDAD.map((tramo) => (
                <th key={tramo} className="pb-2 text-right">
                  {t(`tramo.${tramo}` as never)}
                </th>
              ))}
              <th className="pb-2 text-right font-bold">{t("tramo.total")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-linea">
            {datos.map((fila) => (
              <tr key={fila.moneda}>
                <td className="py-2.5 font-bold text-tinta">{fila.moneda}</td>
                {TRAMOS_ANTIGUEDAD.map((tramo) => (
                  <td key={tramo} className="py-2.5 text-right tabular-nums">
                    <Monto
                      valor={fila[tramo as TramoAntiguedad]}
                      moneda={fila.moneda}
                      className={
                        tramo !== "por_vencer" && Number(fila[tramo as TramoAntiguedad]) > 0
                          ? "font-medium text-alerta"
                          : "text-tinta"
                      }
                    />
                  </td>
                ))}
                <td className="py-2.5 text-right font-bold tabular-nums">
                  <Monto
                    valor={fila.total}
                    moneda={fila.moneda}
                    className="text-marca-700"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
