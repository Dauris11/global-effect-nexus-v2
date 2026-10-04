"use client";

import { useActionState } from "react";
import { Check, CheckCheck, Loader2, Lock, RefreshCw, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { AvisoError } from "@/components/contabilidad/comun";
import { Button } from "@/components/ui/button";
import {
  cerrarConciliacion,
  confirmarTodas,
  decidirLinea,
  volverAProponer,
  type EstadoBanco,
} from "@/server/contabilidad/bancos/acciones";

const INICIAL: EstadoBanco = { estado: "inicial" };

/** Confirmar o descartar la pareja propuesta de una línea del banco. */
export function DecisionLinea({ lineaId, confirmada }: { lineaId: string; confirmada: boolean }) {
  const t = useTranslations("contab.conciliacion");
  const [, enviar, enviando] = useActionState(decidirLinea, INICIAL);

  return (
    <form action={enviar} className="flex gap-1">
      <input type="hidden" name="linea" value={lineaId} />
      {!confirmada && (
        <Button type="submit" name="decision" value="confirmar" size="sm" variant="secondary" disabled={enviando}>
          <Check className="size-4" />
          {t("confirmar")}
        </Button>
      )}
      <Button type="submit" name="decision" value="descartar" size="sm" variant="ghost" disabled={enviando}>
        <X className="size-4" />
        {t("descartar")}
      </Button>
    </form>
  );
}

/** Confirmar todas, volver a proponer y cerrar. */
export function AccionesConciliacion({ id }: { id: string }) {
  const t = useTranslations("contab.conciliacion");
  const tc = useTranslations("contab");
  const [eTodas, todas, enTodas] = useActionState(confirmarTodas, INICIAL);
  const [eProp, proponer, enProp] = useActionState(volverAProponer, INICIAL);
  const [eCerrar, cerrar, enCerrar] = useActionState(cerrarConciliacion, INICIAL);
  const fallo = [eTodas, eProp, eCerrar].find((e) => e.estado !== "inicial" && e.estado !== "ok");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <form action={todas}>
          <input type="hidden" name="id" value={id} />
          <Button type="submit" variant="secondary" disabled={enTodas}>
            {enTodas ? <Loader2 className="size-4 animate-spin" /> : <CheckCheck className="size-4" />}
            {t("confirmarTodas")}
          </Button>
        </form>
        <form action={proponer}>
          <input type="hidden" name="id" value={id} />
          <Button type="submit" variant="ghost" disabled={enProp}>
            {enProp ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            {t("proponer")}
          </Button>
        </form>
        <form action={cerrar}>
          <input type="hidden" name="id" value={id} />
          <Button type="submit" disabled={enCerrar}>
            {enCerrar ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
            {t("cerrar")}
          </Button>
        </form>
      </div>
      <p className="texto-meta">{t("cerrarAyuda")}</p>
      {fallo && <AvisoError>{tc(`error.${fallo.estado}` as never)}</AvisoError>}
    </div>
  );
}
