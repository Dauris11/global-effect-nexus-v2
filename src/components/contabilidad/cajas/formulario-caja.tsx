"use client";

import { useMemo, useState } from "react";
import { Loader2, Plus, Save } from "lucide-react";
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
import { MONEDAS } from "@/lib/contabilidad/formato";
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
 * Formulario horizontal (4 columnas × 2 filas alineadas) para crear una caja
 * o caja chica con número único, responsable, supervisor, tipo, moneda, fondo,
 * cuenta contable, banco de origen (misma moneda) y vista previa del asiento.
 */
export function FormularioCaja({
  responsables,
  cuentasContables,
  cuentasBancarias,
}: {
  responsables: UsuarioSolicitante[];
  cuentasContables: CuentaAuxiliar[];
  cuentasBancarias: CuentaBancoCaja[];
}) {
  const t = useTranslations("contab.cajas");
  const [abierto, setAbierto] = useState(false);
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

    const montoFondo = parseFloat(fondo);
    if (
      !numero.trim() ||
      Number.isNaN(montoFondo) ||
      montoFondo <= 0 ||
      !cuentaContableId ||
      !bancoSeleccionado
    ) {
      setError(t("errores.datos_invalidos"));
      setGuardando(false);
      return;
    }

    try {
      const res = await crearCajaAction({
        numero,
        responsableId,
        supervisorId,
        tipo,
        moneda,
        fondo: montoFondo,
        cuentaContableId,
        cuentaBancariaId: bancoSeleccionado,
      });

      if (res.exito) {
        setAbierto(false);
        setNumero("");
        setFondo("");
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
                onChange={(e) => setSupervisorId(e.target.value)}
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

            <div className="min-w-0 space-y-1.5">
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
          </div>

          {error && <AvisoError>{error}</AvisoError>}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-linea pt-4">
            <BotonAsiento cargar={previaAsiento} size="default" />
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" onClick={() => setAbierto(false)}>
                {t("cancelar")}
              </Button>
              <Button type="submit" disabled={bancosMismaMoneda.length === 0} cargando={guardando}>
                {guardando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                <span>{t("crearCaja")}</span>
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
