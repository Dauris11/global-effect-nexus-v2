"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Loader2, Receipt, Save } from "lucide-react";
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
import { denominacionesDe, redondear, totalContado } from "@/lib/contabilidad/cajas";
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
 *   2. Al pulsar «Dar salida», abre la ventana de desglose de efectivo utilizado,
 *      que debe cuadrar exactamente con el monto de la salida.
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

  const denominaciones = useMemo(() => denominacionesDe(caja.moneda), [caja.moneda]);
  const [cantidades, setCantidades] = useState<Record<number, number>>({});

  const montoNum = redondear(Number(monto) || 0);
  const disponibleRestante = redondear(Number(caja.saldoActual) - montoNum);
  const conteos = useMemo(
    () =>
      denominaciones.map((d) => ({
        denominacion: d.valor,
        tipo: d.tipo,
        cantidad: cantidades[d.valor] ?? 0,
      })),
    [denominaciones, cantidades],
  );
  const totalDesglose = redondear(totalContado(conteos));
  const diferencia = redondear(totalDesglose - montoNum);

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
    if (montoNum > Number(caja.saldoActual)) {
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

    setErrorDesglose(null);
    setAbiertoDesglose(true);
  }

  async function onConfirmarSalida(e: React.FormEvent) {
    e.preventDefault();
    if (Math.abs(diferencia) > 0.005) {
      setErrorDesglose(t("errores.desglose_no_coincide"));
      return;
    }

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
        conteos
          .filter((c) => c.cantidad > 0)
          .map((c) => ({ denominacion: c.denominacion, cantidad: c.cantidad })),
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
          }
        }}
      >
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className="h-9 whitespace-nowrap px-3.5"
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
                  max={caja.saldoActual}
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

      {/* Ventana 2: Desglose del efectivo utilizado (debe dar igual que el monto) */}
      <Dialog open={abiertoDesglose} onOpenChange={setAbiertoDesglose}>
        <DialogContent className="md:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("desgloseSalidaTitulo")}</DialogTitle>
          </DialogHeader>

          <form onSubmit={onConfirmarSalida} className="space-y-4 pt-2 text-sm">
            <div className="overflow-x-auto rounded-control border border-linea">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-linea bg-muted/40 text-xs text-tinta-2">
                  <tr>
                    <th className="px-3 py-2 font-medium">{t("colDenominacion")}</th>
                    <th className="w-32 px-3 py-2 text-right font-medium">{t("cantidad")}</th>
                    <th className="w-40 px-3 py-2 text-right font-medium">{t("monto")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-linea">
                  {denominaciones.map((d) => {
                    const cant = cantidades[d.valor] ?? 0;
                    const sub = redondear(d.valor * cant);
                    return (
                      <tr key={d.valor}>
                        <td className="px-3 py-1.5">
                          <Input
                            readOnly
                            tabIndex={-1}
                            value={`${d.tipo === "billete" ? t("billete") : t("monedaUnidad")} · ${formatearMonto(d.valor.toFixed(2), caja.moneda)}`}
                            className="h-8 bg-muted/40 font-mono text-xs text-tinta"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            step={1}
                            value={cant === 0 ? "" : String(cant)}
                            placeholder="0"
                            onChange={(e) => {
                              const n = Math.max(0, Math.trunc(Number(e.target.value) || 0));
                              setCantidades((prev) => ({ ...prev, [d.valor]: n }));
                            }}
                            className="h-8 text-right font-mono text-xs tabular-nums"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <Input
                            readOnly
                            tabIndex={-1}
                            value={formatearMonto(sub.toFixed(2), caja.moneda)}
                            className="h-8 bg-muted/40 text-right font-mono text-xs tabular-nums text-tinta"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 rounded-control border border-linea bg-superficie/60 px-4 py-3 text-sm">
              <div>
                <span className="texto-meta block">{t("monto")}</span>
                <span className="font-mono font-semibold text-tinta">
                  {formatearMonto(montoNum.toFixed(2), caja.moneda)}
                </span>
              </div>
              <div>
                <span className="texto-meta block">{t("totalDesglose")}</span>
                <span className="font-mono font-semibold text-marca-700">
                  {formatearMonto(totalDesglose.toFixed(2), caja.moneda)}
                </span>
              </div>
              <div>
                <span className="texto-meta block">{t("diferencia")}</span>
                <span
                  className={cn(
                    "font-mono font-semibold",
                    Math.abs(diferencia) < 0.005 ? "text-tinta-2" : "text-status-danger-fg",
                  )}
                >
                  {formatearMonto(diferencia.toFixed(2), caja.moneda)}
                </span>
              </div>
            </div>

            {errorDesglose && <AvisoError>{errorDesglose}</AvisoError>}

            <div className="flex justify-end gap-2 border-t border-linea pt-4">
              <Button type="button" variant="ghost" onClick={() => setAbiertoDesglose(false)}>
                {t("cancelar")}
              </Button>
              <Button
                type="submit"
                disabled={Math.abs(diferencia) > 0.005}
                cargando={guardando}
              >
                {guardando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {t("confirmarSalida")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
