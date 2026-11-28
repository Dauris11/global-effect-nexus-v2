"use client";

import { useMemo, useState } from "react";
import { History, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";

import { SELECT } from "@/components/contabilidad/comun";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { redondear } from "@/lib/contabilidad/cajas";
import { formatearMonto } from "@/lib/contabilidad/formato";
import { cn } from "@/lib/utils";
import type {
  CierreCajaGeneral,
  MovimientoCajaGeneral,
} from "@/server/contabilidad/cajas/consultas";

/**
 * Modal de «Historial» de Caja General: misma estructura de dos tablas paralelas
 * (Ingresos a la izquierda, Egresos a la derecha) con columnas Fecha, Concepto,
 * Monto, totales al final y filtros reactivos por rango de fecha, monto y cierre.
 */
export function ModalHistorialCajaGeneral({
  ingresos,
  egresos,
  cierres,
  moneda,
}: {
  ingresos: readonly MovimientoCajaGeneral[];
  egresos: readonly MovimientoCajaGeneral[];
  cierres: readonly CierreCajaGeneral[];
  moneda: "DOP" | "USD";
}) {
  const t = useTranslations("contab.cajas");
  const tg = useTranslations("contab.cajas.cajaGeneral");

  const [abierto, setAbierto] = useState(false);
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [montoMin, setMontoMin] = useState("");
  const [montoMax, setMontoMax] = useState("");
  const [cierreId, setCierreId] = useState("");

  const hayFiltros = Boolean(fechaDesde || fechaHasta || montoMin || montoMax || cierreId);

  function limpiar() {
    setFechaDesde("");
    setFechaHasta("");
    setMontoMin("");
    setMontoMax("");
    setCierreId("");
  }

  const filtrar = (lista: readonly MovimientoCajaGeneral[]) => {
    const min = montoMin.trim() !== "" ? Number(montoMin) : null;
    const max = montoMax.trim() !== "" ? Number(montoMax) : null;

    return lista.filter((m) => {
      if (fechaDesde && m.fecha < fechaDesde) return false;
      if (fechaHasta && m.fecha > fechaHasta) return false;
      if (cierreId && m.arqueoId !== cierreId) return false;
      const val = Number(m.monto) || 0;
      if (min !== null && Number.isFinite(min) && val < min) return false;
      if (max !== null && Number.isFinite(max) && val > max) return false;
      return true;
    });
  };

  const ingresosFiltrados = useMemo(
    () => filtrar(ingresos),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ingresos, fechaDesde, fechaHasta, montoMin, montoMax, cierreId],
  );
  const egresosFiltrados = useMemo(
    () => filtrar(egresos),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [egresos, fechaDesde, fechaHasta, montoMin, montoMax, cierreId],
  );

  const totalIngresos = useMemo(
    () => redondear(ingresosFiltrados.reduce((acc, m) => acc + (Number(m.monto) || 0), 0)),
    [ingresosFiltrados],
  );
  const totalEgresos = useMemo(
    () => redondear(egresosFiltrados.reduce((acc, m) => acc + (Number(m.monto) || 0), 0)),
    [egresosFiltrados],
  );

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="md"
        className="whitespace-nowrap px-3.5"
        onClick={() => setAbierto(true)}
      >
        <History className="size-4" />
        {tg("historial")}
      </Button>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="flex max-h-[90vh] w-[96vw] flex-col overflow-hidden md:max-w-6xl">
          <DialogHeader className="shrink-0">
            <div className="flex flex-wrap items-center justify-between gap-2 pr-2 pl-8">
              <div>
                <DialogTitle>{tg("historialTitulo")}</DialogTitle>
                <DialogDescription>{tg("historialDescripcion")}</DialogDescription>
              </div>
              {hayFiltros && (
                <Button type="button" variant="ghost" size="sm" onClick={limpiar}>
                  <RotateCcw className="size-3.5" />
                  {t("limpiarFiltros")}
                </Button>
              )}
            </div>
          </DialogHeader>

          {/* Filtros reactivos sin botón Filtrar */}
          <div className="grid shrink-0 grid-cols-1 gap-3 rounded-xl border border-linea bg-muted/30 p-3.5 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1">
              <Label htmlFor="hist-desde" className="text-xs font-medium text-tinta-2">
                {tg("fechaDesde")}
              </Label>
              <Input
                id="hist-desde"
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="h-9 bg-background text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="hist-hasta" className="text-xs font-medium text-tinta-2">
                {tg("fechaHasta")}
              </Label>
              <Input
                id="hist-hasta"
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="h-9 bg-background text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="hist-mmin" className="text-xs font-medium text-tinta-2">
                {tg("montoMin")}
              </Label>
              <Input
                id="hist-mmin"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={montoMin}
                onChange={(e) => setMontoMin(e.target.value)}
                className="h-9 bg-background font-mono text-sm tabular-nums"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="hist-mmax" className="text-xs font-medium text-tinta-2">
                {tg("montoMax")}
              </Label>
              <Input
                id="hist-mmax"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={montoMax}
                onChange={(e) => setMontoMax(e.target.value)}
                className="h-9 bg-background font-mono text-sm tabular-nums"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="hist-cierre" className="text-xs font-medium text-tinta-2">
                {tg("cierreFiltro")}
              </Label>
              <select
                id="hist-cierre"
                value={cierreId}
                onChange={(e) => setCierreId(e.target.value)}
                className={cn(SELECT, "h-9 bg-background px-2.5 text-sm")}
              >
                <option value="">{tg("todosCierres")}</option>
                {cierres.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.numero} · {c.fecha}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Dos tablas paralelas: Ingresos (izquierda) y Egresos (derecha) */}
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 overflow-y-auto pt-1 lg:grid-cols-2">
            {/* Tabla Ingresos */}
            <div className="flex flex-col overflow-hidden rounded-card border border-linea bg-card">
              <div className="border-b border-linea bg-muted/30 px-4 py-2.5">
                <h3 className="text-sm font-semibold text-tinta">{tg("ingresos")}</h3>
              </div>
              <div className="flex-1 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-linea bg-muted/20 text-xs uppercase tracking-wider text-tinta-2">
                    <tr>
                      <th className="w-28 px-4 py-2.5 font-medium">{tg("colFecha")}</th>
                      <th className="px-4 py-2.5 font-medium">{tg("colConcepto")}</th>
                      <th className="w-36 px-4 py-2.5 text-right font-medium">{tg("colMonto")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-linea">
                    {ingresosFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-xs text-tinta-3">
                          {tg("sinIngresosHistorial")}
                        </td>
                      </tr>
                    ) : (
                      ingresosFiltrados.map((m) => (
                        <tr key={m.id} className="hover:bg-muted/30">
                          <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-tinta-2">
                            {m.fecha}
                          </td>
                          <td className="px-4 py-2.5 text-tinta">
                            <span className="block font-medium">{m.concepto}</span>
                            {m.cierreNumero && (
                              <span className="text-[11px] text-tinta-3">
                                {tg("cierreEtiqueta", { numero: String(m.cierreNumero) })}
                              </span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono font-medium tabular-nums text-status-success-fg">
                            {formatearMonto(Number(m.monto).toFixed(2), moneda)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot className="border-t-2 border-linea bg-muted/30">
                    <tr>
                      <td colSpan={2} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-tinta-2">
                        {tg("total")}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono text-sm font-semibold tabular-nums text-tinta">
                        {formatearMonto(totalIngresos.toFixed(2), moneda)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Tabla Egresos */}
            <div className="flex flex-col overflow-hidden rounded-card border border-linea bg-card">
              <div className="border-b border-linea bg-muted/30 px-4 py-2.5">
                <h3 className="text-sm font-semibold text-tinta">{tg("egresos")}</h3>
              </div>
              <div className="flex-1 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-linea bg-muted/20 text-xs uppercase tracking-wider text-tinta-2">
                    <tr>
                      <th className="w-28 px-4 py-2.5 font-medium">{tg("colFecha")}</th>
                      <th className="px-4 py-2.5 font-medium">{tg("colConcepto")}</th>
                      <th className="w-36 px-4 py-2.5 text-right font-medium">{tg("colMonto")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-linea">
                    {egresosFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-xs text-tinta-3">
                          {tg("sinEgresosHistorial")}
                        </td>
                      </tr>
                    ) : (
                      egresosFiltrados.map((m) => (
                        <tr key={m.id} className="hover:bg-muted/30">
                          <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-tinta-2">
                            {m.fecha}
                          </td>
                          <td className="px-4 py-2.5 text-tinta">
                            <span className="block font-medium">{m.concepto}</span>
                            {m.cierreNumero && (
                              <span className="text-[11px] text-tinta-3">
                                {tg("cierreEtiqueta", { numero: String(m.cierreNumero) })}
                              </span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono font-medium tabular-nums text-status-danger-fg">
                            {formatearMonto(Number(m.monto).toFixed(2), moneda)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot className="border-t-2 border-linea bg-muted/30">
                    <tr>
                      <td colSpan={2} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-tinta-2">
                        {tg("total")}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono text-sm font-semibold tabular-nums text-tinta">
                        {formatearMonto(totalEgresos.toFixed(2), moneda)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
