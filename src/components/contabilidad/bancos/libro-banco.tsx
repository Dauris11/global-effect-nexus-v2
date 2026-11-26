import { BookOpen, CheckCircle2, Search, X } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Monto, SELECT } from "@/components/contabilidad/comun";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Input } from "@/components/ui/input";
import { TooltipAyuda } from "@/components/ui/tooltip-ayuda";
import { Link } from "@/i18n/navigation";
import type { Moneda } from "@/lib/contabilidad/formato";
import { fechaCorta } from "@/lib/fechas";
import { INSIGNIA_SEMAFORO, TARJETA } from "@/lib/paleta";
import type { FilaExtractoMovimiento, FiltroExtracto } from "@/server/contabilidad/bancos/consultas";

/**
 * Resumen de movimientos del estado de cuenta (.csv) subido a la cuenta,
 * con filtros funcionales por fecha, tipo (retiros / depósitos) y texto.
 * Sin tarjetas de resumen de cuenta.
 */
export async function LibroBanco({
  cuentaId,
  moneda,
  filtro,
  movimientos,
  idioma,
}: {
  cuentaId: string;
  moneda: Moneda;
  filtro: FiltroExtracto;
  movimientos: FilaExtractoMovimiento[];
  idioma: "es" | "en";
}) {
  const t = await getTranslations("contab.libro");
  const hayFiltro = Boolean(filtro.desde || filtro.hasta || filtro.tipo || filtro.q);
  const esCero = (v: string) => /^-?0+(\.0+)?$/.test(v);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5">
        <h2 className="texto-titulo-seccion">{t("resumenEstado")}</h2>
        <TooltipAyuda texto={t("resumenEstadoAyuda")} etiqueta={t("masInformacion")} />
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="vista" value="movimientos" />
        <label className="space-y-1.5">
          <span className="block text-sm font-medium">{t("desde")}</span>
          <Input type="date" name="desde" defaultValue={filtro.desde ?? ""} />
        </label>
        <label className="space-y-1.5">
          <span className="block text-sm font-medium">{t("hasta")}</span>
          <Input type="date" name="hasta" defaultValue={filtro.hasta ?? ""} />
        </label>
        <label className="min-w-44 space-y-1.5">
          <span className="block text-sm font-medium">{t("tipo")}</span>
          <select name="tipo" defaultValue={filtro.tipo ?? ""} className={SELECT}>
            <option value="">{t("todos")}</option>
            <option value="retiro">{t("retiros")}</option>
            <option value="deposito">{t("depositos")}</option>
          </select>
        </label>
        <label className="min-w-52 flex-1 space-y-1.5">
          <span className="block text-sm font-medium">{t("buscar")}</span>
          <Input type="search" name="q" defaultValue={filtro.q ?? ""} />
        </label>
        <Button type="submit">
          <Search className="size-4" />
          {t("filtrar")}
        </Button>
        {hayFiltro && (
          <Button asChild variant="ghost">
            <Link href={`/contabilidad/bancos/${cuentaId}?vista=movimientos`}>
              <X className="size-4" />
              {t("limpiar")}
            </Link>
          </Button>
        )}
      </form>

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
          {movimientos.length === 500 && <p className="texto-meta">{t("tope")}</p>}
        </>
      )}
    </div>
  );
}
