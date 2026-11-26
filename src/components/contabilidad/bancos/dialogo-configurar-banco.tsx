"use client";

import { useActionState, useState } from "react";
import { Check, Clock, Loader2, Save, Send, Settings, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { AvisoError, AvisoOk, Monto, SELECT } from "@/components/contabilidad/comun";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TooltipAyuda } from "@/components/ui/tooltip-ayuda";
import { MONEDAS } from "@/lib/contabilidad/formato";
import {
  actualizarCuentaBancaria,
  resolverSolicitudCambioBanco,
  solicitarCambioCuentaBancaria,
  type EstadoBanco,
} from "@/server/contabilidad/bancos/acciones";
import type {
  CuentaAuxiliar,
  CuentaConSaldo,
  SolicitudCambioBanco,
} from "@/server/contabilidad/bancos/consultas";

const INICIAL: EstadoBanco = { estado: "inicial" };

function useError(estado: EstadoBanco): string | null {
  const t = useTranslations("contab");
  if (estado.estado === "inicial" || estado.estado === "ok") return null;
  return t(`error.${estado.estado}` as never);
}

/**
 * Tuerca de configuración junto al título del banco.
 *   · Rol `contabilidad`: modifica directamente Título, No. de cuenta, Moneda,
 *     Auxiliar contable y Saldo actual, y aprueba/rechaza solicitudes pendientes.
 *   · Otros roles: proponen los cambios con un motivo y envían una solicitud
 *     de autorización que notifica a Contabilidad.
 */
export function DialogoConfigurarCuentaBanco({
  cuenta,
  auxiliares,
  esContabilidad,
  solicitudesPendientes,
}: {
  cuenta: CuentaConSaldo;
  auxiliares: CuentaAuxiliar[];
  esContabilidad: boolean;
  solicitudesPendientes: SolicitudCambioBanco[];
}) {
  const t = useTranslations("contab.bancos.configCuenta");
  const [abierto, setAbierto] = useState(false);

  const [estadoGuardar, enviarGuardar, guardando] = useActionState(
    async (previo: EstadoBanco, datos: FormData) => {
      const resultado = esContabilidad
        ? await actualizarCuentaBancaria(previo, datos)
        : await solicitarCambioCuentaBancaria(previo, datos);
      if (resultado.estado === "ok" && esContabilidad) setAbierto(false);
      return resultado;
    },
    INICIAL,
  );
  const errorGuardar = useError(estadoGuardar);

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("boton")}
          title={t("boton")}
          className="relative size-9 rounded-full text-tinta-2 hover:bg-muted hover:text-tinta"
        >
          <Settings className="size-4" />
          {esContabilidad && solicitudesPendientes.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-pri-alta text-[10px] font-semibold text-white">
              {solicitudesPendientes.length}
            </span>
          )}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90dvh] overflow-y-auto md:max-w-xl">
        <DialogHeader>
          <DialogTitle className="inline-flex items-center justify-center gap-1.5">
            <span>{t("titulo")}</span>
            <TooltipAyuda
              texto={esContabilidad ? t("ayudaContabilidad") : t("ayudaOtroRol")}
              etiqueta={t("masInformacion")}
            />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {esContabilidad && solicitudesPendientes.length > 0 && (
            <section className="space-y-2.5 rounded-control border border-pri-alta/40 bg-pri-alta/10 p-3.5">
              <p className="text-sm font-semibold text-tinta">
                {t("pendientesTitulo", { n: solicitudesPendientes.length })}
              </p>
              <div className="space-y-3">
                {solicitudesPendientes.map((sol) => (
                  <TarjetaSolicitudPendiente key={sol.id} solicitud={sol} />
                ))}
              </div>
            </section>
          )}

          {!esContabilidad && (
            <div className="rounded-control border border-linea bg-muted/40 px-3.5 py-2.5 text-xs text-tinta-2">
              {t("avisoAutorizacion")}
            </div>
          )}

          <form action={enviarGuardar} className="space-y-4">
            <input type="hidden" name="cuenta" value={cuenta.id} />

            <div className="space-y-1.5">
              <Label htmlFor="cfg-nombre" className="text-sm font-medium">
                {t("campoTitulo")}
              </Label>
              <Input
                id="cfg-nombre"
                name="nombre"
                required
                maxLength={120}
                defaultValue={cuenta.nombre}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cfg-numero" className="text-sm font-medium">
                  {t("campoNumero")}
                </Label>
                <Input
                  id="cfg-numero"
                  name="numero"
                  required
                  maxLength={60}
                  defaultValue={cuenta.numero}
                  className="font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cfg-moneda" className="text-sm font-medium">
                  {t("campoMoneda")}
                </Label>
                <select
                  id="cfg-moneda"
                  name="moneda"
                  className={SELECT}
                  required
                  defaultValue={cuenta.moneda}
                >
                  {MONEDAS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cfg-contable" className="text-sm font-medium">
                {t("campoAuxiliar")}
              </Label>
              <select
                id="cfg-contable"
                name="cuenta_contable"
                className={SELECT}
                required
                defaultValue={cuenta.cuenta_contable_id}
              >
                {auxiliares.map((c) => (
                  <option key={c.id} value={c.id}>
                    {`${c.codigo} · ${c.nombre}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cfg-saldo" className="text-sm font-medium">
                {t("campoSaldo")}
              </Label>
              <Input
                id="cfg-saldo"
                name="saldo_actual"
                inputMode="decimal"
                required
                defaultValue={Number(cuenta.saldo).toFixed(2)}
                className="tabular-nums"
              />
            </div>

            {!esContabilidad && (
              <div className="space-y-1.5">
                <Label htmlFor="cfg-motivo" className="text-sm font-medium">
                  {t("campoMotivo")}
                </Label>
                <Textarea id="cfg-motivo" name="motivo" required rows={2} maxLength={300} />
              </div>
            )}

            {errorGuardar && <AvisoError>{errorGuardar}</AvisoError>}
            {estadoGuardar.estado === "ok" && !esContabilidad && (
              <AvisoOk>{t("solicitudEnviada")}</AvisoOk>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAbierto(false)}>
                {t("cerrar")}
              </Button>
              <Button type="submit" cargando={guardando}>
                {guardando ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : esContabilidad ? (
                  <Save className="size-4" />
                ) : (
                  <Send className="size-4" />
                )}
                {esContabilidad ? t("guardar") : t("solicitar")}
              </Button>
            </DialogFooter>
          </form>

          {!esContabilidad && solicitudesPendientes.length > 0 && (
            <section className="space-y-2 border-t border-linea pt-4">
              <p className="text-xs font-medium text-tinta-2">{t("misPendientes")}</p>
              <ul className="space-y-2">
                {solicitudesPendientes.map((sol) => (
                  <li
                    key={sol.id}
                    className="rounded-control border border-linea bg-card p-3 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-tinta">{sol.nombre}</span>
                      <Badge variant="neutra">
                        <Clock />
                        {t("pendiente")}
                      </Badge>
                    </div>
                    <p className="texto-meta">
                      {sol.numero} · {sol.moneda} · {sol.cuenta_contable} ·{" "}
                      <Monto valor={sol.saldo_actual} moneda={sol.moneda} />
                    </p>
                    <p className="text-tinta-2">{sol.motivo}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TarjetaSolicitudPendiente({ solicitud }: { solicitud: SolicitudCambioBanco }) {
  const t = useTranslations("contab.bancos.configCuenta");
  const [estado, enviar, enviando] = useActionState(resolverSolicitudCambioBanco, INICIAL);
  const error = useError(estado);

  if (estado.estado === "ok") {
    return <AvisoOk>{t("solicitudResuelta")}</AvisoOk>;
  }

  return (
    <div className="space-y-2 rounded-control border border-linea bg-background p-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-tinta">{solicitud.solicitante_nombre}</span>
        <span className="texto-meta">{solicitud.solicitado_en}</span>
      </div>
      <div className="space-y-0.5 text-tinta-2">
        <p>
          <span className="font-medium text-tinta">{t("campoTitulo")}:</span> {solicitud.nombre}
        </p>
        <p>
          <span className="font-medium text-tinta">{t("campoNumero")}:</span>{" "}
          <span className="font-mono">{solicitud.numero}</span> · {solicitud.moneda}
        </p>
        <p>
          <span className="font-medium text-tinta">{t("campoAuxiliar")}:</span>{" "}
          {solicitud.cuenta_contable}
        </p>
        <p>
          <span className="font-medium text-tinta">{t("campoSaldo")}:</span>{" "}
          <Monto valor={solicitud.saldo_actual} moneda={solicitud.moneda} />
        </p>
        <p>
          <span className="font-medium text-tinta">{t("campoMotivo")}:</span> {solicitud.motivo}
        </p>
      </div>
      {error && <AvisoError>{error}</AvisoError>}
      <div className="flex flex-wrap justify-end gap-2 pt-1">
        <form action={enviar}>
          <input type="hidden" name="solicitud_id" value={solicitud.id} />
          <input type="hidden" name="decision" value="rechazada" />
          <Button type="submit" size="sm" variant="outline" disabled={enviando}>
            <X className="size-3.5" />
            {t("rechazar")}
          </Button>
        </form>
        <form action={enviar}>
          <input type="hidden" name="solicitud_id" value={solicitud.id} />
          <input type="hidden" name="decision" value="aprobada" />
          <Button type="submit" size="sm" disabled={enviando}>
            {enviando ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            {t("aprobar")}
          </Button>
        </form>
      </div>
    </div>
  );
}
