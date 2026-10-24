import { getTranslations } from "next-intl/server";

import { Monto } from "@/components/contabilidad/comun";
import { CeldaMonto } from "@/components/contabilidad/libros/comun-libros";
import { Link } from "@/i18n/navigation";
import { fechaCorta } from "@/lib/fechas";
import { TARJETA } from "@/lib/paleta";
import type { CuentaMayor, MovimientoMayor, ResumenMayor } from "@/server/contabilidad/libros/consultas";

/**
 * El mayor de una cuenta: saldo inicial, cada movimiento con su saldo
 * corrido (calculado por la base) y saldo final. En una cuenta de grupo se
 * muestra de qué hija viene cada línea; en una hoja sería ruido.
 */
export async function LibroMayor({
  cuenta,
  resumen,
  movimientos,
  desde,
  idioma,
}: {
  cuenta: CuentaMayor;
  resumen: ResumenMayor;
  movimientos: MovimientoMayor[];
  desde: string;
  idioma: "es" | "en";
}) {
  const t = await getTranslations("contab.libros");
  const num = "px-4 py-2.5 text-right tabular-nums whitespace-nowrap";
  const deGrupo = !cuenta.admiteMovimiento;

  return (
    <>
      <div className="hidden overflow-x-auto rounded-card border border-linea bg-card shadow-card md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-linea text-tinta-3">
            <tr>
              <th className="px-4 py-3 font-medium">{t("col.fecha")}</th>
              <th className="px-4 py-3 font-medium">{t("col.asiento")}</th>
              <th className="px-4 py-3 font-medium">{t("col.concepto")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("col.debe")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("col.haber")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("col.saldo")}</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-linea bg-muted/40 text-tinta-2">
              <td className="px-4 py-2.5 whitespace-nowrap">{fechaCorta(desde, idioma)}</td>
              <td colSpan={4} className="px-4 py-2.5 font-medium">{t("saldoInicial")}</td>
              <td className={`${num} font-medium`}><Monto valor={resumen.saldoInicial} moneda="DOP" /></td>
            </tr>
            {movimientos.map((m) => (
              <tr key={m.id} className="border-b border-linea last:border-b-0">
                <td className="px-4 py-2.5 whitespace-nowrap text-tinta-2">{fechaCorta(m.fecha, idioma)}</td>
                <td className="px-4 py-2.5">
                  <Link
                    href={`/contabilidad/asientos/${m.asientoId}`}
                    className="font-medium text-marca-600 tabular-nums hover:underline"
                  >
                    {m.numero}
                  </Link>
                </td>
                <td className="max-w-96 px-4 py-2.5">
                  <p className="flex items-center gap-2 text-tinta">
                    <span className="truncate">{m.descripcion ?? m.concepto}</span>
                  </p>
                  {deGrupo && <p className="texto-meta truncate tabular-nums">{m.codigo} · {m.cuenta}</p>}
                </td>
                <CeldaMonto valor={m.debe} className={num} />
                <CeldaMonto valor={m.haber} className={num} />
                <td className={`${num} font-medium text-tinta`}><Monto valor={m.saldo} moneda="DOP" /></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-tinta font-semibold text-tinta">
              <td colSpan={3} className="px-4 py-3 text-right">{t("saldoFinal")}</td>
              <td className={`${num} py-3`}><Monto valor={resumen.debe} moneda="DOP" /></td>
              <td className={`${num} py-3`}><Monto valor={resumen.haber} moneda="DOP" /></td>
              <td className={`${num} py-3`}><Monto valor={resumen.saldoFinal} moneda="DOP" /></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <ul className="space-y-3 md:hidden">
        {movimientos.map((m) => (
          <li key={m.id}>
            <Link href={`/contabilidad/asientos/${m.asientoId}`} className={`${TARJETA.interactiva} block p-4`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-tinta tabular-nums">
                    {t("numeroAsiento", { numero: m.numero })}
                    <span className="texto-meta ml-2 font-normal">{fechaCorta(m.fecha, idioma)}</span>
                  </p>
                  <p className="truncate text-[15px] text-tinta-2">{m.descripcion ?? m.concepto}</p>
                  {deGrupo && <p className="texto-meta truncate">{m.codigo} · {m.cuenta}</p>}
                </div>
                <div className="shrink-0 text-right">
                  <Monto
                    valor={Number(m.debe) > 0 ? m.debe : `-${m.haber}`}
                    moneda="DOP"
                    conSigno
                    className="font-medium"
                  />
                  <p className="texto-meta">
                    {t("col.saldo")} <Monto valor={m.saldo} moneda="DOP" />
                  </p>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
