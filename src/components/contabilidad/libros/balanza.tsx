import { getTranslations } from "next-intl/server";

import { Monto } from "@/components/contabilidad/comun";
import { CeldaMonto } from "@/components/contabilidad/libros/comun-libros";
import { TARJETA } from "@/lib/paleta";
import { cn } from "@/lib/utils";
import type { FilaBalanza, TotalesLibro } from "@/server/contabilidad/libros/consultas";

/**
 * Balanza de comprobación en orden de árbol: las cuentas agrupadoras en negrita
 * consolidan los saldos netos de sus auxiliares respetando la naturaleza de
 * cada cuenta. Débito y Crédito siempre muestran valores positivos en el lado
 * del saldo neto; Balance de Auxiliares muestra el saldo neto según naturaleza
 * (incluyendo 0.00 en cuentas liquidadas y signo negativo en sobregiros).
 */
export async function Balanza({ filas, totales }: { filas: FilaBalanza[]; totales: TotalesLibro }) {
  const t = await getTranslations("contab.libros");
  const num = "px-4 py-2 text-right tabular-nums whitespace-nowrap";
  const esCero = (valor: string) => /^-?0+(\.0+)?$/.test(valor);

  return (
    <>
      <div className="hidden overflow-x-auto rounded-card border border-linea bg-card shadow-card md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-linea text-tinta-3">
            <tr>
              <th className="px-4 py-3 font-medium">{t("col.cuenta")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("col.balanceAuxiliares")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("col.debe")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("col.haber")}</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr
                key={f.id}
                className={cn(
                  "border-b border-linea last:border-b-0",
                  !f.admiteMovimiento && "font-semibold text-tinta",
                  f.nivel === 0 && "bg-muted/40",
                )}
              >
                {/* Sangría por nivel con estilo en línea: Tailwind no genera clases de un valor calculado. */}
                <td className="py-2 pr-4" style={{ paddingLeft: `${1 + f.nivel * 1.25}rem` }}>
                  <span className="tabular-nums text-tinta-3">{f.codigo}</span> <span>{f.nombre}</span>
                </td>
                <td className={cn(num, esCero(f.balanceAuxiliares) ? "text-tinta-3" : "text-tinta-2")}>
                  <Monto valor={f.balanceAuxiliares} moneda="DOP" />
                </td>
                <CeldaMonto valor={f.debe} className={num} />
                <CeldaMonto valor={f.haber} className={num} />
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-tinta font-semibold text-tinta">
              <td colSpan={2} className="px-4 py-3 text-right">{t("totalPeriodo")}</td>
              <td className={`${num} py-3`}><Monto valor={totales.debe} moneda="DOP" /></td>
              <td className={`${num} py-3`}><Monto valor={totales.haber} moneda="DOP" /></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <ul className="space-y-2 md:hidden">
        {filas.map((f) => (
          <li
            key={f.id}
            className={`${TARJETA.contenido} p-3.5`}
            style={{ marginLeft: `${Math.min(f.nivel, 3) * 0.75}rem` }}
          >
            <p className={cn("truncate text-[15px] text-tinta", !f.admiteMovimiento && "font-semibold")}>
              {f.nombre}
            </p>
            <p className="texto-meta tabular-nums">{f.codigo}</p>
            <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
              <p>
                <span className="texto-meta block">{t("col.balanceAuxiliares")}</span>
                <Monto
                  valor={f.balanceAuxiliares}
                  moneda="DOP"
                  className={esCero(f.balanceAuxiliares) ? "text-tinta-3" : undefined}
                />
              </p>
              <p className="text-right">
                <span className="texto-meta block">{t("col.debe")}</span>
                {esCero(f.debe) ? <span className="text-tinta-3">—</span> : <Monto valor={f.debe} moneda="DOP" />}
              </p>
              <p className="text-right">
                <span className="texto-meta block">{t("col.haber")}</span>
                {esCero(f.haber) ? <span className="text-tinta-3">—</span> : <Monto valor={f.haber} moneda="DOP" />}
              </p>
            </div>
          </li>
        ))}
        <li className={`${TARJETA.contenido} border-t-2 border-tinta p-3.5 font-semibold text-tinta`}>
          <p className="text-sm">{t("totalPeriodo")}</p>
          <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
            <p>
              <span className="texto-meta block font-normal">{t("col.debe")}</span>
              <Monto valor={totales.debe} moneda="DOP" />
            </p>
            <p className="text-right">
              <span className="texto-meta block font-normal">{t("col.haber")}</span>
              <Monto valor={totales.haber} moneda="DOP" />
            </p>
          </div>
        </li>
      </ul>
    </>
  );
}
