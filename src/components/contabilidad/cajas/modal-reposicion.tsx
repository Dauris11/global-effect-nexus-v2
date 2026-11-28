"use client";

import { useState } from "react";
import { ArrowDownRight, ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { BotonAsiento } from "@/components/contabilidad/asiento/boton-asiento";
import { ModalDesgloseEfectivo } from "@/components/contabilidad/cajas/modal-desglose-efectivo";
import { AvisoError, SELECT } from "@/components/contabilidad/comun";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { redondear, type ConteoDenominacion } from "@/lib/contabilidad/cajas";
import { formatearMonto } from "@/lib/contabilidad/formato";
import { cn } from "@/lib/utils";
import { reponerCajaDesdeBancoAction } from "@/server/contabilidad/cajas/acciones";
import { asientoPreviaReposicion } from "@/server/contabilidad/cajas/acciones-asiento";
import type { CajaResumen } from "@/server/contabilidad/cajas/consultas";

export type CuentaBancoOpcion = {
  id: string;
  bancoNombre: string;
  numeroCuenta: string;
  moneda: "DOP" | "USD";
  saldoActual: string;
};

/**
 * Reposición de caja chica en dos pasos:
 *   1. Resumen superior (Fondo, Efectivo en caja, Faltante y Por reponer = Fondo − Efectivo en caja),
 *      Banco, Monto a reponer (en lectura), Fecha, Concepto y vista previa del Asiento.
 *   2. Al pulsar «Reponer», abre el modal de desglose de efectivo para ingresar los billetes
 *      y monedas recibidos; al confirmar, registra el ingreso y suma las denominaciones a la caja.
 */
export function ModalReposicionCaja({
  caja,
  cuentasBanco,
  hoy,
}: {
  caja: CajaResumen;
  cuentasBanco: CuentaBancoOpcion[];
  hoy: string;
}) {
  const t = useTranslations("contab.cajas");
  const compatibles = cuentasBanco.filter((c) => c.moneda === caja.moneda);
  const fondo = redondear(Number(caja.fondoFijo) || 0);
  const efectivoEnCaja = redondear(Number(caja.saldoActual) || 0);
  const porReponer = Math.max(0, redondear(fondo - efectivoEnCaja));
  const gastosPendientes = redondear(Number(caja.pendienteReposicion) || 0);
  const faltante = Math.max(0, redondear(porReponer - gastosPendientes));

  const bancoInicial =
    compatibles.find((c) => c.id === caja.cuentaBancariaId)?.id ?? compatibles[0]?.id ?? "";

  const [abierto, setAbierto] = useState(false);
  const [abiertoDesglose, setAbiertoDesglose] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDesglose, setErrorDesglose] = useState<string | null>(null);
  const [cuentaBancoId, setCuentaBancoId] = useState(bancoInicial);
  const [fecha, setFecha] = useState(hoy);
  const [concepto, setConcepto] = useState(t("conceptoReposicion", { caja: caja.nombre }));
  const [cantidades, setCantidades] = useState<Record<number, number>>({});

  const controlAlineado = "h-9 px-3 py-0 text-sm";
  const selectAlineado = cn(SELECT, "h-9 px-3 text-sm");

  function abrirDesgloseReposicion(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);

    if (!cuentaBancoId || !(porReponer > 0) || !fecha || concepto.trim().length < 3) {
      setError(t("errores.datos_invalidos"));
      return;
    }

    setCantidades({});
    setErrorDesglose(null);
    setAbiertoDesglose(true);
  }

  async function confirmarReposicion(conteos: ConteoDenominacion[]) {
    setGuardando(true);
    setErrorDesglose(null);
    try {
      const res = await reponerCajaDesdeBancoAction({
        cajaId: caja.id,
        cuentaBancoId,
        monto: porReponer,
        fecha,
        concepto,
        desglose: conteos.map((c) => ({
          denominacion: c.denominacion,
          cantidad: c.cantidad,
        })),
      });
      if (res.exito) {
        setCantidades({});
        setAbiertoDesglose(false);
        setAbierto(false);
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
    <>
      <Dialog
        open={abierto}
        onOpenChange={(v) => {
          setAbierto(v);
          if (v) {
            setError(null);
            setErrorDesglose(null);
            setCantidades({});
            if (!compatibles.some((c) => c.id === cuentaBancoId)) {
              setCuentaBancoId(bancoInicial);
            }
          } else {
            setAbiertoDesglose(false);
            setCantidades({});
          }
        }}
      >
        <DialogTrigger asChild>
          <Button size="md"
            variant="outline"
            className="whitespace-nowrap px-3.5 disabled:cursor-not-allowed disabled:opacity-45"
            disabled={caja.estado !== "activa" || porReponer <= 0}
            title={porReponer <= 0 ? t("sinMontoPorReponer") : undefined}
          >
            <ArrowDownRight className="size-4" />
            {t("reponer")}
          </Button>
        </DialogTrigger>
        <DialogContent className="md:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("reponerTitulo")}</DialogTitle>
          </DialogHeader>

          <form onSubmit={abrirDesgloseReposicion} className="space-y-4 pt-2 text-sm">
            <dl className="space-y-1.5 rounded-control border border-linea bg-muted/40 p-3.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-tinta-2">{t("fondo")}</dt>
                <dd className="font-mono font-medium tabular-nums text-tinta">
                  {formatearMonto(fondo.toFixed(2), caja.moneda)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-tinta-2">{t("efectivoEnCaja")}</dt>
                <dd className="font-mono font-medium tabular-nums text-tinta">
                  {formatearMonto(efectivoEnCaja.toFixed(2), caja.moneda)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-tinta-2">{t("faltante")}</dt>
                <dd
                  className={cn(
                    "font-mono font-medium tabular-nums",
                    faltante > 0 ? "text-status-danger-fg" : "text-tinta",
                  )}
                >
                  {formatearMonto(faltante.toFixed(2), caja.moneda)}
                </dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-linea pt-2">
                <dt className="font-semibold text-tinta">{t("porReponerTitulo")}</dt>
                <dd className="font-mono font-semibold tabular-nums text-marca-700">
                  {formatearMonto(porReponer.toFixed(2), caja.moneda)}
                </dd>
              </div>
            </dl>

            <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2">
              <div className="min-w-0 space-y-1.5 sm:col-span-2">
                <Label htmlFor="rep-cuenta" className="block text-xs font-medium leading-none text-tinta-2">
                  {t("bancoOrigen")}
                  <span aria-hidden className="ml-0.5 text-status-danger-fg">*</span>
                </Label>
                <select
                  id="rep-cuenta"
                  className={selectAlineado}
                  value={cuentaBancoId}
                  onChange={(e) => setCuentaBancoId(e.target.value)}
                  required
                >
                  {compatibles.length === 0 ? (
                    <option value="">{t("sinCuentas", { moneda: caja.moneda })}</option>
                  ) : (
                    compatibles.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.bancoNombre} · {c.numeroCuenta} · {formatearMonto(c.saldoActual, c.moneda)}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="rep-monto" className="block text-xs font-medium leading-none text-tinta-2">
                  {t("montoReponer")}
                </Label>
                <Input
                  id="rep-monto"
                  readOnly
                  tabIndex={-1}
                  value={formatearMonto(porReponer.toFixed(2), caja.moneda)}
                  className={cn(controlAlineado, "bg-muted/40 font-mono tabular-nums text-tinta-2")}
                />
              </div>

              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="rep-fecha" className="block text-xs font-medium leading-none text-tinta-2">
                  {t("fecha")}
                  <span aria-hidden className="ml-0.5 text-status-danger-fg">*</span>
                </Label>
                <Input
                  id="rep-fecha"
                  type="date"
                  required
                  value={fecha}
                  max={hoy}
                  onChange={(e) => setFecha(e.target.value)}
                  className={controlAlineado}
                />
              </div>

              <div className="min-w-0 space-y-1.5 sm:col-span-2">
                <Label htmlFor="rep-concepto" className="block text-xs font-medium leading-none text-tinta-2">
                  {t("concepto")}
                  <span aria-hidden className="ml-0.5 text-status-danger-fg">*</span>
                </Label>
                <Input
                  id="rep-concepto"
                  required
                  minLength={3}
                  maxLength={200}
                  value={concepto}
                  onChange={(e) => setConcepto(e.target.value)}
                  className={controlAlineado}
                />
              </div>
            </div>

            {error && <AvisoError>{error}</AvisoError>}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-linea pt-4">
              <BotonAsiento
                size="default"
                cargar={() =>
                  asientoPreviaReposicion({
                    cajaId: caja.id,
                    cuentaBancoId,
                    monto: porReponer,
                    concepto,
                    fecha,
                  })
                }
              />
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" onClick={() => setAbierto(false)}>
                  {t("cancelar")}
                </Button>
                <Button type="submit" disabled={guardando || compatibles.length === 0}>
                  {t("reponerBoton")}
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ModalDesgloseEfectivo
        abierto={abiertoDesglose}
        onOpenChange={(v) => {
          setAbiertoDesglose(v);
          if (!v) setErrorDesglose(null);
        }}
        titulo={t("desgloseReposicionTitulo")}
        etiquetaObjetivo={t("montoReponer")}
        etiquetaConfirmar={t("confirmarReposicion")}
        moneda={caja.moneda}
        montoObjetivo={porReponer}
        modo="ingreso"
        cantidades={cantidades}
        onCambiarCantidad={(denom, cant) =>
          setCantidades((prev) => ({ ...prev, [denom]: cant }))
        }
        guardando={guardando}
        errorExterno={errorDesglose}
        onConfirmar={confirmarReposicion}
      />
    </>
  );
}
