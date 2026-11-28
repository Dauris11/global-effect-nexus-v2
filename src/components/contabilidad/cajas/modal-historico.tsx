"use client";

import { useMemo, useState } from "react";
import { History, Receipt, RotateCcw, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { SELECT } from "@/components/contabilidad/comun";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
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
 * tabla de 7 columnas con filtros en vivo (sin botón Filtrar) y fila de total al final.
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
  const tCommon = useTranslations("common");

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

  const controlAlineado = "h-9 w-full min-w-0 max-w-full px-3 py-0 text-sm";
  const selectAlineado = cn(SELECT, "h-9 w-full min-w-0 max-w-full truncate px-3 text-sm");

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-9 whitespace-nowrap px-3.5">
          <History className="size-4" />
          {t("historico")}
        </Button>
      </DialogTrigger>
      <DialogContent
        mostrarCerrar={false}
        className="flex max-h-[88vh] w-full flex-col gap-0 overflow-hidden p-0 pt-5 md:max-h-[88vh] md:w-[92vw] md:max-w-[1100px] md:rounded-2xl md:p-0 md:pt-0"
      >
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-linea px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <DialogClose asChild>
              <button
                type="button"
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-tinta-2 transition-colors hover:bg-muted hover:text-tinta focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <X className="size-4" />
                <span className="sr-only">{tCommon("close")}</span>
              </button>
            </DialogClose>
            <DialogTitle className="truncate text-base font-semibold text-tinta">
              {t("historicoTitulo")}
            </DialogTitle>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={limpiarFiltros}
            disabled={!hayFiltros}
            className="shrink-0 text-marca-700 hover:bg-marca-50 hover:text-marca-700 disabled:text-tinta-3"
          >
            <RotateCcw className="size-3.5" />
            {t("limpiarFiltros")}
          </Button>
        </div>

        <div className="min-w-0 flex-1 space-y-5 overflow-x-hidden overflow-y-auto p-5 sm:p-6">
          <div className="rounded-xl border border-linea bg-muted/40 p-4">
            <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-12">
              <div className="min-w-0 space-y-1.5 lg:col-span-3">
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

              <div className="min-w-0 space-y-1.5 lg:col-span-3">
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

              <div className="min-w-0 space-y-1.5 lg:col-span-3">
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

              <div className="min-w-0 space-y-1.5 lg:col-span-3">
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

              <div className="min-w-0 space-y-1.5 sm:col-span-2 lg:col-span-6">
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

              <div className="min-w-0 space-y-1.5 lg:col-span-3">
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

              <div className="min-w-0 space-y-1.5 lg:col-span-3">
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
          </div>

          {filtrados.length === 0 ? (
            <EstadoVacio icono={Receipt} titulo={t("sinHistorico")} />
          ) : (
            <>
              <div className="hidden w-full min-w-0 overflow-x-auto rounded-xl border border-linea bg-background md:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-linea bg-muted/40 text-xs text-tinta-2">
                    <tr>
                      <th className="whitespace-nowrap px-3.5 py-2.5 font-medium">{t("colNumero")}</th>
                      <th className="whitespace-nowrap px-3.5 py-2.5 font-medium">{t("colFecha")}</th>
                      <th className="whitespace-nowrap px-3.5 py-2.5 font-medium">{t("colComprobante")}</th>
                      <th className="px-3.5 py-2.5 font-medium">{t("colConcepto")}</th>
                      <th className="whitespace-nowrap px-3.5 py-2.5 font-medium">{t("colEntregadoA")}</th>
                      <th className="whitespace-nowrap px-3.5 py-2.5 font-medium">{t("colCategoriaGasto")}</th>
                      <th className="whitespace-nowrap px-3.5 py-2.5 text-right font-medium">{t("colMonto")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-linea">
                    {filtrados.map((m) => {
                      const persona = m.entregadoA ?? m.personaNombre ?? "—";
                      const categoriaTxt = m.cuentaGasto ?? "—";
                      return (
                        <tr key={m.id} className="transition-colors hover:bg-muted/40">
                          <td className="whitespace-nowrap px-3.5 py-2.5 font-mono text-xs text-tinta-2">
                            CJ-{m.numero}
                          </td>
                          <td className="whitespace-nowrap px-3.5 py-2.5 font-mono text-xs tabular-nums text-tinta">
                            {formatearFechaDdMmYyyy(m.fecha)}
                          </td>
                          <td className="whitespace-nowrap px-3.5 py-2.5 font-mono text-xs text-tinta-2">
                            {m.comprobanteNumero || "—"}
                          </td>
                          <td className="max-w-[220px] truncate px-3.5 py-2.5 text-sm text-tinta" title={m.concepto}>
                            {m.concepto}
                          </td>
                          <td className="max-w-[150px] truncate px-3.5 py-2.5 text-sm text-tinta" title={persona}>
                            {persona}
                          </td>
                          <td className="max-w-[170px] truncate px-3.5 py-2.5 text-sm text-tinta-2" title={categoriaTxt}>
                            {categoriaTxt}
                          </td>
                          <td className="whitespace-nowrap px-3.5 py-2.5 text-right font-mono text-sm font-medium tabular-nums text-tinta">
                            −{formatearMonto(m.monto, moneda)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t-2 border-linea bg-muted/50 font-semibold text-tinta">
                    <tr>
                      <td
                        colSpan={6}
                        className="px-3.5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-tinta-2"
                      >
                        {t("total")}
                      </td>
                      <td className="whitespace-nowrap px-3.5 py-3 text-right font-mono text-sm font-semibold tabular-nums text-marca-700">
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
                        <p className="whitespace-nowrap font-mono font-semibold tabular-nums text-tinta">
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
                <div className={`${TARJETA.contenido} flex items-center justify-between bg-muted/50 px-4 py-3`}>
                  <span className="text-xs font-semibold uppercase tracking-wide text-tinta-2">
                    {t("total")}
                  </span>
                  <span className="font-mono font-semibold tabular-nums text-marca-700">
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
