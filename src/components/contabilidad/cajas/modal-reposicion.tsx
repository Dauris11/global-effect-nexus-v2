"use client";

import { useState } from "react";
import { ArrowDownRight, Loader2, Save } from "lucide-react";
import { useTranslations } from "next-intl";

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
import { SELECT } from "@/components/contabilidad/comun";
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
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filtrar cuentas que coincidan con la moneda de la caja
  const cuentasCompatibles = cuentasBanco.filter((c) => c.moneda === caja.moneda);

  const [cuentaBancoId, setCuentaBancoId] = useState(cuentasCompatibles[0]?.id ?? "");
  const [fecha, setFecha] = useState(hoy);

  // Monto sugerido para reponer = fondo_fijo - saldo_actual
  const gastado = Math.max(0, parseFloat(caja.fondoFijo) - parseFloat(caja.saldoActual));
  const [monto, setMonto] = useState(gastado > 0 ? gastado.toFixed(2) : "");
  const [concepto, setConcepto] = useState(`Reposición de fondo fijo - ${caja.nombre}`);

  async function onReponer(e: React.FormEvent) {
    e.preventDefault();
    const m = parseFloat(monto);
    if (isNaN(m) || m <= 0) {
      setError("El monto a reponer debe ser mayor a cero.");
      return;
    }

    if (!cuentaBancoId) {
      setError("Debes seleccionar una cuenta bancaria de salida.");
      return;
    }

    setGuardando(true);
    setError(null);

    try {
      const res = await reponerCajaDesdeBancoAction({
        cajaId: caja.id,
        cuentaBancoId,
        monto: m,
        fecha,
        concepto,
      });

      if (res.exito) {
        setAbierto(false);
      } else {
        setError(res.error);
      }
    } catch (err: unknown) {
      setError((err as Error).message || "Error al procesar la reposición.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ArrowDownRight className="size-4 text-marca-600" />
          <span>{t("reponer")}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("reponerTitulo")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={onReponer} className="space-y-4 pt-2 text-sm">
          <div className="rounded-control bg-marca-50/60 p-3 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-tinta-2">Fondo fijo asignado:</span>
              <span className="font-semibold text-tinta">
                {formatearMonto(caja.fondoFijo, caja.moneda)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-tinta-2">Saldo disponible actual:</span>
              <span className="font-semibold text-marca-700">
                {formatearMonto(caja.saldoActual, caja.moneda)}
              </span>
            </div>
            <div className="flex justify-between pt-1 border-t border-marca-200">
              <span className="text-tinta font-medium">Monto necesario para completar:</span>
              <span className="font-bold text-tinta">
                {formatearMonto(gastado.toFixed(2), caja.moneda)}
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="cuentaBanco">{t("cuentaBanco")}</Label>
            <select
              id="cuentaBanco"
              className={SELECT}
              value={cuentaBancoId}
              onChange={(e) => setCuentaBancoId(e.target.value)}
              required
            >
              {cuentasCompatibles.length === 0 ? (
                <option value="">No hay cuentas bancarias en {caja.moneda}</option>
              ) : (
                cuentasCompatibles.map((cb) => (
                  <option key={cb.id} value={cb.id}>
                    {cb.bancoNombre} ({cb.numeroCuenta}) · Saldo: {formatearMonto(cb.saldoActual, cb.moneda)}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="montoReponer">Monto a desembolsar</Label>
              <Input
                id="montoReponer"
                type="number"
                step="0.01"
                required
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="fechaReponer">Fecha de transferencia</Label>
              <Input
                id="fechaReponer"
                type="date"
                required
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="conceptoReponer">{t("concepto")}</Label>
            <Input
              id="conceptoReponer"
              required
              maxLength={200}
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
            />
          </div>

          {error && (
            <div className="rounded-control bg-semaforo-alerta/15 p-2.5 text-xs text-semaforo-alerta">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={guardando || cuentasCompatibles.length === 0}>
              {guardando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              <span>Desembolsar y reponer</span>
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
