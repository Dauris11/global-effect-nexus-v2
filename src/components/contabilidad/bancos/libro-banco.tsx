import { BookOpen, CheckCircle2 } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { FiltrosMovimientosBanco } from "@/components/contabilidad/bancos/filtros-movimientos";
import { Monto } from "@/components/contabilidad/comun";
import { Badge } from "@/components/ui/badge";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { TooltipAyuda } from "@/components/ui/tooltip-ayuda";
import { sumarMontos, type Moneda } from "@/lib/contabilidad/formato";
import type { ImpuestoCargo } from "@/lib/contabilidad/impuestos-cargos";
import { fechaCorta } from "@/lib/fechas";
import { INSIGNIA_SEMAFORO, TARJETA } from "@/lib/paleta";
import type { FilaExtractoMovimiento, FiltroExtracto } from "@/server/contabilidad/bancos/consultas";

/**
 * Resumen de movimientos del estado de cuenta (.csv) subido a la cuenta,
 * con filtros en vivo por fecha, tipo, comisiones y texto, y totales de
 * débitos y créditos debajo de la tabla.
 */
export async function LibroBanco({
  cuentaId,
  moneda,
  filtro,
  movimientos,
  cargos,
  idioma,
}: {
  cuentaId: string;
  moneda: Moneda;
  filtro: FiltroExtracto;
  movimientos: FilaExtractoMovimiento[];
  cargos: ImpuestoCargo[];
  idioma: "es" | "en";
}) {
  const t = await getTranslations("contab.libro");
  const esCero = (v: string) => /^-?0+(\.0+)?$/.test(v);
  const totalDebitos = sumarMontos(movimientos.map((m) => m.retiros));
  const totalCreditos = sumarMontos(movimientos.map((m) => m.depositos));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5">
        <h2 className="texto-titulo-seccion">{t("resumenEstado")}</h2>
        <TooltipAyuda texto={t("resumenEstadoAyuda")} etiqueta={t("masInformacion")} />
      </div>

      <FiltrosMovimientosBanco cuentaId={cuentaId} filtro={filtro} cargos={cargos} />

      {movimientos.length === 0 ? (
        <EstadoVacio icono={BookOpen} titulo={t("vacio")} />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-card border border-linea bg-card shadow-card md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-linea text-tinta-3">
                <tr>
                  <th className="whitespace-nowrap px-3 py-3 font-medium">{t("fechaPosteo")}</th>
                  <th className="whitespace-nowrap px-3 py-3 font-medium">{t("fechaEfectiva")}</th>
                  <th className="whitespace-nowrap px-3 py-3 font-medium">{t("noCheque")}</th>
                  <th className="whitespace-nowrap px-3 py-3 font-medium">{t("noReferencia")}</th>
                  <th className="px-3 py-3 font-medium">{t("descripcion")}</th>
                  <th className="whitespace-nowrap px-3 py-3 text-right font-medium">{t("retiros")}</th>
                  <th className="whitespace-nowrap px-3 py-3 text-right font-medium">{t("depositos")}</th>
                  <th className="whitespace-nowrap px-3 py-3 text-right font-medium">{t("balance")}</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((fila) => (
                  <tr key={fila.id} className="border-b border-linea last:border-b-0">
                    <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-tinta-2">
                      {fila.fecha_posteo ? fechaCorta(fila.fecha_posteo, idioma) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-tinta">
                      {fechaCorta(fila.fecha, idioma)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-tinta-2">
                      {fila.no_cheque || "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-tinta-2">
                      {fila.referencia || "—"}
                    </td>
                    <td className="max-w-80 px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-tinta">{fila.descripcion}</span>
                        {fila.conciliada && (
                          <Badge className={`${INSIGNIA_SEMAFORO.dentro} shrink-0`}>
                            <CheckCircle2 />
                            {t("conciliada")}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-tinta">
                      {esCero(fila.retiros) ? <span className="text-tinta-3">—</span> : <Monto valor={fila.retiros} moneda={moneda} />}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-marca-600">
                      {esCero(fila.depositos) ? <span className="text-tinta-3">—</span> : <Monto valor={fila.depositos} moneda={moneda} />}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-tinta-2">
                      {fila.saldo ? <Monto valor={fila.saldo} moneda={moneda} /> : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-3 md:hidden">
            {movimientos.map((fila) => (
              <li key={fila.id} className={`${TARJETA.contenido} space-y-2 p-4`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-tinta">{fila.descripcion}</p>
                    <p className="texto-meta tabular-nums">
                      {fechaCorta(fila.fecha, idioma)}
                      {fila.referencia && ` · ${fila.referencia}`}
                      {fila.no_cheque && ` · ${t("cheque", { numero: fila.no_cheque })}`}
                    </p>
                  </div>
                  {fila.conciliada && (
                    <Badge className={`${INSIGNIA_SEMAFORO.dentro} shrink-0`}>
                      <CheckCircle2 />
                      {t("conciliada")}
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <p>
                    <span className="texto-meta block">{t("retiros")}</span>
                    {esCero(fila.retiros) ? "—" : <Monto valor={fila.retiros} moneda={moneda} />}
                  </p>
                  <p className="text-right">
                    <span className="texto-meta block">{t("depositos")}</span>
                    {esCero(fila.depositos) ? "—" : <Monto valor={fila.depositos} moneda={moneda} />}
                  </p>
                  <p className="text-right">
                    <span className="texto-meta block">{t("balance")}</span>
                    {fila.saldo ? <Monto valor={fila.saldo} moneda={moneda} /> : "—"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-end gap-x-8 gap-y-2 rounded-card border border-linea bg-card px-4 py-3 text-sm shadow-card">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-tinta-2">
                {t("totalDebitos")}
              </span>
              <Monto valor={totalDebitos} moneda={moneda} className="font-semibold text-tinta" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-tinta-2">
                {t("totalCreditos")}
              </span>
              <Monto valor={totalCreditos} moneda={moneda} className="font-semibold text-marca-600" />
            </div>
          </div>

          {movimientos.length === 500 && <p className="texto-meta">{t("tope")}</p>}
        </>
      )}
    </div>
  );
}
