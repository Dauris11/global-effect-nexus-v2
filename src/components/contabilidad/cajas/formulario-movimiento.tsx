"use client";

import { useState } from "react";
import { Loader2, Plus, Receipt, Save, Upload } from "lucide-react";
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
import { registrarMovimientoCajaAction } from "@/server/contabilidad/cajas/acciones";
import type { CajaResumen } from "@/server/contabilidad/cajas/consultas";
import type { UsuarioSolicitante } from "@/server/contabilidad/proveedores/consultas";

export function FormularioMovimientoCaja({
  caja,
  personas,
  hoy,
}: {
  caja: CajaResumen;
  personas: UsuarioSolicitante[];
  hoy: string;
}) {
  const t = useTranslations("contab.cajas");
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fecha, setFecha] = useState(hoy);
  const [tipo, setTipo] = useState<"gasto" | "vale">("gasto");
  const [monto, setMonto] = useState("");
  const [concepto, setConcepto] = useState("");
  const [personaId, setPersonaId] = useState("");
  const [adjuntoNombre, setAdjuntoNombre] = useState<string | null>(null);

  const umbral = parseFloat(caja.umbralAdjunto);
  const montoNum = parseFloat(monto) || 0;
  const requiereAdjunto = tipo === "gasto" && montoNum >= umbral;

  async function onRegistrar(e: React.FormEvent) {
    e.preventDefault();
    if (montoNum <= 0) {
      setError("El monto debe ser mayor a cero.");
      return;
    }

    if (requiereAdjunto && !adjuntoNombre) {
      setError(
        `Para gastos de RD$${umbral.toFixed(2)} o superiores, es obligatorio anexar el comprobante de soporte.`,
      );
      return;
    }

    setGuardando(true);
    setError(null);

    try {
      const res = await registrarMovimientoCajaAction({
        cajaId: caja.id,
        fecha,
        tipo,
        monto: montoNum,
        concepto,
        personaId: personaId ? personaId : null,
        adjuntoRuta: adjuntoNombre ? `cajas/${caja.id}/${adjuntoNombre}` : null,
      });

      if (res.exito) {
        setAbierto(false);
        setMonto("");
        setConcepto("");
        setAdjuntoNombre(null);
      } else {
        setError(res.error);
      }
    } catch (err: unknown) {
      setError((err as Error).message || "Error al registrar movimiento.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Receipt className="size-4" />
          <span>{t("nuevoMovimiento")}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("nuevoMovimiento")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={onRegistrar} className="space-y-4 pt-2 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="fecha">Fecha</Label>
              <Input
                id="fecha"
                type="date"
                required
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tipo">{t("tipo")}</Label>
              <select
                id="tipo"
                className={SELECT}
                value={tipo}
                onChange={(e) => setTipo(e.target.value as "gasto" | "vale")}
              >
                <option value="gasto">Gasto con comprobante</option>
                <option value="vale">Vale provisional de caja</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="monto">
              {t("monto")} ({caja.moneda})
            </Label>
            <Input
              id="monto"
              type="number"
              step="0.01"
              required
              placeholder="0.00"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="concepto">{t("concepto")}</Label>
            <Input
              id="concepto"
              required
              maxLength={200}
              placeholder="Ej. Compra de materiales de limpieza para taller"
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="persona">{t("persona")}</Label>
            <select
              id="persona"
              className={SELECT}
              value={personaId}
              onChange={(e) => setPersonaId(e.target.value)}
            >
              <option value="">Selecciona quien recibe o rinde...</option>
              {personas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} ({p.rol})
                </option>
              ))}
            </select>
          </div>

          {/* Adjunto de comprobante */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="adjunto">{t("adjunto")}</Label>
              {requiereAdjunto && (
                <span className="text-[11px] font-semibold text-semaforo-alerta">
                  * Obligatorio (&ge; {caja.moneda} ${umbral.toFixed(2)})
                </span>
              )}
            </div>
            <label className="flex flex-col items-center justify-center rounded-control border border-dashed border-linea p-3 text-xs text-tinta-2 hover:bg-superficie/50 cursor-pointer">
              <Upload className="size-4 mb-1 text-marca-600" />
              <span>{adjuntoNombre ? adjuntoNombre : "Subir foto de recibo o factura física"}</span>
              <input
                id="adjunto"
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  setAdjuntoNombre(f ? f.name : null);
                }}
              />
            </label>
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
            <Button type="submit" disabled={guardando}>
              {guardando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              <span>Registrar movimiento</span>
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
