"use client";

import { useState } from "react";
import { CircleSlash, Loader2, Power, Save } from "lucide-react";
import { useTranslations } from "next-intl";

import { CodigosDeCuenta } from "@/components/contabilidad/configuracion/codigos-de-cuenta";
import { AvisoEstado, useAccionConfig } from "@/components/contabilidad/configuracion/aviso-estado";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TooltipAyuda } from "@/components/ui/tooltip-ayuda";
import {
  cambiarEstadoCuenta,
  crearCuentaRaiz,
  crearSubcuenta,
  editarCuenta,
} from "@/server/contabilidad/configuracion/acciones";
import { TIPOS_CUENTA, type TipoCuenta } from "@/lib/contabilidad/catalogo";
import type { CodigoConfigurado } from "@/server/contabilidad/codigos-transaccion/consultas";
import type { CuentaCatalogo } from "@/server/contabilidad/configuracion/consultas";

export type ModoCuenta = "subcuenta" | "editar" | "raiz" | "desactivar" | "activar";

const ACCION = {
  subcuenta: crearSubcuenta,
  editar: editarCuenta,
  raiz: crearCuentaRaiz,
  desactivar: cambiarEstadoCuenta,
  activar: cambiarEstadoCuenta,
} as const;

/**
 * Las operaciones del catálogo. Ninguna borra: desactivar deja la cuenta
 * con su historia y la base rechaza hacerlo si tiene saldo. Código, tipo y
 * "recibe asientos" solo se editan en cuentas sin movimientos; el servidor
 * lo vuelve a comprobar.
 */
export function DialogoCuenta({
  modo,
  cuenta,
  codigos,
  alCerrar,
}: {
  modo: ModoCuenta;
  /** `null` solo en `raiz`: una cuenta de primer nivel no cuelga de ninguna. */
  cuenta: CuentaCatalogo | null;
  codigos: CodigoConfigurado[];
  alCerrar: () => void;
}) {
  const t = useTranslations("contab.config.cuenta");
  const tt = useTranslations("contab.config.catalogo.tipo");
  const [estado, enviar, enviando] = useAccionConfig(ACCION[modo], alCerrar);
  const esRaiz = cuenta ? cuenta.padreId === null : true;
  // Prefijo fijo = código de la madre; el segmento es lo único que se escribe,
  // para que una hija no pueda quedar fuera de su rama.
  const prefijo = modo === "subcuenta" ? `${cuenta?.codigo}.` : modo === "editar" && cuenta?.padreId ? `${cuenta.codigo.split(".").slice(0, -1).join(".")}.` : "";
  const segmentoInicial = modo === "editar" && cuenta ? cuenta.codigo.slice(prefijo.length) : "";
  const [segmento, setSegmento] = useState(segmentoInicial);
  const [tipo, setTipo] = useState<TipoCuenta>(cuenta?.tipo ?? "activo");
  const [movimiento, setMovimiento] = useState(
    modo === "subcuenta" ? true : (cuenta?.admiteMovimiento ?? false),
  );
  const [agregarAFacturas, setAgregarAFacturas] = useState(
    modo === "editar" ? (cuenta?.agregarAFacturas ?? false) : false,
  );
  const etiqueta = cuenta ? `${cuenta.codigo} · ${cuenta.nombre}` : "";
  const maxSegmento = prefijo ? 4 : 2;
  const pideNombre = modo === "subcuenta" || modo === "editar" || modo === "raiz";
  const pideCodigo = pideNombre;

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && alCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(`${modo}.titulo`)}</DialogTitle>
          <DialogDescription>{t(`${modo}.descripcion`, { cuenta: etiqueta })}</DialogDescription>
        </DialogHeader>
        <form action={enviar} className="space-y-4">
          {modo === "subcuenta" && <input type="hidden" name="padre_id" value={cuenta?.id} />}
          {(modo === "editar" || modo === "desactivar" || modo === "activar") && (
            <input type="hidden" name="id" value={cuenta?.id} />
          )}
          {pideCodigo && <input type="hidden" name="codigo" value={`${prefijo}${segmento}`} />}

          {pideCodigo && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="cuenta-segmento" className="text-sm font-medium">
                  {t("codigo")}
                </Label>
                <TooltipAyuda
                  etiqueta={t("masInformacion")}
                  texto={[
                    prefijo ? t("codigoAyuda") : t("codigoAyudaRaiz"),
                    ...(modo === "editar" ? [t("editar.avisoBloqueo")] : []),
                  ]}
                />
              </div>
              <div className="flex items-center gap-2">
                {prefijo && <span className="font-mono text-sm text-tinta-2">{prefijo}</span>}
                <Input
                  id="cuenta-segmento"
                  value={segmento}
                  onChange={(e) => setSegmento(e.target.value.replace(/\D/g, "").slice(0, maxSegmento))}
                  inputMode="numeric"
                  required
                  pattern={`[0-9]{1,${maxSegmento}}`}
                  className="max-w-32 font-mono"
                />
              </div>
            </div>
          )}

          {pideNombre && (
            <div className="space-y-1.5">
              <Label htmlFor="cuenta-nombre" className="text-sm font-medium">
                {t("nombre")}
              </Label>
              <Input
                id="cuenta-nombre"
                name="nombre"
                required
                maxLength={160}
                defaultValue={modo === "editar" ? cuenta?.nombre : ""}
              />
            </div>
          )}

          {(modo === "raiz" || (modo === "editar" && esRaiz)) && (
            <div className="space-y-1.5">
              <Label htmlFor="cuenta-tipo" className="text-sm font-medium">
                {t("tipo")}
              </Label>
              <input type="hidden" name="tipo" value={tipo} />
              <Select value={tipo} onValueChange={(v) => setTipo(v as TipoCuenta)}>
                <SelectTrigger id="cuenta-tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_CUENTA.map((valor) => (
                    <SelectItem key={valor} value={valor}>
                      {tt(valor)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {modo === "editar" && (
            <div className="flex items-center gap-2.5 text-sm">
              <input type="hidden" name="movimiento" value={movimiento ? "1" : "0"} />
              <input
                id="cuenta-movimiento"
                type="checkbox"
                checked={movimiento}
                onChange={(e) => {
                  const activo = e.target.checked;
                  setMovimiento(activo);
                  if (!activo) setAgregarAFacturas(false);
                }}
                className="size-4 accent-marca-500"
              />
              <div className="flex items-center gap-1.5">
                <Label htmlFor="cuenta-movimiento" className="cursor-pointer text-sm font-medium text-tinta">
                  {t("recibeAsientos")}
                </Label>
                <TooltipAyuda etiqueta={t("masInformacion")} texto={t("recibeAsientosAyuda")} />
              </div>
            </div>
          )}

          {(modo === "subcuenta" || (modo === "editar" && movimiento)) && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="cuenta-agregar-facturas" className="text-sm font-medium">
                  {t("agregarAFacturas")}
                </Label>
                <TooltipAyuda etiqueta={t("masInformacion")} texto={t("agregarAFacturasAyuda")} />
              </div>
              <input type="hidden" name="agregar_a_facturas" value={agregarAFacturas ? "1" : "0"} />
              <Select
                value={agregarAFacturas ? "1" : "0"}
                onValueChange={(v) => setAgregarAFacturas(v === "1")}
              >
                <SelectTrigger id="cuenta-agregar-facturas" className="max-w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">{t("si")}</SelectItem>
                  <SelectItem value="0">{t("no")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {modo === "subcuenta" && cuenta?.admiteMovimiento && <p className="texto-meta">{t("subcuenta.aviso")}</p>}
          {(modo === "activar" || modo === "desactivar") && (
            <input type="hidden" name="activar" value={modo === "activar" ? "1" : "0"} />
          )}

          <AvisoEstado estado={estado} />
          {modo === "editar" && cuenta?.admiteMovimiento && cuenta.activa && (
            <CodigosDeCuenta cuentaId={cuenta.id} codigos={codigos} />
          )}
          <DialogFooter>
            <Button type="submit" variant={modo === "desactivar" ? "destructive" : "default"} cargando={enviando}>
              {enviando ? (
                <Loader2 className="size-4 animate-spin" />
              ) : modo === "desactivar" ? (
                <CircleSlash className="size-4" />
              ) : modo === "activar" ? (
                <Power className="size-4" />
              ) : (
                <Save className="size-4" />
              )}
              {t(`${modo}.confirmar`)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
