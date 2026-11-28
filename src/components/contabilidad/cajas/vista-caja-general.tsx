"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  RotateCcw,
  Save,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { useToast } from "@/components/app/toaster";
import { DialogoConfigurarCaja } from "@/components/contabilidad/cajas/dialogo-configurar-caja";
import { ModalCuadreCierre } from "@/components/contabilidad/cajas/modal-cuadre-cierre";
import { ModalDesgloseEfectivo } from "@/components/contabilidad/cajas/modal-desglose-efectivo";
import { ModalHistorialCajaGeneral } from "@/components/contabilidad/cajas/modal-historial-caja-general";
import { AvisoError, SELECT } from "@/components/contabilidad/comun";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useRouter } from "@/i18n/navigation";
import { redondear, type ConteoDenominacion } from "@/lib/contabilidad/cajas";
import { formatearMonto } from "@/lib/contabilidad/formato";
import { cn } from "@/lib/utils";
import {
  registrarEgresoCajaGeneralAction,
  registrarIngresoCajaGeneralAction,
} from "@/server/contabilidad/cajas/acciones";
import type {
  CajaResumen,
  CategoriaGastoCaja,
  CierreCajaGeneral,
  MovimientoCajaGeneral,
} from "@/server/contabilidad/cajas/consultas";
import type { UsuarioSolicitante } from "@/server/contabilidad/proveedores/consultas";

/**
 * Vista principal dentro de una Caja General («Movimientos de caja», Etapa #1):
 *   · 4 botones superiores: Ingreso, Egreso, Cuadre y cierre (solo Supervisor), Historial.
 *   · Filtros reactivos por rango de fecha y monto (sin botón «Filtrar»).
 *   · Dos tablas paralelas lado a lado: Ingresos (izquierda) y Egresos (derecha),
 *     con columnas Fecha, Concepto, Monto y fila de Total al final.
 */
export function VistaCajaGeneral({
  caja,
  ingresos,
  egresos,
  historialIngresos,
  historialEgresos,
  cierres,
  cuentasIngreso,
  cuentasEgreso,
  personas,
  hoy,
  puedeRegistrar,
  esSupervisor,
  usuarioActualNombre,
}: {
  caja: CajaResumen;
  ingresos: readonly MovimientoCajaGeneral[];
  egresos: readonly MovimientoCajaGeneral[];
  historialIngresos: readonly MovimientoCajaGeneral[];
  historialEgresos: readonly MovimientoCajaGeneral[];
  cierres: readonly CierreCajaGeneral[];
  cuentasIngreso: readonly CategoriaGastoCaja[];
  cuentasEgreso: readonly CategoriaGastoCaja[];
  personas: UsuarioSolicitante[];
  hoy: string;
  puedeRegistrar: boolean;
  esSupervisor: boolean;
  usuarioActualNombre: string;
}) {
  const t = useTranslations("contab.cajas");
  const tg = useTranslations("contab.cajas.cajaGeneral");
  const router = useRouter();
  const avisar = useToast();

  // Filtros reactivos (se aplican automáticamente onChange sin botón Filtrar)
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [montoMin, setMontoMin] = useState("");
  const [montoMax, setMontoMax] = useState("");
  const hayFiltros = Boolean(fechaDesde || fechaHasta || montoMin || montoMax);

  const filtrarLista = (lista: readonly MovimientoCajaGeneral[]) => {
    const min = montoMin.trim() !== "" ? Number(montoMin) : null;
    const max = montoMax.trim() !== "" ? Number(montoMax) : null;
    return lista.filter((m) => {
      if (fechaDesde && m.fecha < fechaDesde) return false;
      if (fechaHasta && m.fecha > fechaHasta) return false;
      const val = Number(m.monto) || 0;
      if (min !== null && Number.isFinite(min) && val < min) return false;
      if (max !== null && Number.isFinite(max) && val > max) return false;
      return true;
    });
  };

  const ingresosVisibles = useMemo(
    () => filtrarLista(ingresos),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ingresos, fechaDesde, fechaHasta, montoMin, montoMax],
  );
  const egresosVisibles = useMemo(
    () => filtrarLista(egresos),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [egresos, fechaDesde, fechaHasta, montoMin, montoMax],
  );

  const totalIngresos = useMemo(
    () => redondear(ingresosVisibles.reduce((acc, m) => acc + (Number(m.monto) || 0), 0)),
    [ingresosVisibles],
  );
  const totalEgresos = useMemo(
    () => redondear(egresosVisibles.reduce((acc, m) => acc + (Number(m.monto) || 0), 0)),
    [egresosVisibles],
  );

  // Estado del modal de Ingreso / Egreso + Modal de Desglose de Efectivo
  const [modalTipo, setModalTipo] = useState<"ingreso" | "egreso" | null>(null);
  const [cuentaId, setCuentaId] = useState("");
  const [concepto, setConcepto] = useState("");
  const [montoTexto, setMontoTexto] = useState("");
  const [errorForm, setErrorForm] = useState<string | null>(null);

  const [desgloseAbierto, setDesgloseAbierto] = useState(false);
  const [cantidades, setCantidades] = useState<Record<number, number>>({});
  const [guardando, setGuardando] = useState(false);
  const [errorDesglose, setErrorDesglose] = useState<string | null>(null);

  const saldoDisponible = redondear(Number(caja.saldoActual) || 0);
  const montoNumerico = redondear(Number(montoTexto) || 0);
  const cuentasDisponibles = modalTipo === "ingreso" ? cuentasIngreso : cuentasEgreso;

  function abrirModalMovimiento(tipo: "ingreso" | "egreso") {
    setModalTipo(tipo);
    setCuentaId("");
    setConcepto("");
    setMontoTexto("");
    setErrorForm(null);
    setCantidades({});
    setErrorDesglose(null);
  }

  function continuarADesglose(e: React.FormEvent) {
    e.preventDefault();
    setErrorForm(null);

    if (!cuentaId) {
      setErrorForm(t("errores.cuenta_no_permitida"));
      return;
    }
    if (concepto.trim().length < 2) {
      setErrorForm(t("errores.datos_invalidos"));
      return;
    }
    if (!(montoNumerico > 0)) {
      setErrorForm(t("errores.datos_invalidos"));
      return;
    }
    if (modalTipo === "egreso" && montoNumerico > saldoDisponible + 0.005) {
      setErrorForm(t("errores.saldo_insuficiente"));
      return;
    }

    setCantidades({});
    setErrorDesglose(null);
    setDesgloseAbierto(true);
  }

  async function confirmarMovimientoConDesglose(conteos: ConteoDenominacion[]) {
    if (!modalTipo) return;
    setGuardando(true);
    setErrorDesglose(null);

    const desglosePayload = conteos.map((c) => ({
      denominacion: c.denominacion,
      cantidad: c.cantidad,
    }));

    try {
      const res =
        modalTipo === "ingreso"
          ? await registrarIngresoCajaGeneralAction({
              cajaId: caja.id,
              cuentaIngresoId: cuentaId,
              concepto: concepto.trim(),
              monto: montoNumerico,
              fecha: hoy,
              desglose: desglosePayload,
            })
          : await registrarEgresoCajaGeneralAction({
              cajaId: caja.id,
              cuentaEgresoId: cuentaId,
              concepto: concepto.trim(),
              monto: montoNumerico,
              fecha: hoy,
              desglose: desglosePayload,
            });

      if (res.exito) {
        setDesgloseAbierto(false);
        setModalTipo(null);
        avisar({
          titulo:
            modalTipo === "ingreso" ? tg("ingresoGuardado") : tg("egresoGuardado"),
        });
        router.refresh();
      } else {
        setErrorDesglose(t(`errores.${res.error}`));
      }
    } catch {
      setErrorDesglose(t("errores.error"));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-6 animate-entrada">
      {/* Encabezado y 4 botones superiores */}
      <div className="space-y-2.5">
        <Button asChild variant="ghost" size="sm" className="-ml-3 text-tinta-2">
          <Link href="/contabilidad/cajas">
            <ChevronLeft className="size-4" />
            {t("volverCajas")}
          </Link>
        </Button>

        <EncabezadoPagina
          className="md:items-center"
          antetitulo={`${t(`tiposCaja.${caja.tipo}`)} · ${caja.codigo}`}
          titulo={
            <span className="inline-flex items-center gap-2">
              <span>{caja.nombre}</span>
              <DialogoConfigurarCaja
                caja={caja}
                usuarios={personas}
                esSupervisor={esSupervisor}
              />
            </span>
          }
          acciones={
            <div className="flex flex-wrap items-center gap-2.5">
              {puedeRegistrar && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    className="whitespace-nowrap px-3.5"
                    onClick={() => abrirModalMovimiento("ingreso")}
                  >
                    <ArrowDownLeft className="size-4 text-status-success-fg" />
                    {tg("ingreso")}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    className="whitespace-nowrap px-3.5"
                    disabled={saldoDisponible <= 0}
                    onClick={() => abrirModalMovimiento("egreso")}
                  >
                    <ArrowUpRight className="size-4 text-status-danger-fg" />
                    {tg("egreso")}
                  </Button>
                </>
              )}

              {esSupervisor && (
                <ModalCuadreCierre
                  caja={caja}
                  hoy={hoy}
                  supervisorNombre={usuarioActualNombre}
                />
              )}

              <ModalHistorialCajaGeneral
                ingresos={historialIngresos}
                egresos={historialEgresos}
                cierres={cierres}
                moneda={caja.moneda}
              />
            </div>
          }
        />

        <p className="texto-meta pt-0.5">
          {t("responsableDe", {
            nombre: caja.responsableNombre,
            departamento: caja.departamento,
          })}
          {caja.cuentaContableCodigo &&
            ` · ${t("cuentaContable")}: ${caja.cuentaContableCodigo}`}
          {" · "}
          <span className="font-medium text-tinta">
            {tg("saldoActual")}:{" "}
            <span className="font-mono tabular-nums">
              {formatearMonto(saldoDisponible.toFixed(2), caja.moneda)}
            </span>
          </span>
        </p>
      </div>

      {/* Filtros reactivos en vivo (sin botón Filtrar) */}
      <div className="rounded-card border border-linea bg-card p-4 shadow-card">
        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]">
          <div className="space-y-1">
            <Label htmlFor="cg-desde" className="text-xs font-medium text-tinta-2">
              {tg("fechaDesde")}
            </Label>
            <Input
              id="cg-desde"
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cg-hasta" className="text-xs font-medium text-tinta-2">
              {tg("fechaHasta")}
            </Label>
            <Input
              id="cg-hasta"
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cg-mmin" className="text-xs font-medium text-tinta-2">
              {tg("montoMin")}
            </Label>
            <Input
              id="cg-mmin"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={montoMin}
              onChange={(e) => setMontoMin(e.target.value)}
              className="h-9 font-mono text-sm tabular-nums"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cg-mmax" className="text-xs font-medium text-tinta-2">
              {tg("montoMax")}
            </Label>
            <Input
              id="cg-mmax"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={montoMax}
              onChange={(e) => setMontoMax(e.target.value)}
              className="h-9 font-mono text-sm tabular-nums"
            />
          </div>
          {hayFiltros && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9"
              onClick={() => {
                setFechaDesde("");
                setFechaHasta("");
                setMontoMin("");
                setMontoMax("");
              }}
            >
              <RotateCcw className="size-3.5" />
              {t("limpiarFiltros")}
            </Button>
          )}
        </div>
      </div>

      {/* Tablas paralelas: Ingresos (izquierda) y Egresos (derecha) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Izquierda: Ingresos */}
        <section className="flex flex-col overflow-hidden rounded-card border border-linea bg-card shadow-card">
          <div className="flex items-center justify-between border-b border-linea bg-muted/30 px-4 py-3">
            <h2 className="text-sm font-semibold text-tinta">{tg("ingresos")}</h2>
            <span className="font-mono text-xs text-tinta-2 tabular-nums">
              {ingresosVisibles.length}
            </span>
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
                {ingresosVisibles.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-10 text-center text-xs text-tinta-3">
                      {tg("sinIngresos")}
                    </td>
                  </tr>
                ) : (
                  ingresosVisibles.map((m) => (
                    <tr key={m.id} className="transition-colors hover:bg-muted/30">
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-tinta-2">
                        {m.fecha}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-tinta">{m.concepto}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono font-medium tabular-nums text-status-success-fg">
                        {formatearMonto(Number(m.monto).toFixed(2), caja.moneda)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="border-t-2 border-linea bg-muted/30">
                <tr>
                  <td
                    colSpan={2}
                    className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-tinta-2"
                  >
                    {tg("total")}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-sm font-semibold tabular-nums text-tinta">
                    {formatearMonto(totalIngresos.toFixed(2), caja.moneda)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        {/* Derecha: Egresos */}
        <section className="flex flex-col overflow-hidden rounded-card border border-linea bg-card shadow-card">
          <div className="flex items-center justify-between border-b border-linea bg-muted/30 px-4 py-3">
            <h2 className="text-sm font-semibold text-tinta">{tg("egresos")}</h2>
            <span className="font-mono text-xs text-tinta-2 tabular-nums">
              {egresosVisibles.length}
            </span>
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
                {egresosVisibles.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-10 text-center text-xs text-tinta-3">
                      {tg("sinEgresos")}
                    </td>
                  </tr>
                ) : (
                  egresosVisibles.map((m) => (
                    <tr key={m.id} className="transition-colors hover:bg-muted/30">
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-tinta-2">
                        {m.fecha}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-tinta">{m.concepto}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono font-medium tabular-nums text-status-danger-fg">
                        {formatearMonto(Number(m.monto).toFixed(2), caja.moneda)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="border-t-2 border-linea bg-muted/30">
                <tr>
                  <td
                    colSpan={2}
                    className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-tinta-2"
                  >
                    {tg("total")}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-sm font-semibold tabular-nums text-tinta">
                    {formatearMonto(totalEgresos.toFixed(2), caja.moneda)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      </div>

      {/* Modal de datos de Ingreso / Egreso */}
      <Dialog
        open={modalTipo !== null && !desgloseAbierto}
        onOpenChange={(open) => {
          if (!open && !guardando) setModalTipo(null);
        }}
      >
        <DialogContent className="md:max-w-lg">
          {modalTipo && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {modalTipo === "ingreso" ? tg("modalIngresoTitulo") : tg("modalEgresoTitulo")}
                </DialogTitle>
              </DialogHeader>

              <form onSubmit={continuarADesglose} className="space-y-4 pt-1 text-sm">
                <div className="space-y-1.5">
                  <Label htmlFor="cg-cuenta" className="text-xs font-medium text-tinta-2">
                    {modalTipo === "ingreso" ? tg("tipoIngreso") : tg("tipoEgreso")}
                    <span aria-hidden className="ml-0.5 text-status-danger-fg">*</span>
                  </Label>
                  <select
                    id="cg-cuenta"
                    required
                    value={cuentaId}
                    onChange={(e) => setCuentaId(e.target.value)}
                    className={cn(SELECT, "h-9 px-3 text-sm")}
                  >
                    <option value="">
                      {modalTipo === "ingreso"
                        ? tg("seleccionarTipoIngreso")
                        : tg("seleccionarTipoEgreso")}
                    </option>
                    {cuentasDisponibles.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.cuenta} · {c.nombre}
                      </option>
                    ))}
                  </select>
                  {cuentasDisponibles.length === 0 && (
                    <p className="texto-meta">
                      {modalTipo === "ingreso"
                        ? tg("sinCuentasIngreso")
                        : tg("sinCuentasEgreso")}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cg-concepto" className="text-xs font-medium text-tinta-2">
                    {tg("colConcepto")}
                    <span aria-hidden className="ml-0.5 text-status-danger-fg">*</span>
                  </Label>
                  <Input
                    id="cg-concepto"
                    required
                    minLength={2}
                    maxLength={200}
                    value={concepto}
                    onChange={(e) => setConcepto(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="cg-monto" className="text-xs font-medium text-tinta-2">
                      {tg("colMonto")} ({caja.moneda})
                      <span aria-hidden className="ml-0.5 text-status-danger-fg">*</span>
                    </Label>
                    {modalTipo === "egreso" && (
                      <span className="text-xs text-tinta-3 font-mono tabular-nums">
                        {t("disponible")}: {formatearMonto(saldoDisponible.toFixed(2), caja.moneda)}
                      </span>
                    )}
                  </div>
                  <Input
                    id="cg-monto"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0.01"
                    max={modalTipo === "egreso" ? saldoDisponible : undefined}
                    required
                    value={montoTexto}
                    onChange={(e) => setMontoTexto(e.target.value)}
                    className="h-9 font-mono text-sm tabular-nums"
                  />
                </div>

                {errorForm && <AvisoError>{errorForm}</AvisoError>}

                <div className="flex justify-end gap-2 border-t border-linea pt-4">
                  <Button type="button" variant="ghost" onClick={() => setModalTipo(null)}>
                    {t("cancelar")}
                  </Button>
                  <Button type="submit" disabled={cuentasDisponibles.length === 0}>
                    <Save className="size-4" />
                    {tg("guardar")}
                  </Button>
                </div>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Desglose de Efectivo para confirmar Ingreso o Egreso */}
      {modalTipo && (
        <ModalDesgloseEfectivo
          abierto={desgloseAbierto}
          onOpenChange={(open) => {
            if (!guardando) setDesgloseAbierto(open);
          }}
          titulo={
            modalTipo === "ingreso"
              ? tg("desgloseIngresoTitulo")
              : tg("desgloseEgresoTitulo")
          }
          etiquetaObjetivo={
            modalTipo === "ingreso" ? tg("montoIngreso") : tg("montoEgreso")
          }
          etiquetaConfirmar={
            modalTipo === "ingreso" ? tg("confirmarIngreso") : tg("confirmarEgreso")
          }
          moneda={caja.moneda}
          montoObjetivo={montoNumerico}
          modo={modalTipo}
          desgloseDisponible={modalTipo === "egreso" ? caja.desglose : undefined}
          cantidades={cantidades}
          onCambiarCantidad={(denom, cant) =>
            setCantidades((prev) => ({ ...prev, [denom]: cant }))
          }
          guardando={guardando}
          errorExterno={errorDesglose}
          onConfirmar={confirmarMovimientoConDesglose}
        />
      )}
    </div>
  );
}
