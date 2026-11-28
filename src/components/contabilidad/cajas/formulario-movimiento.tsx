"use client";

import { useState } from "react";
import { ArrowRight, Receipt } from "lucide-react";
import { useTranslations } from "next-intl";

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
import { registrarMovimientoCajaAction } from "@/server/contabilidad/cajas/acciones";
import type { CajaResumen, CategoriaGastoCaja } from "@/server/contabilidad/cajas/consultas";

/**
 * Registrar salida de caja chica:
 *   1. Formulario con check «Factura con comprobante» (desmarcado por defecto),
 *      campo Comprobante (en modo lectura con el próximo B11 disponible, o editable
 *      si se marca el check), Monto, A quien fue entregado, Fecha, Concepto y
 *      Categoría de gasto opcional.
 *   2. Al pulsar «Dar salida», abre el modal de desglose en modo egreso validando
 *      estrictamente que ninguna denominación supere el efectivo disponible en caja
 *      y que el total coincida exactamente con el monto.
 */
export function FormularioMovimientoCaja({
  caja,
  categorias,
  hoy,
  proximoComprobanteB11,
}: {
  caja: CajaResumen;
  categorias: CategoriaGastoCaja[];
  hoy: string;
  proximoComprobanteB11: string | null;
}) {
  const t = useTranslations("contab.cajas");
  const [abierto, setAbierto] = useState(false);
  const [abiertoDesglose, setAbiertoDesglose] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDesglose, setErrorDesglose] = useState<string | null>(null);

  const [facturaConComprobante, setFacturaConComprobante] = useState(false);
  const [comprobanteManual, setComprobanteManual] = useState("");
  const [fecha, setFecha] = useState(hoy);
  const [monto, setMonto] = useState("");
  const [entregadoA, setEntregadoA] = useState("");
  const [concepto, setConcepto] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [cantidades, setCantidades] = useState<Record<number, number>>({});

  const montoNum = redondear(Number(monto) || 0);
  const saldoActualNum = redondear(Number(caja.saldoActual) || 0);
  const disponibleRestante = redondear(saldoActualNum - montoNum);

  const controlAlineado = "h-9 px-3 py-0 text-sm";
  const selectAlineado = cn(SELECT, "h-9 px-3 text-sm");

  function reiniciarFormulario() {
    setFacturaConComprobante(false);
    setComprobanteManual("");
    setFecha(hoy);
    setMonto("");
    setEntregadoA("");
    setConcepto("");
    setCategoriaId("");
    setCantidades({});
    setError(null);
    setErrorDesglose(null);
  }

  function onAbrirDesglose(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!(montoNum > 0)) {
      setError(t("errores.datos_invalidos"));
      return;
    }
    if (montoNum > saldoActualNum) {
      setError(t("errores.saldo_insuficiente"));
      return;
    }
    if (entregadoA.trim().length < 2) {
      setError(t("errores.entregado_requerido"));
      return;
    }
    if (concepto.trim().length < 2) {
      setError(t("errores.datos_invalidos"));
      return;
    }
    if (facturaConComprobante && !comprobanteManual.trim()) {
      setError(t("errores.comprobante_requerido"));
      return;
    }
    if (!facturaConComprobante && !proximoComprobanteB11) {
      setError(t("errores.sin_comprobante_vigente"));
      return;
    }

    setCantidades({});
    setErrorDesglose(null);
    setAbiertoDesglose(true);
  }

  async function onConfirmarSalida(conteos: ConteoDenominacion[]) {
    setGuardando(true);
    setErrorDesglose(null);

    const datos = new FormData();
    datos.set("cajaId", caja.id);
    datos.set("fecha", fecha);
    datos.set("monto", montoNum.toFixed(2));
    datos.set("concepto", concepto.trim());
    datos.set("entregadoA", entregadoA.trim());
    datos.set("facturaConComprobante", facturaConComprobante ? "1" : "0");
    datos.set("comprobante", facturaConComprobante ? comprobanteManual.trim().toUpperCase() : "");
    if (categoriaId) datos.set("categoriaId", categoriaId);
    datos.set(
      "desglose",
      JSON.stringify(
        conteos.map((c) => ({ denominacion: c.denominacion, cantidad: c.cantidad })),
      ),
    );

    try {
      const res = await registrarMovimientoCajaAction(datos);
      if (res.exito) {
        reiniciarFormulario();
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
            setFacturaConComprobante(false);
            setError(null);
            setErrorDesglose(null);
            setCantidades({});
          } else {
            setAbiertoDesglose(false);
            setCantidades({});
          }
        }}
      >
        <DialogTrigger asChild>
          <Button size="md"
            variant="outline"
            className="whitespace-nowrap px-3.5"
            disabled={caja.estado !== "activa"}
          >
            <Receipt className="size-4" />
            {t("registrarSalida")}
          </Button>
        </DialogTrigger>

        <DialogContent className="md:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("registrarSalida")}</DialogTitle>
          </DialogHeader>

          <form onSubmit={onAbrirDesglose} className="space-y-4 pt-2 text-sm">
            {/* Check Factura con comprobante (siempre desmarcado al abrir) */}
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-control border border-linea px-3 py-2 text-sm font-medium text-tinta">
              <input
                type="checkbox"
                checked={facturaConComprobante}
                onChange={(e) => {
                  setFacturaConComprobante(e.target.checked);
                  if (!e.target.checked) setComprobanteManual("");
                }}
                className="size-4 accent-marca-500"
              />
              <span>{t("facturaConComprobante")}</span>
            </label>

            <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-3">
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="sal-comp" className="block text-xs font-medium leading-none text-tinta-2">
                  {t("comprobante")}
                  <span aria-hidden className="ml-0.5 text-status-danger-fg">*</span>
                </Label>
                <Input
                  id="sal-comp"
                  readOnly={!facturaConComprobante}
                  required={facturaConComprobante}
                  maxLength={20}
                  value={
                    facturaConComprobante
                      ? comprobanteManual
                      : (proximoComprobanteB11 ?? t("sinComprobanteDisponible"))
                  }
                  onChange={(e) => setComprobanteManual(e.target.value.toUpperCase())}
                  className={cn(
                    controlAlineado,
                    "font-mono uppercase",
                    !facturaConComprobante && "bg-muted/40 text-tinta-2",
                  )}
                />
              </div>

              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="sal-monto" className="block text-xs font-medium leading-none text-tinta-2">
                  {t("monto")} ({caja.moneda})
                  <span aria-hidden className="ml-0.5 text-status-danger-fg">*</span>
                </Label>
                <Input
                  id="sal-monto"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0.01"
                  max={saldoActualNum}
                  required
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  className={cn(controlAlineado, "tabular-nums")}
                />
              </div>

              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="sal-fecha" className="block text-xs font-medium leading-none text-tinta-2">
                  {t("fecha")}
                  <span aria-hidden className="ml-0.5 text-status-danger-fg">*</span>
                </Label>
                <Input
                  id="sal-fecha"
                  type="date"
                  required
                  max={hoy}
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className={controlAlineado}
                />
              </div>

              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="sal-entregado" className="block text-xs font-medium leading-none text-tinta-2">
                  {t("entregadoA")}
                  <span aria-hidden className="ml-0.5 text-status-danger-fg">*</span>
                </Label>
                <Input
                  id="sal-entregado"
                  required
                  minLength={2}
                  maxLength={160}
                  value={entregadoA}
                  onChange={(e) => setEntregadoA(e.target.value)}
                  className={controlAlineado}
                />
              </div>

              <div className="min-w-0 space-y-1.5 sm:col-span-2">
                <Label htmlFor="sal-concepto" className="block text-xs font-medium leading-none text-tinta-2">
                  {t("concepto")}
                  <span aria-hidden className="ml-0.5 text-status-danger-fg">*</span>
                </Label>
                <Input
                  id="sal-concepto"
                  required
                  minLength={2}
                  maxLength={200}
                  value={concepto}
                  onChange={(e) => setConcepto(e.target.value)}
                  className={controlAlineado}
                />
              </div>

              <div className="min-w-0 space-y-1.5 sm:col-span-3">
                <Label htmlFor="sal-cat" className="block text-xs font-medium leading-none text-tinta-2">
                  {t("categoria")}
                </Label>
                <select
                  id="sal-cat"
                  className={selectAlineado}
                  value={categoriaId}
                  onChange={(e) => setCategoriaId(e.target.value)}
                >
                  <option value="">{t("elegirCategoria")}</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
                {categorias.length === 0 && (
                  <p className="texto-meta">{t("sinCategoriasCajaChica")}</p>
                )}
              </div>
            </div>

            <p
              className={cn(
                "text-sm tabular-nums",
                disponibleRestante < 0 ? "font-semibold text-status-danger-fg" : "text-tinta-2",
              )}
            >
              {t("disponible")}: {formatearMonto(disponibleRestante.toFixed(2), caja.moneda)}
            </p>

            {error && <AvisoError>{error}</AvisoError>}

            <div className="flex justify-end gap-2 border-t border-linea pt-4">
              <Button type="button" variant="ghost" onClick={() => setAbierto(false)}>
                {t("cancelar")}
              </Button>
              <Button type="submit">
                {t("darSalida")}
                <ArrowRight className="size-4" />
              </Button>
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
        titulo={t("desgloseSalidaTitulo")}
        etiquetaObjetivo={t("monto")}
        etiquetaConfirmar={t("confirmarSalida")}
        moneda={caja.moneda}
        montoObjetivo={montoNum}
        modo="egreso"
        desgloseDisponible={caja.desglose}
        cantidades={cantidades}
        onCambiarCantidad={(denom, cant) =>
          setCantidades((prev) => ({ ...prev, [denom]: cant }))
        }
        guardando={guardando}
        errorExterno={errorDesglose}
        onConfirmar={onConfirmarSalida}
      />
    </>
  );
}
