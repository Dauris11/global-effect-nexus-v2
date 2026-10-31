"use client";

import { useState } from "react";
import { ArrowDownRight, Loader2, Save } from "lucide-react";
import { useTranslations } from "next-intl";

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
import { formatearMonto } from "@/lib/contabilidad/formato";
import { reponerCajaDesdeBancoAction } from "@/server/contabilidad/cajas/acciones";
import type { CajaResumen } from "@/server/contabilidad/cajas/consultas";

export type CuentaBancoOpcion = {
  id: string;
  bancoNombre: string;
  numeroCuenta: string;
  moneda: "DOP" | "USD";
  saldoActual: string;
};

/**
 * Reposición del fondo fijo. Propone lo que falta para volver al fondo
 * (fondo − efectivo), que en una caja sin vales abiertos es exactamente lo
 * gastado con comprobante.
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
  const falta = Math.max(0, Number(caja.fondoFijo) - Number(caja.saldoActual));

  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cuentaBancoId, setCuentaBancoId] = useState(compatibles[0]?.id ?? "");
  const [fecha, setFecha] = useState(hoy);
  const [monto, setMonto] = useState(falta > 0 ? falta.toFixed(2) : "");
  const [concepto, setConcepto] = useState(t("conceptoReposicion", { caja: caja.nombre }));

  async function reponer(evento: React.FormEvent) {
    evento.preventDefault();
    setGuardando(true);
    setError(null);
    const res = await reponerCajaDesdeBancoAction({
      cajaId: caja.id,
      cuentaBancoId,
      monto: Number(monto),
      fecha,
      concepto,
    });
    setGuardando(false);
    if (res.exito) setAbierto(false);
    else setError(t(`errores.${res.error}`));
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={caja.estado !== "activa" || falta <= 0}>
          <ArrowDownRight className="size-4" />
          {t("reponer")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("reponerTitulo")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={reponer} className="space-y-4">
          <dl className="space-y-1 rounded-control bg-muted/60 p-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-tinta-2">{t("fondoFijo")}</dt>
              <dd className="font-medium text-tinta">{formatearMonto(caja.fondoFijo, caja.moneda)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-tinta-2">{t("efectivo")}</dt>
              <dd className="font-medium text-tinta">{formatearMonto(caja.saldoActual, caja.moneda)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-tinta-2">{t("valesPendientes")}</dt>
              <dd className="font-medium text-tinta">{formatearMonto(caja.valesPendientes, caja.moneda)}</dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-linea pt-1">
              <dt className="font-medium text-tinta">{t("porReponer")}</dt>
              <dd className="font-semibold text-tinta">
                {formatearMonto(caja.pendienteReposicion, caja.moneda)}
              </dd>
            </div>
          </dl>

          <div className="space-y-1.5">
            <Label htmlFor="rep-cuenta">{t("cuentaBanco")}</Label>
            <select
              id="rep-cuenta"
              className={SELECT}
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

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rep-monto">{t("montoReponer")}</Label>
              <Input
                id="rep-monto"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                max={falta.toFixed(2)}
                required
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rep-fecha">{t("fecha")}</Label>
              <Input id="rep-fecha" type="date" required value={fecha} max={hoy} onChange={(e) => setFecha(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rep-concepto">{t("concepto")}</Label>
            <Input
              id="rep-concepto"
              required
              minLength={3}
              maxLength={200}
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
            />
          </div>

          {error && <AvisoError>{error}</AvisoError>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setAbierto(false)}>
              {t("cancelar")}
            </Button>
            <Button type="submit" disabled={guardando || compatibles.length === 0}>
              {guardando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {t("reponerBoton")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
