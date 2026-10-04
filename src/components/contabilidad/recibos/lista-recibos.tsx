import { getTranslations } from "next-intl/server";

import { InsigniaEstadoRecibo, Monto } from "@/components/contabilidad/comun";
import { Link } from "@/i18n/navigation";
import { numeroDocumento, SERIE_RECIBO } from "@/lib/contabilidad/formato";
import { fechaCorta } from "@/lib/fechas";
import { TARJETA } from "@/lib/paleta";
import type { FilaRecibo } from "@/server/contabilidad/recibos/consultas";

/**
 * Recibos en tabla (≥ md) y en tarjetas (< md), con los mismos datos. El
 * monto lleva signo: + lo que entra, − lo que sale, para que una lista
 * mezclada se lea sin mirar la columna de tipo.
 */
export async function ListaRecibos({
  filas,
  idioma,
}: {
  filas: FilaRecibo[];
  idioma: "es" | "en";
}) {
  const t = await getTranslations("contab");
  const signo = (fila: FilaRecibo) => (fila.tipo === "egreso" ? `-${fila.monto}` : fila.monto);

  return (
    <>
      <div className="hidden overflow-x-auto rounded-card border border-linea bg-card shadow-card md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-linea text-tinta-3">
            <tr>
              <th className="px-4 py-3 font-medium">{t("recibos.col.numero")}</th>
              <th className="px-4 py-3 font-medium">{t("recibos.col.fecha")}</th>
              <th className="px-4 py-3 font-medium">{t("recibos.col.concepto")}</th>
              <th className="px-4 py-3 font-medium">{t("recibos.col.cuenta")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("recibos.col.monto")}</th>
              <th className="px-4 py-3 font-medium">{t("recibos.col.estado")}</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => (
              <tr key={fila.id} className="border-b border-linea last:border-b-0 hover:bg-muted/50">
                <td className="px-4 py-3 font-medium whitespace-nowrap">
                  <Link
                    href={`/contabilidad/recibos/${fila.id}`}
                    className="text-marca-600 hover:underline"
                  >
                    {numeroDocumento(SERIE_RECIBO[fila.tipo], fila.numero)}
                  </Link>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-tinta-2">{fechaCorta(fila.fecha, idioma)}</td>
                <td className="max-w-72 px-4 py-3">
                  <p className="truncate text-tinta">{fila.concepto}</p>
                  <p className="texto-meta truncate">
                    {[fila.categoria, fila.tercero].filter(Boolean).join(" · ")}
                  </p>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-tinta-2">{fila.cuenta}</td>
                <td className="px-4 py-3 text-right font-medium">
                  <Monto valor={signo(fila)} moneda={fila.moneda} conSigno />
                </td>
                <td className="px-4 py-3">
                  <InsigniaEstadoRecibo estado={fila.estado} etiqueta={t(`estado.${fila.estado}`)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden">
        {filas.map((fila) => (
          <li key={fila.id}>
            <Link href={`/contabilidad/recibos/${fila.id}`} className={`${TARJETA.interactiva} block p-4`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-tinta">
                    {numeroDocumento(SERIE_RECIBO[fila.tipo], fila.numero)}
                  </p>
                  <p className="truncate text-[15px] text-tinta-2">{fila.concepto}</p>
                  <p className="texto-meta">
                    {fechaCorta(fila.fecha, idioma)} · {fila.cuenta}
                  </p>
                </div>
                <Monto valor={signo(fila)} moneda={fila.moneda} conSigno className="font-semibold" />
              </div>
              <div className="mt-3">
                <InsigniaEstadoRecibo estado={fila.estado} etiqueta={t(`estado.${fila.estado}`)} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
