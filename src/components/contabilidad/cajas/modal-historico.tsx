"use client";

import { useMemo, useState } from "react";
import { History, Receipt, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";

import { SELECT } from "@/components/contabilidad/comun";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COMPROBANTES_RD } from "@/lib/contabilidad/comprobantes-rd";
import { formatearMonto, sumarMontos } from "@/lib/contabilidad/formato";
import { TARJETA } from "@/lib/paleta";
import { cn } from "@/lib/utils";
import type { CategoriaGastoCaja, MovimientoCaja } from "@/server/contabilidad/cajas/consultas";

function formatearFechaDdMmYyyy(iso: string): string {
  const partes = iso.split("-");
  if (partes.length !== 3) return iso;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Histórico de movimientos ya repuestos de una caja chica:
 * tabla idéntica a la de Movimientos con filtros en vivo (sin botón Filtrar)
 * y fila de total al final.
 */
export function ModalHistoricoCaja({
  movimientos,
  moneda,
  categorias,
}: {
  movimientos: MovimientoCaja[];
  moneda: "DOP" | "USD";
  categorias: CategoriaGastoCaja[];
}) {
  const t = useTranslations("contab.cajas");

  const [abierto, setAbierto] = useState(false);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [tipoComprobante, setTipoComprobante] = useState("");
  const [entregadoA, setEntregadoA] = useState("");
  const [categoria, setCategoria] = useState("");
  const [montoMin, setMontoMin] = useState("");
  const [montoMax, setMontoMax] = useState("");

  const opcionesCategoria = useMemo(() => {
    const nombres = new Set<string>();
    for (const c of categorias) {
      if (c.nombre) nombres.add(c.nombre);
    }
    for (const m of movimientos) {
      if (m.cuentaGasto) nombres.add(m.cuentaGasto);
    }
    return Array.from(nombres).sort((a, b) => a.localeCompare(b, "es"));
  }, [categorias, movimientos]);

  const filtrados = useMemo(() => {
    const busquedaEntregado = normalizarTexto(entregadoA);
    const min = montoMin.trim() !== "" ? Number(montoMin) : null;
    const max = montoMax.trim() !== "" ? Number(montoMax) : null;

    return movimientos.filter((m) => {
      if (desde && m.fecha < desde) return false;
      if (hasta && m.fecha > hasta) return false;
      if (tipoComprobante) {
        const comp = (m.comprobanteNumero ?? "").trim().toUpperCase();
        if (!comp.startsWith(tipoComprobante)) return false;
      }
      if (busquedaEntregado) {
        const persona = normalizarTexto(m.entregadoA ?? m.personaNombre ?? "");
        if (!persona.includes(busquedaEntregado)) return false;
      }
      if (categoria && (m.cuentaGasto ?? "") !== categoria) return false;
      const montoNum = Number(m.monto);
      if (min !== null && Number.isFinite(min) && montoNum < min) return false;
      if (max !== null && Number.isFinite(max) && montoNum > max) return false;
      return true;
    });
  }, [movimientos, desde, hasta, tipoComprobante, entregadoA, categoria, montoMin, montoMax]);

  const totalFiltrado = useMemo(
    () => sumarMontos(filtrados.map((m) => m.monto)),
    [filtrados],
  );

  const hayFiltros = Boolean(
    desde || hasta || tipoComprobante || entregadoA.trim() || categoria || montoMin.trim() || montoMax.trim(),
  );

  function limpiarFiltros() {
    setDesde("");
    setHasta("");
    setTipoComprobante("");
    setEntregadoA("");
    setCategoria("");
    setMontoMin("");
    setMontoMax("");
  }

  const controlAlineado = "h-9 px-3 py-0 text-sm";
  const selectAlineado = cn(SELECT, "h-9 px-3 text-sm");

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <History className="size-4" />
          {t("historico")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto md:max-w-5xl">
        <DialogHeader className="flex flex-row items-center justify-between gap-3 pr-8">
          <DialogTitle>{t("historicoTitulo")}</DialogTitle>
          {hayFiltros && (
            <Button type="button" variant="ghost" size="sm" onClick={limpiarFiltros}>
              <RotateCcw className="size-3.5" />
              {t("limpiarFiltros")}
            </Button>
          )}
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="grid grid-cols-1 items-end gap-3 rounded-control border border-linea bg-muted/30 p-3.5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="hist-desde" className="block text-xs font-medium leading-none text-tinta-2">
                {t("filtroDesde")}
              </Label>
              <Input
                id="hist-desde"
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                className={controlAlineado}
              />
            </div>

            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="hist-hasta" className="block text-xs font-medium leading-none text-tinta-2">
                {t("filtroHasta")}
              </Label>
              <Input
                id="hist-hasta"
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                className={controlAlineado}
              />
            </div>

            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="hist-comp" className="block text-xs font-medium leading-none text-tinta-2">
                {t("filtroTipoComprobante")}
              </Label>
              <select
                id="hist-comp"
                className={selectAlineado}
                value={tipoComprobante}
                onChange={(e) => setTipoComprobante(e.target.value)}
              >
                <option value="">{t("filtroTodos")}</option>
                {COMPROBANTES_RD.map((c) => (
                  <option key={c.codigo} value={c.codigo}>
                    {c.codigo} · {c.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="hist-cat" className="block text-xs font-medium leading-none text-tinta-2">
                {t("filtroCategoria")}
              </Label>
              <select
                id="hist-cat"
                className={selectAlineado}
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
              >
                <option value="">{t("filtroTodas")}</option>
                {opcionesCategoria.map((nombre) => (
                  <option key={nombre} value={nombre}>
                    {nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-0 space-y-1.5 sm:col-span-2">
              <Label htmlFor="hist-entregado" className="block text-xs font-medium leading-none text-tinta-2">
                {t("filtroEntregadoA")}
              </Label>
              <Input
                id="hist-entregado"
                type="search"
                value={entregadoA}
                onChange={(e) => setEntregadoA(e.target.value)}
                className={controlAlineado}
              />
            </div>

            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="hist-min" className="block text-xs font-medium leading-none text-tinta-2">
                {t("filtroMontoMin")}
              </Label>
              <Input
                id="hist-min"
                type="number"
                step="0.01"
                min="0"
                value={montoMin}
                onChange={(e) => setMontoMin(e.target.value)}
                className={cn(controlAlineado, "font-mono tabular-nums")}
              />
            </div>

            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="hist-max" className="block text-xs font-medium leading-none text-tinta-2">
                {t("filtroMontoMax")}
              </Label>
              <Input
                id="hist-max"
                type="number"
                step="0.01"
                min="0"
                value={montoMax}
                onChange={(e) => setMontoMax(e.target.value)}
                className={cn(controlAlineado, "font-mono tabular-nums")}
              />
            </div>
          </div>

          {filtrados.length === 0 ? (
            <EstadoVacio icono={Receipt} titulo={t("sinHistorico")} />
          ) : (
            <>
              <div className={`${TARJETA.contenido} hidden overflow-x-auto md:block`}>
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-linea text-xs text-tinta-2">
                    <tr>
                      <th className="whitespace-nowrap px-4 py-3 font-medium">{t("colNumero")}</th>
                      <th className="whitespace-nowrap px-4 py-3 font-medium">{t("colFecha")}</th>
                      <th className="whitespace-nowrap px-4 py-3 font-medium">{t("colComprobante")}</th>
                      <th className="px-4 py-3 font-medium">{t("colConcepto")}</th>
                      <th className="whitespace-nowrap px-4 py-3 font-medium">{t("colEntregadoA")}</th>
                      <th className="whitespace-nowrap px-4 py-3 font-medium">{t("colCategoriaGasto")}</th>
                      <th className="whitespace-nowrap px-4 py-3 text-right font-medium">{t("colMonto")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-linea">
                    {filtrados.map((m) => (
                      <tr key={m.id} className="transition-colors hover:bg-muted/40">
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-tinta-2">
                          CJ-{m.numero}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs tabular-nums text-tinta">
                          {formatearFechaDdMmYyyy(m.fecha)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-tinta-2">
                          {m.comprobanteNumero || "—"}
                        </td>
                        <td className="max-w-xs truncate px-4 py-3 text-tinta" title={m.concepto}>
                          {m.concepto}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-tinta">
                          {m.entregadoA ?? m.personaNombre ?? "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-tinta-2">
                          {m.cuentaGasto ?? "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-mono tabular-nums text-tinta">
                          −{formatearMonto(m.monto, moneda)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-linea bg-muted/30">
                    <tr>
                      <td colSpan={6} className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-tinta-2">
                        {t("total")}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-semibold tabular-nums text-tinta">
                        −{formatearMonto(totalFiltrado, moneda)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="space-y-3 md:hidden">
                <ul className="space-y-3">
                  {filtrados.map((m) => (
                    <li key={m.id} className={`${TARJETA.contenido} space-y-2 p-4`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-tinta">{m.concepto}</p>
                          <p className="texto-meta font-mono tabular-nums">
                            CJ-{m.numero} · {formatearFechaDdMmYyyy(m.fecha)}
                            {m.comprobanteNumero && ` · ${m.comprobanteNumero}`}
                          </p>
                        </div>
                        <p className="whitespace-nowrap font-mono font-semibold text-tinta">
                          −{formatearMonto(m.monto, moneda)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-tinta-2">
                        <span>{m.entregadoA ?? m.personaNombre ?? "—"}</span>
                        <span>{m.cuentaGasto ?? "—"}</span>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className={`${TARJETA.contenido} flex items-center justify-between px-4 py-3`}>
                  <span className="text-xs font-semibold uppercase tracking-wide text-tinta-2">
                    {t("total")}
                  </span>
                  <span className="font-mono font-semibold tabular-nums text-tinta">
                    −{formatearMonto(totalFiltrado, moneda)}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
