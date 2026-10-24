import { getTranslations } from "next-intl/server";

import { Monto } from "@/components/contabilidad/comun";
import { TARJETA } from "@/lib/paleta";
import type { LineaAsiento } from "@/server/contabilidad/asientos/consultas";

/**
 * Las líneas de un asiento con sus totales. El cero de la columna que no
 * se usa no se pinta: en un diario, una celda vacía se lee más rápido que
 * una columna llena de "0.00".
 */
export async function LineasAsiento({
  lineas,
  totalDebe,
  totalHaber,
}: {
  lineas: LineaAsiento[];
  totalDebe: string;
  totalHaber: string;
}) {
  const t = await getTranslations("contab.asientos.detalle");
  const esCero = (valor: string) => /^0+(\.0+)?$/.test(valor);
  const cifra = (valor: string) => (esCero(valor) ? null : <Monto valor={valor} moneda="DOP" />);

  return (
    <>
      <div className="hidden overflow-x-auto rounded-card border border-linea bg-card shadow-card md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-linea text-tinta-3">
            <tr>
              <th className="px-4 py-3 font-medium">{t("col.cuenta")}</th>
              <th className="px-4 py-3 font-medium">{t("col.descripcion")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("col.debe")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("col.haber")}</th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((l) => (
              <tr key={l.id} className="border-b border-linea">
                <td className="px-4 py-3">
                  <span className="tabular-nums text-tinta-2">{l.codigo}</span>{" "}
                  <span className="text-tinta">{l.cuenta}</span>
                </td>
                <td className="px-4 py-3 text-tinta-2">{l.descripcion ?? ""}</td>
                <td className="px-4 py-3 text-right">{cifra(l.debe)}</td>
                <td className="px-4 py-3 text-right">{cifra(l.haber)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold text-tinta">
              <td className="px-4 py-3" colSpan={2}>
                {t("totales")}
              </td>
              <td className="px-4 py-3 text-right">
                <Monto valor={totalDebe} moneda="DOP" />
              </td>
              <td className="px-4 py-3 text-right">
                <Monto valor={totalHaber} moneda="DOP" />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        <ul className={TARJETA.contenido}>
          {lineas.map((l) => (
            <li key={l.id} className="border-b border-linea px-4 py-3 last:border-b-0">
              <p className="text-[15px] text-tinta">
                <span className="tabular-nums text-tinta-2">{l.codigo}</span> {l.cuenta}
              </p>
              {l.descripcion && <p className="texto-meta">{l.descripcion}</p>}
              <p className="mt-1 text-sm">
                {!esCero(l.debe) ? (
                  <>
                    <span className="text-tinta-3">{t("col.debe")} </span>
                    <Monto valor={l.debe} moneda="DOP" className="font-medium" />
                  </>
                ) : (
                  <>
                    <span className="text-tinta-3">{t("col.haber")} </span>
                    <Monto valor={l.haber} moneda="DOP" className="font-medium" />
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="texto-meta">{t("col.debe")}</dt>
            <dd className="font-semibold text-tinta">
              <Monto valor={totalDebe} moneda="DOP" />
            </dd>
          </div>
          <div>
            <dt className="texto-meta">{t("col.haber")}</dt>
            <dd className="font-semibold text-tinta">
              <Monto valor={totalHaber} moneda="DOP" />
            </dd>
          </div>
        </dl>
      </div>
    </>
  );
}
