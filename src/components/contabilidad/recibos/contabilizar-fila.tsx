"use client";

import { useActionState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { contabilizarRecibo, type EstadoRecibo } from "@/server/contabilidad/recibos/acciones";

const INICIAL: EstadoRecibo = { estado: "inicial" };

/**
 * «Contabilizar» en la fila de un borrador. Usa la MISMA acción de servidor
 * que la ficha (permiso, «quien registra no aprueba» y asiento incluidos); aquí
 * solo cambia dónde está el botón. Si el servidor lo rechaza, el motivo queda
 * visible en la fila en vez de perderse tras un clic.
 */
export function ContabilizarFila({ id, numero }: { id: string; numero: string }) {
  const t = useTranslations("contab");
  const [estado, enviar, enviando] = useActionState(contabilizarRecibo, INICIAL);
  const error = estado.estado === "inicial" || estado.estado === "ok" ? null : t(`error.${estado.estado}` as never);

  return (
    <form action={enviar} className="inline-flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      {error && (
        <span role="alert" className="text-meta max-w-48 truncate text-status-danger-fg" title={error}>
          {error}
        </span>
      )}
      <Button type="submit" variant="secondary" size="sm" cargando={enviando} aria-label={`${t("detalle.contabilizar")} ${numero}`}>
        {enviando ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
        {t("detalle.contabilizar")}
      </Button>
    </form>
  );
}
