"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { ALERTA_RIESGO } from "@/lib/paleta";
import type { EstadoCosto } from "@/server/costos/acciones";

/** Resultado de un alta: el error en tinta con su icono (sin rojo) y el éxito en una línea. */
export function MensajeEstadoCosto({ estado }: { estado: EstadoCosto }) {
  const t = useTranslations("costs.register");

  if (estado.estado === "inicial") return null;

  if (estado.estado === "ok") {
    return (
      <p role="status" className="text-marca-700 flex items-center gap-2 text-sm font-medium">
        <CheckCircle2 className="size-4" />
        {t("saved")}
      </p>
    );
  }

  return (
    <p role="alert" className={ALERTA_RIESGO.contenedor}>
      <AlertCircle className={ALERTA_RIESGO.icono} />
      <span className={ALERTA_RIESGO.texto}>{t(`errors.${estado.estado}`)}</span>
    </p>
  );
}
