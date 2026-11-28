"use client";

import { useMemo, useState } from "react";
import { Banknote, Loader2, Save, Settings, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { BotonAsiento } from "@/components/contabilidad/asiento/boton-asiento";
import { AvisoError, AvisoOk, SELECT } from "@/components/contabilidad/comun";
import type { CuentaBancoCaja } from "@/components/contabilidad/cajas/formulario-caja";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/i18n/navigation";
import { denominacionesDe, redondear, totalContado } from "@/lib/contabilidad/cajas";
import { formatearMonto, MONEDAS } from "@/lib/contabilidad/formato";
import { cn } from "@/lib/utils";
import {
  actualizarCajaAction,
  eliminarCajaAction,
  guardarDesgloseCajaAction,
} from "@/server/contabilidad/cajas/acciones";
import { asientoPreviaAjusteFondo } from "@/server/contabilidad/cajas/acciones-asiento";
import type { CajaResumen } from "@/server/contabilidad/cajas/consultas";
import type { UsuarioSolicitante } from "@/server/contabilidad/proveedores/consultas";

/**
 * Botón de tuerca para configurar una caja (exclusivo del supervisor).
 * Permite editar Número, Responsable, Supervisor, Moneda, Banco y Fondo — nunca
 * el Tipo de caja; en su lugar muestra el botón «Desglose» para registrar
 * monedas y billetes de RD y habilitar «Movimientos de caja».
 */
export function DialogoConfigurarCaja({
  caja,
  usuarios,
  cuentasBancarias = [],
  esSupervisor,
}: {
  caja: CajaResumen;
  usuarios: UsuarioSolicitante[];
  cuentasBancarias?: CuentaBancoCaja[];
  esSupervisor: boolean;
}) {
  const t = useTranslations("contab.cajas");
  const router = useRouter();
  const esCajaGeneral = caja.tipo === "caja";
  const [abierto, setAbierto] = useState(false);
  const [abiertoDesglose, setAbiertoDesglose] = useState(false);
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [guardandoDesglose, setGuardandoDesglose] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDesglose, setErrorDesglose] = useState<string | null>(null);
  const [desgloseOk, setDesgloseOk] = useState(false);

  const [numero, setNumero] = useState(caja.codigo);
  const [responsableId, setResponsableId] = useState(caja.responsableId);
  const [supervisorId, setSupervisorId] = useState(caja.supervisorId ?? usuarios[0]?.id ?? "");
  const [moneda, setMoneda] = useState<"DOP" | "USD">(caja.moneda);
  const [fondo, setFondo] = useState(String(Number(caja.fondoFijo)));
  const [cuentaBancariaId, setCuentaBancariaId] = useState(caja.cuentaBancariaId ?? "");

  const bancosMismaMoneda = useMemo(
    () => cuentasBancarias.filter((b) => b.moneda === moneda),
    [cuentasBancarias, moneda],
  );
  const bancoSeleccionado = bancosMismaMoneda.some((b) => b.id === cuentaBancariaId)
    ? cuentaBancariaId
    : (bancosMismaMoneda[0]?.id ?? "");

  const denominaciones = useMemo(() => denominacionesDe(moneda), [moneda]);
  const [cantidades, setCantidades] = useState<Record<number, number>>(() => {
    const mapa: Record<number, number> = {};
    for (const d of caja.desglose) {
      mapa[d.denominacion] = d.cantidad;
    }
    return mapa;
  });

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
  const totalDesgloseActualCaja = useMemo(
    () =>
      redondear(
        totalContado(
          caja.desglose.map((d) => ({ denominacion: d.denominacion, cantidad: d.cantidad })),
        ),
      ),
    [caja.desglose],
  );
  const saldoActualNum = redondear(Number(caja.saldoActual) || 0);
  const puedeEliminar = Math.abs(saldoActualNum) < 0.005 && Math.abs(totalDesgloseActualCaja) < 0.005;
  const fondoObjetivo = esCajaGeneral
    ? totalDesglose
    : redondear(Number(fondo) || Number(caja.fondoFijo));
  const cambioFondo = !esCajaGeneral && Math.abs(fondoObjetivo - Number(caja.fondoFijo)) > 0.005;
  const diferencia = esCajaGeneral ? 0 : redondear(totalDesglose - fondoObjetivo);

  const controlAlineado = "h-9 px-3 py-0 text-sm";
  const selectAlineado = cn(SELECT, "h-9 px-3 text-sm");

  function previaAjuste() {
    return asientoPreviaAjusteFondo({
      cajaId: caja.id,
      cuentaBancariaId: bancoSeleccionado,
      fondoNuevo: fondoObjetivo,
    });
  }

  async function onGuardarConfig(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError(null);

    const montoFondo = esCajaGeneral ? saldoActualNum : parseFloat(fondo);
    if (!numero.trim() || (!esCajaGeneral && (Number.isNaN(montoFondo) || montoFondo <= 0))) {
      setError(t("errores.datos_invalidos"));
      setGuardando(false);
      return;
    }

    try {
      const res = await actualizarCajaAction({
        cajaId: caja.id,
        numero,
        responsableId,
        supervisorId,
        moneda,
        fondo: montoFondo,
        cuentaBancariaId: esCajaGeneral ? null : (bancoSeleccionado || null),
      });
      if (res.exito) {
        setAbierto(false);
      } else {
        setError(t(`errores.${res.error}`));
      }
    } catch {
      setError(t("errores.error"));
    } finally {
      setGuardando(false);
    }
  }

  async function onEliminarCaja() {
    setEliminando(true);
    setError(null);
    try {
      const res = await eliminarCajaAction(caja.id);
      if (res.exito) {
        setConfirmandoEliminar(false);
        setAbierto(false);
        router.push("/contabilidad/cajas");
        router.refresh();
      } else {
        setError(t(`errores.${res.error}`));
        setConfirmandoEliminar(false);
      }
    } catch {
      setError(t("errores.error"));
      setConfirmandoEliminar(false);
    } finally {
      setEliminando(false);
    }
  }

  async function onGuardarDesglose(e: React.FormEvent) {
    e.preventDefault();
    setGuardandoDesglose(true);
    setErrorDesglose(null);
    setDesgloseOk(false);

    if (!esCajaGeneral && Math.abs(totalDesglose - fondoObjetivo) > 0.005) {
      setErrorDesglose(t("errores.desglose_no_coincide"));
      setGuardandoDesglose(false);
      return;
    }

    try {
      const res = await guardarDesgloseCajaAction({
        cajaId: caja.id,
        fondo: fondoObjetivo,
        conteos: conteos.map((c) => ({
          denominacion: c.denominacion,
          cantidad: c.cantidad,
        })),
      });
      if (res.exito) {
        setDesgloseOk(true);
        setAbiertoDesglose(false);
      } else {
        setErrorDesglose(t(`errores.${res.error}`));
      }
    } catch {
      setErrorDesglose(t("errores.error"));
    } finally {
      setGuardandoDesglose(false);
    }
  }

  return (
    <>
      <Dialog open={abierto} onOpenChange={(v) => { if (esSupervisor) setAbierto(v); }}>
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="secondary"
            size="icon-sm"
            disabled={!esSupervisor}
            title={esSupervisor ? t("configurarCaja") : t("soloSupervisorTooltip")}
            aria-label={t("configurarCaja")}
          >
            <Settings className="size-3.5" />
          </Button>
        </DialogTrigger>

        <DialogContent className="md:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{t("configurarCajaTitulo", { numero: caja.codigo })}</DialogTitle>
          </DialogHeader>

          <form onSubmit={onGuardarConfig} className="space-y-5 pt-2 text-sm">
            <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-3">
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor={`cfg-num-${caja.id}`} className="block text-xs font-medium leading-none text-tinta-2">
                  {t("numero")}
                  <span aria-hidden className="ml-0.5 text-status-danger-fg">*</span>
                </Label>
                <Input
                  id={`cfg-num-${caja.id}`}
                  required
                  maxLength={30}
                  className={cn(controlAlineado, "font-mono uppercase")}
                  value={numero}
                  onChange={(e) => setNumero(e.target.value.toUpperCase())}
                />
              </div>

              <div className="min-w-0 space-y-1.5">
                <Label htmlFor={`cfg-resp-${caja.id}`} className="block text-xs font-medium leading-none text-tinta-2">
                  {t("responsable")}
                  <span aria-hidden className="ml-0.5 text-status-danger-fg">*</span>
                </Label>
                <select
                  id={`cfg-resp-${caja.id}`}
                  className={selectAlineado}
                  value={responsableId}
                  onChange={(e) => setResponsableId(e.target.value)}
                  required
                >
                  {usuarios.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-0 space-y-1.5">
                <Label htmlFor={`cfg-sup-${caja.id}`} className="block text-xs font-medium leading-none text-tinta-2">
                  {t("supervisor")}
                  <span aria-hidden className="ml-0.5 text-status-danger-fg">*</span>
                </Label>
                <select
                  id={`cfg-sup-${caja.id}`}
                  className={selectAlineado}
                  value={supervisorId}
                  onChange={(e) => setSupervisorId(e.target.value)}
                  required
                >
                  {usuarios.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-0 space-y-1.5">
                <span className="block text-xs font-medium leading-none text-tinta-2">
                  {t("desglose")}
                </span>
                <Button size="md"
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const mapa: Record<number, number> = {};
                    for (const d of caja.desglose) {
                      mapa[Number(d.denominacion)] = Math.max(0, Math.trunc(Number(d.cantidad) || 0));
                    }
                    setCantidades(mapa);
                    setErrorDesglose(null);
                    setAbiertoDesglose(true);
                  }}
                  className="w-full justify-between px-3 text-sm"
                >
                  <span className="inline-flex items-center gap-1.5 truncate">
                    <Banknote className="size-4 shrink-0 text-marca-600" />
                    {t("desglose")}
                  </span>
                  <span className="font-mono text-xs text-tinta-2">
                    {caja.desgloseConfigurado || desgloseOk
                      ? formatearMonto(totalDesglose.toFixed(2), moneda)
                      : t("desglosePendiente")}
                  </span>
                </Button>
              </div>

              <div className="min-w-0 space-y-1.5">
                <Label htmlFor={`cfg-mon-${caja.id}`} className="block text-xs font-medium leading-none text-tinta-2">
                  {t("moneda")}
                  <span aria-hidden className="ml-0.5 text-status-danger-fg">*</span>
                </Label>
                <select
                  id={`cfg-mon-${caja.id}`}
                  className={selectAlineado}
                  value={moneda}
                  onChange={(e) => setMoneda(e.target.value as "DOP" | "USD")}
                  required
                >
                  {MONEDAS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              {!esCajaGeneral && (
                <div className="min-w-0 space-y-1.5">
                  <Label htmlFor={`cfg-fondo-${caja.id}`} className="block text-xs font-medium leading-none text-tinta-2">
                    {t("fondo")}
                    <span aria-hidden className="ml-0.5 text-status-danger-fg">*</span>
                  </Label>
                  <Input
                    id={`cfg-fondo-${caja.id}`}
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    className={cn(controlAlineado, "tabular-nums")}
                    value={fondo}
                    onChange={(e) => setFondo(e.target.value)}
                  />
                </div>
              )}

              {!esCajaGeneral && bancosMismaMoneda.length > 0 && (
                <div className="min-w-0 space-y-1.5 sm:col-span-3">
                  <Label htmlFor={`cfg-banco-${caja.id}`} className="block text-xs font-medium leading-none text-tinta-2">
                    {t("bancoOrigen")}
                  </Label>
                  <select
                    id={`cfg-banco-${caja.id}`}
                    className={selectAlineado}
                    value={bancoSeleccionado}
                    onChange={(e) => setCuentaBancariaId(e.target.value)}
                  >
                    {bancosMismaMoneda.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.nombre} ({b.moneda})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {desgloseOk && <AvisoOk>{t("desgloseGuardado")}</AvisoOk>}
            {error && <AvisoError>{error}</AvisoError>}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-linea pt-4">
              <div className="flex flex-wrap items-center gap-2">
                {cambioFondo && <BotonAsiento cargar={previaAjuste} size="default" />}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!puedeEliminar || eliminando}
                  title={puedeEliminar ? t("cajaGeneral.eliminarCaja") : t("cajaGeneral.eliminarSoloCero")}
                  onClick={() => setConfirmandoEliminar(true)}
                  className="text-status-danger-fg hover:bg-status-danger-bg/60 hover:text-status-danger-fg"
                >
                  <Trash2 className="size-4" />
                  {t("cajaGeneral.eliminarCaja")}
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" onClick={() => setAbierto(false)}>
                  {t("cancelar")}
                </Button>
                <Button type="submit" cargando={guardando}>
                  {guardando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  {t("guardarCambios")}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmación de eliminación de caja en 0.00 (solo Supervisor) */}
      <Dialog open={confirmandoEliminar} onOpenChange={(v) => !eliminando && setConfirmandoEliminar(v)}>
        <DialogContent className="md:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("cajaGeneral.confirmarEliminarTitulo")}</DialogTitle>
            <DialogDescription>
              {t("cajaGeneral.confirmarEliminarDesc", { nombre: caja.nombre })}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-3">
            <Button
              type="button"
              variant="ghost"
              disabled={eliminando}
              onClick={() => setConfirmandoEliminar(false)}
            >
              {t("cancelar")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={eliminando}
              cargando={eliminando}
              onClick={onEliminarCaja}
            >
              {eliminando ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              {t("cajaGeneral.eliminarCaja")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Ventana de Desglose de monedas y billetes de RD */}
      <Dialog open={abiertoDesglose} onOpenChange={setAbiertoDesglose}>
        <DialogContent className="md:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("desgloseTitulo")}</DialogTitle>
          </DialogHeader>

          <form onSubmit={onGuardarDesglose} className="space-y-4 pt-2 text-sm">
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
                            value={`${d.tipo === "billete" ? t("billete") : t("monedaUnidad")} · ${formatearMonto(d.valor.toFixed(2), moneda)}`}
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
                            value={formatearMonto(sub.toFixed(2), moneda)}
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
              {!esCajaGeneral && (
                <div>
                  <span className="texto-meta block">{t("fondo")}</span>
                  <span className="font-mono font-semibold text-tinta">
                    {formatearMonto(fondoObjetivo.toFixed(2), moneda)}
                  </span>
                </div>
              )}
              <div>
                <span className="texto-meta block">{t("totalDesglose")}</span>
                <span className="font-mono font-semibold text-marca-700">
                  {formatearMonto(totalDesglose.toFixed(2), moneda)}
                </span>
              </div>
              {!esCajaGeneral && (
                <div>
                  <span className="texto-meta block">{t("diferencia")}</span>
                  <span
                    className={cn(
                      "font-mono font-semibold",
                      Math.abs(diferencia) < 0.005 ? "text-tinta-2" : "text-status-danger-fg",
                    )}
                  >
                    {formatearMonto(diferencia.toFixed(2), moneda)}
                  </span>
                </div>
              )}
            </div>

            {errorDesglose && <AvisoError>{errorDesglose}</AvisoError>}

            <div className="flex justify-end gap-2 border-t border-linea pt-4">
              <Button type="button" variant="ghost" onClick={() => setAbiertoDesglose(false)}>
                {t("cancelar")}
              </Button>
              <Button
                type="submit"
                disabled={!esCajaGeneral && Math.abs(diferencia) > 0.005}
                cargando={guardandoDesglose}
              >
                {guardandoDesglose ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {t("guardarDesglose")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
