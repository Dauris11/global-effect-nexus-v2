"use client";

import { useActionState, useState } from "react";
import { AlertCircle, Ban, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ALERTA_RIESGO } from "@/lib/paleta";
import type { EstadoCosto } from "@/server/costos/acciones";

/**
 * Anular un registro de costo: pide el motivo y lo manda a la acción. No hay
 * botón de borrar a propósito: en contabilidad el error se anula y queda a la
 * vista, no desaparece.
 */
export function AnularCosto({
  id,
  accion,
}: {
  id: string;
  accion: (previo: EstadoCosto, datos: FormData) => Promise<EstadoCosto>;
}) {
  const t = useTranslations("costs.register");
  const [abierto, setAbierto] = useState(false);
  const [estado, enviar, pendiente] = useActionState(accion, { estado: "inicial" } as EstadoCosto);

  if (!abierto) {
    return (
      <Button type="button" variant="ghost" size="sm" onClick={() => setAbierto(true)}>
        <Ban className="size-4" />
        {t("void.button")}
      </Button>
    );
  }

  return (
    <form action={enviar} className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input type="hidden" name="id" value={id} />
      <Input name="motivo" required maxLength={300} placeholder={t("void.reason")} aria-label={t("void.reason")} className="sm:w-64" />
      <div className="flex gap-2">
        <Button type="submit" variant="destructive" size="sm" disabled={pendiente}>
          {pendiente ? <Loader2 className="size-4 animate-spin" /> : <Ban className="size-4" />}
          {t("void.confirm")}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setAbierto(false)}>
          {t("void.cancel")}
        </Button>
      </div>
      {estado.estado !== "inicial" && estado.estado !== "ok" && (
        <p role="alert" className={ALERTA_RIESGO.contenedor}>
          <AlertCircle className={ALERTA_RIESGO.icono} />
          <span className={ALERTA_RIESGO.texto}>{t(`errors.${estado.estado}`)}</span>
        </p>
      )}
    </form>
  );
}
