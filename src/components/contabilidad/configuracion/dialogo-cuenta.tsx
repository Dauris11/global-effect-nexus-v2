"use client";

import { useState } from "react";
import { CircleSlash, Loader2, Power, Save } from "lucide-react";
import { useTranslations } from "next-intl";

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
import {
  cambiarEstadoCuenta,
  crearSubcuenta,
  renombrarCuenta,
} from "@/server/contabilidad/configuracion/acciones";
import type { CuentaCatalogo } from "@/server/contabilidad/configuracion/consultas";

export type ModoCuenta = "subcuenta" | "renombrar" | "desactivar" | "activar";

const ACCION = {
  subcuenta: crearSubcuenta,
  renombrar: renombrarCuenta,
  desactivar: cambiarEstadoCuenta,
  activar: cambiarEstadoCuenta,
} as const;

/**
 * Las tres operaciones del catálogo. Ninguna borra: desactivar deja la
 * cuenta con su historia y la base rechaza hacerlo si tiene saldo.
 */
export function DialogoCuenta({
  modo,
  cuenta,
  alCerrar,
}: {
  modo: ModoCuenta;
  cuenta: CuentaCatalogo;
  alCerrar: () => void;
}) {
  const t = useTranslations("contab.config.cuenta");
  const [estado, enviar, enviando] = useAccionConfig(ACCION[modo], alCerrar);
  // El código de la subcuenta se escribe como segmento: el prefijo del
  // padre lo pone la pantalla para que no se pueda equivocar.
  const [segmento, setSegmento] = useState("");
  const etiqueta = `${cuenta.codigo} · ${cuenta.nombre}`;

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && alCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(`${modo}.titulo`)}</DialogTitle>
          <DialogDescription>{t(`${modo}.descripcion`, { cuenta: etiqueta })}</DialogDescription>
        </DialogHeader>
        <form action={enviar} className="space-y-4">
          {modo === "subcuenta" ? (
            <>
              <input type="hidden" name="padre_id" value={cuenta.id} />
              <input type="hidden" name="codigo" value={`${cuenta.codigo}.${segmento}`} />
              <div className="space-y-1.5">
                <Label htmlFor="sub-segmento" className="text-sm font-medium">
                  {t("codigo")}
                </Label>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-tinta-2">{`${cuenta.codigo}.`}</span>
                  <Input
                    id="sub-segmento"
                    value={segmento}
                    onChange={(e) => setSegmento(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    inputMode="numeric"
                    required
                    pattern="[0-9]{1,4}"
                    className="max-w-32 font-mono"
                  />
                </div>
                <p className="texto-meta">{t("codigoAyuda")}</p>
              </div>
              {cuenta.admiteMovimiento && <p className="texto-meta">{t("subcuenta.aviso")}</p>}
            </>
          ) : (
            <input type="hidden" name="id" value={cuenta.id} />
          )}

          {(modo === "subcuenta" || modo === "renombrar") && (
            <div className="space-y-1.5">
              <Label htmlFor="cuenta-nombre" className="text-sm font-medium">
                {t("nombre")}
              </Label>
              <Input
                id="cuenta-nombre"
                name="nombre"
                required
                maxLength={160}
                defaultValue={modo === "renombrar" ? cuenta.nombre : ""}
              />
            </div>
          )}
          {(modo === "activar" || modo === "desactivar") && (
            <input type="hidden" name="activar" value={modo === "activar" ? "1" : "0"} />
          )}

          <AvisoEstado estado={estado} />
          <DialogFooter>
            <Button type="submit" variant={modo === "desactivar" ? "destructive" : "default"} disabled={enviando}>
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
