"use client";

import { useActionState, useState } from "react";
import { Ban, CheckCircle2, FileUp, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { AvisoError, AvisoOk } from "@/components/contabilidad/comun";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  adjuntarFactura,
  anularFactura,
  aprobarFactura,
  type EstadoProveedor,
} from "@/server/contabilidad/proveedores/acciones";
import type { DetalleFactura } from "@/server/contabilidad/proveedores/consultas";

const INICIAL: EstadoProveedor = { estado: "inicial" };

export function AccionesFactura({
  factura,
  usuarioId,
  puedeAprobar,
  puedeRegistrar,
}: {
  factura: DetalleFactura;
  usuarioId: string;
  puedeAprobar: boolean;
  puedeRegistrar: boolean;
}) {
  const t = useTranslations("contab.factura");
  const tc = useTranslations("contab");

  const [estadoAprobar, enviarAprobar, aprobando] = useActionState(aprobarFactura, INICIAL);
  const [estadoAnular, enviarAnular, anulando] = useActionState(anularFactura, INICIAL);
  const [estadoAdjunto, enviarAdjunto, adjuntando] = useActionState(adjuntarFactura, INICIAL);

  const [mostrarAnular, setMostrarAnular] = useState(false);
  const [motivo, setMotivo] = useState("");

  const errorAprobar =
    estadoAprobar.estado !== "inicial" && estadoAprobar.estado !== "ok"
      ? tc(`error.${estadoAprobar.estado}` as never)
      : null;

  const errorAnular =
    estadoAnular.estado !== "inicial" && estadoAnular.estado !== "ok"
      ? tc(`error.${estadoAnular.estado}` as never)
      : null;

  const errorAdjunto =
    estadoAdjunto.estado !== "inicial" && estadoAdjunto.estado !== "ok"
      ? tc(`error.${estadoAdjunto.estado}` as never)
      : null;

  return (
    <div className="space-y-4">
      {factura.estado === "borrador" && puedeAprobar && (
        <div className="rounded-control border border-linea bg-background p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-tinta">{t("aprobar")}</p>
              <p className="text-xs text-tinta-2">{t("aprobarAyuda")}</p>
            </div>
            <form action={enviarAprobar}>
              <input type="hidden" name="id" value={factura.id} />
              <Button type="submit" disabled={aprobando}>
                {aprobando ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                {t("aprobar")}
              </Button>
            </form>
          </div>
          {errorAprobar && <AvisoError>{errorAprobar}</AvisoError>}
        </div>
      )}

      {factura.estado !== "anulada" && puedeAprobar && (
        <div className="rounded-control border border-linea bg-background p-4 space-y-3">
          {!mostrarAnular ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-tinta">{t("anular")}</p>
                <p className="text-xs text-tinta-2">{t("anularDescripcion")}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMostrarAnular(true)}
              >
                <Ban className="size-4 text-alerta" />
                {t("anular")}
              </Button>
            </div>
          ) : (
            <form action={enviarAnular} className="space-y-3">
              <input type="hidden" name="id" value={factura.id} />
              <div className="space-y-1.5">
                <Label htmlFor="motivo" className="text-sm font-medium">
                  {t("motivo")}
                </Label>
                <Textarea
                  id="motivo"
                  name="motivo"
                  rows={2}
                  required
                  minLength={5}
                  maxLength={500}
                  placeholder="Explica por qué se anula esta factura..."
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                />
              </div>
              {errorAnular && <AvisoError>{errorAnular}</AvisoError>}
              <div className="flex gap-2">
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={anulando || motivo.trim().length < 5}
                >
                  {anulando ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Ban className="size-4" />
                  )}
                  {t("confirmarAnular")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setMostrarAnular(false)}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          )}
        </div>
      )}

      {puedeRegistrar && (
        <div className="rounded-control border border-linea bg-background p-4 space-y-3">
          <div>
            <p className="font-semibold text-tinta">{t("adjuntos")}</p>
            <p className="text-xs text-tinta-2">{t("adjuntoAyuda")}</p>
          </div>
          <form action={enviarAdjunto} className="space-y-3">
            <input type="hidden" name="id" value={factura.id} />
            <div className="flex flex-wrap items-center gap-3">
              <Input
                type="file"
                name="archivo"
                required
                accept=".pdf,.png,.jpg,.jpeg"
                className="max-w-xs"
              />
              <Button type="submit" variant="secondary" size="sm" disabled={adjuntando}>
                {adjuntando ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <FileUp className="size-4" />
                )}
                {t("adjuntar")}
              </Button>
            </div>
            {errorAdjunto && <AvisoError>{errorAdjunto}</AvisoError>}
            {estadoAdjunto.estado === "ok" && <AvisoOk>{tc("cxp.ok")}</AvisoOk>}
          </form>
        </div>
      )}
    </div>
  );
}
