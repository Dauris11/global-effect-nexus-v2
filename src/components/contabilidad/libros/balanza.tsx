import { getTranslations } from "next-intl/server";

import { Monto } from "@/components/contabilidad/comun";
import { CeldaMonto } from "@/components/contabilidad/libros/comun-libros";
import { consultaLibros } from "@/components/contabilidad/libros/enlaces";
import { Link } from "@/i18n/navigation";
import { TARJETA } from "@/lib/paleta";
import { cn } from "@/lib/utils";
import type { FiltroLibros, FilaBalanza, TotalesLibro } from "@/server/contabilidad/libros/consultas";

/**
 * La balanza en orden de árbol: las cuentas de grupo en negrita como
 * subtotal de lo que tienen debajo, las hojas sangradas por nivel. Cada
 * cuenta abre su mayor con el mismo rango. Los saldos llevan el signo
 * natural de la cuenta, por eso el pie solo totaliza debe y haber: sumar
 * saldos de activo con saldos de pasivo no da ninguna cifra que signifique
 * algo.
 */
export async function Balanza({
  filas,
  totales,
  filtro,
}: {
  filas: FilaBalanza[];
  totales: TotalesLibro;
  filtro: FiltroLibros;
}) {
  const t = await getTranslations("contab.libros");
  const num = "px-4 py-2 text-right tabular-nums whitespace-nowrap";
  const mayor = (id: string) => `/contabilidad/libros?${consultaLibros(filtro, { vista: "mayor", cuenta: id, ceros: false })}`;

  return (
    <>
      <div className="hidden overflow-x-auto rounded-card border border-linea bg-card shadow-card md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-linea text-tinta-3">
            <tr>
              <th className="px-4 py-3 font-medium">{t("col.cuenta")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("saldoInicial")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("col.debe")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("col.haber")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("saldoFinal")}</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr
                key={f.id}
                className={cn(
                  "border-b border-linea last:border-b-0 hover:bg-muted/50",
                  !f.admiteMovimiento && "font-semibold text-tinta",
                  f.nivel === 0 && "bg-muted/40",
                )}
              >
                {/* Sangría por nivel con estilo en línea: Tailwind no genera clases de un valor calculado. */}
                <td className="py-2 pr-4" style={{ paddingLeft: `${1 + f.nivel * 1.25}rem` }}>
                  <Link href={mayor(f.id)} className="hover:text-marca-600 hover:underline">
                    <span className="tabular-nums text-tinta-3">{f.codigo}</span>{" "}
                    <span>{f.nombre}</span>
                  </Link>
                </td>
                <CeldaMonto valor={f.saldoInicial} className={num} />
                <CeldaMonto valor={f.debe} className={num} />
                <CeldaMonto valor={f.haber} className={num} />
                <CeldaMonto valor={f.saldoFinal} className={num} />
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-tinta font-semibold text-tinta">
              <td colSpan={2} className="px-4 py-3 text-right">{t("totalPeriodo")}</td>
              <td className={`${num} py-3`}><Monto valor={totales.debe} moneda="DOP" /></td>
              <td className={`${num} py-3`}><Monto valor={totales.haber} moneda="DOP" /></td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <ul className="space-y-2 md:hidden">
        {filas.map((f) => (
          <li key={f.id} style={{ marginLeft: `${Math.min(f.nivel, 3) * 0.75}rem` }}>
            <Link href={mayor(f.id)} className={`${TARJETA.interactiva} block p-3.5`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={cn("truncate text-[15px] text-tinta", !f.admiteMovimiento && "font-semibold")}>
                    {f.nombre}
                  </p>
                  <p className="texto-meta tabular-nums">{f.codigo}</p>
                </div>
                <div className="shrink-0 text-right">
                  <Monto valor={f.saldoFinal} moneda="DOP" className="font-semibold" />
                  <p className="texto-meta">
                    {t("col.debe")} <Monto valor={f.debe} moneda="DOP" />
                  </p>
                  <p className="texto-meta">
                    {t("col.haber")} <Monto valor={f.haber} moneda="DOP" />
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
