"use client";

import { useMemo, useState } from "react";
import { Banknote, Loader2, Plus, Save } from "lucide-react";
import { useTranslations } from "next-intl";

import { BotonAsiento } from "@/components/contabilidad/asiento/boton-asiento";
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
import { formatearMonto, MONEDAS } from "@/lib/contabilidad/formato";
import { cn } from "@/lib/utils";
import type { CuentaAuxiliar } from "@/server/contabilidad/bancos/consultas";
import { crearCajaAction } from "@/server/contabilidad/cajas/acciones";
import { asientoPreviaCrearCaja } from "@/server/contabilidad/cajas/acciones-asiento";
import type { UsuarioSolicitante } from "@/server/contabilidad/proveedores/consultas";

export type CuentaBancoCaja = {
  id: string;
  nombre: string;
  banco: string;
  numero: string;
  moneda: "DOP" | "USD";
};

/**
 * Formulario para crear una Caja Chica o una Caja General.
 *
 * - Para `caja_chica`: conserva el flujo completo con Fondo, Banco de origen y vista previa del asiento.
 * - Para `caja` (Caja General): oculta el campo Banco y Fondo fijo; únicamente el Supervisor asignado
 *   puede cargar el desglose inicial de efectivo al crearla (si la crea otro rol o sin desglose, inicia en 0.00).
 */
export function FormularioCaja({
  responsables,
  cuentasContables,
  cuentasBancarias,
  usuarioActualId,
}: {
  responsables: UsuarioSolicitante[];
  cuentasContables: CuentaAuxiliar[];
  cuentasBancarias: CuentaBancoCaja[];
  usuarioActualId?: string;
}) {
  const t = useTranslations("contab.cajas");
  const [abierto, setAbierto] = useState(false);
  const [abiertoDesglose, setAbiertoDesglose] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cuentaPorDefecto = (tipoCaja: "caja_chica" | "caja") => {
    const cod = tipoCaja === "caja_chica" ? "1.1.1.2" : "1.1.1.1";
    return cuentasContables.find((c) => c.codigo === cod)?.id ?? cuentasContables[0]?.id ?? "";
  };

  const [numero, setNumero] = useState("");
  const [responsableId, setResponsableId] = useState(responsables[0]?.id ?? "");
  const [supervisorId, setSupervisorId] = useState(
    responsables[1]?.id ?? responsables[0]?.id ?? "",
  );
  const [tipo, setTipo] = useState<"caja_chica" | "caja">("caja_chica");
  const [moneda, setMoneda] = useState<"DOP" | "USD">("DOP");
  const [fondo, setFondo] = useState("");
  const [cuentaContableId, setCuentaContableId] = useState(() => cuentaPorDefecto("caja_chica"));
  const [cuentaBancariaId, setCuentaBancariaId] = useState(
    () => cuentasBancarias.find((b) => b.moneda === "DOP")?.id ?? "",
  );

  // Desglose inicial (exclusivo para Caja General cuando el creador es el Supervisor asignado)
  const [cantidadesIniciales, setCantidadesIniciales] = useState<Record<number, number>>({});
  const [desgloseConfirmado, setDesgloseConfirmado] = useState(false);

  const esCajaGeneral = tipo === "caja";
  const esSupervisorAsignado = Boolean(usuarioActualId && supervisorId === usuarioActualId);
  const denominaciones = useMemo(() => denominacionesDe(moneda), [moneda]);

  const totalDesgloseInicial = useMemo(
    () =>
      redondear(
        totalContado(
          denominaciones.map((d) => ({
            denominacion: d.valor,
            cantidad: Math.max(0, Math.trunc(Number(cantidadesIniciales[d.valor]) || 0)),
          })),
        ),
      ),
    [denominaciones, cantidadesIniciales],
  );

  const bancosMismaMoneda = useMemo(
    () => cuentasBancarias.filter((b) => b.moneda === moneda),
    [cuentasBancarias, moneda],
  );

  const bancoSeleccionado = bancosMismaMoneda.some((b) => b.id === cuentaBancariaId)
    ? cuentaBancariaId
    : (bancosMismaMoneda[0]?.id ?? "");

  const controlAlineado = "h-9 px-3 py-0 text-sm";
  const selectAlineado = cn(SELECT, "h-9 px-3 text-sm");

  function previaAsiento() {
    return asientoPreviaCrearCaja({
      cuentaContableId,
      cuentaBancariaId: bancoSeleccionado,
      moneda,
      fondo: parseFloat(fondo) || 0,
      numero,
      tipo,
    });
  }

  async function onCrearCaja(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError(null);

    if (!numero.trim() || !cuentaContableId) {
      setError(t("errores.datos_invalidos"));
      setGuardando(false);
      return;
    }

    if (!esCajaGeneral) {
      const montoFondo = parseFloat(fondo);
      if (Number.isNaN(montoFondo) || montoFondo <= 0 || !bancoSeleccionado) {
        setError(t("errores.datos_invalidos"));
        setGuardando(false);
        return;
      }
    }

    try {
      const conteos = esCajaGeneral && esSupervisorAsignado && desgloseConfirmado
        ? denominaciones
            .map((d) => ({
              denominacion: d.valor,
              cantidad: Math.max(0, Math.trunc(Number(cantidadesIniciales[d.valor]) || 0)),
            }))
            .filter((c) => c.cantidad > 0)
        : undefined;

      const res = await crearCajaAction({
        numero,
        responsableId,
        supervisorId,
        tipo,
        moneda,
        fondo: esCajaGeneral ? totalDesgloseInicial : parseFloat(fondo),
        cuentaContableId,
        cuentaBancariaId: esCajaGeneral ? null : bancoSeleccionado,
        desgloseInicial: conteos,
        confirmarDesgloseInicial: esCajaGeneral && esSupervisorAsignado && desgloseConfirmado,
      });

      if (res.exito) {
        setAbierto(false);
        setNumero("");
        setFondo("");
        setCantidadesIniciales({});
        setDesgloseConfirmado(false);
      } else {
        setError(t(`errores.${res.error}`));
      }
    } catch {
      setError(t("errores.error"));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogTrigger asChild>
          <Button size="sm">
            <Plus className="size-4" />
            <span>{t("nuevaCaja")}</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="md:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{t("crearCaja")}</DialogTitle>
          </DialogHeader>

          <form onSubmit={onCrearCaja} className="space-y-5 pt-2 text-sm">
            <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="numero" className="block text-xs font-medium leading-none text-tinta-2">
                  {t("numero")}
                  <span aria-hidden className="ml-0.5 text-status-danger-fg">*</span>
                </Label>
                <Input
                  id="numero"
                  required
                  maxLength={30}
                  className={cn(controlAlineado, "font-mono uppercase")}
                  value={numero}
                  onChange={(e) => setNumero(e.target.value.toUpperCase())}
                />
              </div>

              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="responsable" className="block text-xs font-medium leading-none text-tinta-2">
                  {t("responsable")}
                  <span aria-hidden className="ml-0.5 text-status-danger-fg">*</span>
                </Label>
                <select
                  id="responsable"
                  className={selectAlineado}
                  value={responsableId}
                  onChange={(e) => setResponsableId(e.target.value)}
                  required
                >
                  {responsables.length === 0 && (
                    <option value="">{t("seleccionarUsuario")}</option>
                  )}
                  {responsables.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="supervisor" className="block text-xs font-medium leading-none text-tinta-2">
                  {t("supervisor")}
                  <span aria-hidden className="ml-0.5 text-status-danger-fg">*</span>
                </Label>
                <select
                  id="supervisor"
                  className={selectAlineado}
                  value={supervisorId}
                  onChange={(e) => {
                    setSupervisorId(e.target.value);
                    setDesgloseConfirmado(false);
                    setCantidadesIniciales({});
                  }}
                  required
                >
                  {responsables.length === 0 && (
                    <option value="">{t("seleccionarUsuario")}</option>
                  )}
                  {responsables.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="tipoCaja" className="block text-xs font-medium leading-none text-tinta-2">
                  {t("tipoCaja")}
                  <span aria-hidden className="ml-0.5 text-status-danger-fg">*</span>
                </Label>
                <select
                  id="tipoCaja"
                  className={selectAlineado}
                  value={tipo}
                  onChange={(e) => {
                    const nuevoTipo = e.target.value as "caja_chica" | "caja";
                    setTipo(nuevoTipo);
                    setCuentaContableId(cuentaPorDefecto(nuevoTipo));
                    setError(null);
                  }}
                  required
                >
                  <option value="caja_chica">{t("tiposCaja.caja_chica")}</option>
                  <option value="caja">{t("tiposCaja.caja")}</option>
                </select>
              </div>

              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="moneda" className="block text-xs font-medium leading-none text-tinta-2">
                  {t("moneda")}
                  <span aria-hidden className="ml-0.5 text-status-danger-fg">*</span>
                </Label>
                <select
                  id="moneda"
                  className={selectAlineado}
                  value={moneda}
                  onChange={(e) => {
                    const nuevaMoneda = e.target.value as "DOP" | "USD";
                    setMoneda(nuevaMoneda);
                    setCantidadesIniciales({});
                    setDesgloseConfirmado(false);
                    const primero = cuentasBancarias.find((b) => b.moneda === nuevaMoneda);
                    setCuentaBancariaId(primero?.id ?? "");
                  }}
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
                  <Label htmlFor="fondo" className="block text-xs font-medium leading-none text-tinta-2">
                    {t("fondo")}
                    <span aria-hidden className="ml-0.5 text-status-danger-fg">*</span>
                  </Label>
                  <Input
                    id="fondo"
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

              <div className={cn("min-w-0 space-y-1.5", esCajaGeneral && "sm:col-span-2")}>
                <Label htmlFor="cuentaContable" className="block text-xs font-medium leading-none text-tinta-2">
                  {t("cuentaContable")}
                  <span aria-hidden className="ml-0.5 text-status-danger-fg">*</span>
                </Label>
                <select
                  id="cuentaContable"
                  className={selectAlineado}
                  value={cuentaContableId}
                  onChange={(e) => setCuentaContableId(e.target.value)}
                  required
                >
                  {cuentasContables.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.codigo} · {c.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {!esCajaGeneral ? (
                <div className="min-w-0 space-y-1.5">
                  <Label htmlFor="bancoOrigen" className="block text-xs font-medium leading-none text-tinta-2">
                    {t("bancoOrigen")}
                    <span aria-hidden className="ml-0.5 text-status-danger-fg">*</span>
                  </Label>
                  <select
                    id="bancoOrigen"
                    className={selectAlineado}
                    value={bancoSeleccionado}
                    onChange={(e) => setCuentaBancariaId(e.target.value)}
                    required
                    disabled={bancosMismaMoneda.length === 0}
                  >
                    {bancosMismaMoneda.length === 0 && (
                      <option value="">{t("sinCuentas", { moneda })}</option>
                    )}
                    {bancosMismaMoneda.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.nombre} ({b.moneda})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="min-w-0 space-y-1.5">
                  <span className="block text-xs font-medium leading-none text-tinta-2">
                    {t("cajaGeneral.desgloseInicial")}
                  </span>
                  {esSupervisorAsignado ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="md"
                      className="h-9 w-full justify-between px-3 text-sm"
                      onClick={() => setAbiertoDesglose(true)}
                    >
                      <span className="inline-flex items-center gap-1.5 truncate">
                        <Banknote className="size-4 shrink-0 text-marca-600" />
                        {t("desglose")}
                      </span>
                      <span className="font-mono text-xs text-tinta-2">
                        {desgloseConfirmado
                          ? formatearMonto(totalDesgloseInicial.toFixed(2), moneda)
                          : formatearMonto("0.00", moneda)}
                      </span>
                    </Button>
                  ) : (
                    <Input
                      readOnly
                      tabIndex={-1}
                      value={formatearMonto("0.00", moneda)}
                      title={t("cajaGeneral.soloSupervisorDesgloseInicial")}
                      className={cn(controlAlineado, "bg-muted/40 font-mono text-tinta-3")}
                    />
                  )}
                </div>
              )}
            </div>

            {esCajaGeneral && !esSupervisorAsignado && (
              <p className="rounded-control border border-linea bg-muted/30 px-3.5 py-2.5 text-xs text-tinta-2">
                {t("cajaGeneral.soloSupervisorDesgloseInicial")}
              </p>
            )}

            {error && <AvisoError>{error}</AvisoError>}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-linea pt-4">
              <div>
                {!esCajaGeneral && <BotonAsiento cargar={previaAsiento} size="default" />}
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" onClick={() => setAbierto(false)}>
                  {t("cancelar")}
                </Button>
                <Button
                  type="submit"
                  disabled={!esCajaGeneral && bancosMismaMoneda.length === 0}
                  cargando={guardando}
                >
                  {guardando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  <span>{t("crearCaja")}</span>
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de desglose inicial para Caja General (solo Supervisor asignado) */}
      <Dialog open={abiertoDesglose} onOpenChange={setAbiertoDesglose}>
        <DialogContent className="md:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("cajaGeneral.desgloseInicialTitulo")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2 text-sm">
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
                    const cant = cantidadesIniciales[d.valor] ?? 0;
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
                              setCantidadesIniciales((prev) => ({ ...prev, [d.valor]: n }));
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

            <div className="flex items-center justify-between rounded-control border border-linea bg-superficie/60 px-4 py-3 text-sm">
              <span className="texto-meta">{t("totalDesglose")}</span>
              <span className="font-mono text-base font-semibold tabular-nums text-marca-700">
                {formatearMonto(totalDesgloseInicial.toFixed(2), moneda)}
              </span>
            </div>

            <div className="flex justify-end gap-2 border-t border-linea pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setAbiertoDesglose(false)}
              >
                {t("cancelar")}
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setDesgloseConfirmado(true);
                  setAbiertoDesglose(false);
                }}
              >
                <Save className="size-4" />
                {t("cajaGeneral.confirmarDesgloseInicial")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
