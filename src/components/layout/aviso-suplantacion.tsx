"use client";

import { Info, ShieldAlert, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePathname, useRouter } from "@/i18n/navigation";
import { PARAM_SUPLANTACION_BLOQUEADA, PARAM_SUPLANTACION_CONFIRMAR } from "@/lib/suplantacion";
import { confirmarEscrituraSuplantada } from "@/server/auth/acciones";

/**
 * Lo que ve un developer cuando una acción que escribe, lanzada mientras actúa como otra persona, vuelve a la
 * página con `?suplantacion_bloqueada=1` (bloqueada) o `?suplantacion_confirmar=1` (hace falta confirmar la
 * sesión). El servidor decide y redirige; esto solo lo explica, así que el aviso no es control de acceso.
 *
 * Se quita el parámetro de la URL al cerrar: recargar no debe repetir el aviso.
 */
export function AvisoSuplantacion({ nombre }: { nombre: string }) {
  const t = useTranslations("verComo");
  const parametros = useSearchParams();
  const router = useRouter();
  const ruta = usePathname();
  const [descartado, setDescartado] = useState<string | null>(null);
  const [fallo, setFallo] = useState(false);
  const [pendiente, iniciar] = useTransition();

  const bloqueada = parametros.has(PARAM_SUPLANTACION_BLOQUEADA);
  const confirmar = parametros.has(PARAM_SUPLANTACION_CONFIRMAR);
  const clave = bloqueada ? PARAM_SUPLANTACION_BLOQUEADA : confirmar ? PARAM_SUPLANTACION_CONFIRMAR : null;

  if (!clave || descartado === clave) return null;

  const limpiar = () => {
    const resto = new URLSearchParams(parametros.toString());

    resto.delete(PARAM_SUPLANTACION_BLOQUEADA);
    resto.delete(PARAM_SUPLANTACION_CONFIRMAR);
    setDescartado(clave);
    router.replace(resto.size ? `${ruta}?${resto.toString()}` : ruta);
  };

  if (bloqueada) {
    return (
      <div className="fixed inset-x-4 top-16 z-[60] mx-auto max-w-xl md:top-20">
        <Alert variant="danger" className="shadow-elevada">
          <div className="flex items-start gap-3">
            <p className="flex-1">{t("bloqueado", { nombre })}</p>
            <Button variant="ghost" size="icon-sm" onClick={limpiar} aria-label={t("dismiss")} className="-my-1 -mr-2">
              <X aria-hidden />
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  const confirmarEscritura = () =>
    iniciar(async () => {
      const r = await confirmarEscrituraSuplantada();

      if (r.ok) limpiar();
      else setFallo(true);
    });

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && limpiar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("confirmTitle", { nombre })}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-4">
          <p className="flex items-start gap-2.5 text-sm text-tinta">
            <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            {t("confirmBody")}
          </p>
          {fallo && (
            <Alert variant="danger">
              <p>{t("confirmFailed")}</p>
            </Alert>
          )}
        </div>
        <div className="flex flex-col-reverse gap-2 pt-5 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={limpiar}>
            {t("confirmCancel")}
          </Button>
          <Button onClick={confirmarEscritura} cargando={pendiente}>
            <Info aria-hidden />
            {t("confirmarBoton")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
