"use client";

import { useState } from "react";
import { Check, Loader2, Sparkles, Undo2, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import {
  aprobarAccionIA,
  deshacerAccionIA,
  rechazarAccionIA,
} from "@/server/ia/aprobaciones";

/**
 * Tarjeta de una acción que el agente PROPONE. No se ejecuta hasta que la
 * persona pulsa Aprobar; después, si la acción es reversible, aparece Deshacer.
 *
 * El estado del servidor es la verdad: si el doble clic o una segunda pestaña
 * ya resolvió la acción, el servidor responde `estado` y la tarjeta lo dice.
 */

export type TarjetaAccion = {
  accionId: string;
  resumen: string;
};

type Fase = "propuesta" | "trabajando" | "hecha" | "rechazada" | "deshecha" | "error";

export function TarjetaAccionIA({ accionId, resumen }: TarjetaAccion) {
  const t = useTranslations("widgetIA");
  const [fase, setFase] = useState<Fase>("propuesta");
  const [reversible, setReversible] = useState(false);

  const resolver = async (
    accion: (id: string) => ReturnType<typeof aprobarAccionIA>,
    exito: Fase,
  ) => {
    setFase("trabajando");

    try {
      const resultado = await accion(accionId);

      if (resultado.ok) {
        setReversible(resultado.reversible);
        setFase(exito);
      } else {
        setFase("error");
      }
    } catch {
      setFase("error");
    }
  };

  return (
    <div className="rounded-card border-linea-fuerte bg-card mt-2 border p-3 text-xs">
      <p className="text-marca-700 flex items-center gap-1.5 font-semibold">
        <Sparkles className="size-3.5" />
        {t("tarjeta.titulo")}
      </p>

      <p className="text-tinta mt-1.5 text-[13px]">{resumen}</p>

      {fase === "propuesta" && (
        <div className="mt-2.5 flex gap-2">
          <button
            type="button"
            onClick={() => void resolver(aprobarAccionIA, "hecha")}
            className="bg-marca-500 hover:bg-marca-600 flex h-9 flex-1 items-center justify-center gap-1.5 rounded-control font-medium text-white transition-colors"
          >
            <Check className="size-3.5" />
            {t("tarjeta.aprobar")}
          </button>
          <button
            type="button"
            onClick={() => void resolver(rechazarAccionIA, "rechazada")}
            className="border-linea-fuerte hover:bg-muted text-tinta flex h-9 flex-1 items-center justify-center gap-1.5 rounded-control border font-medium transition-colors"
          >
            <X className="size-3.5" />
            {t("tarjeta.rechazar")}
          </button>
        </div>
      )}

      {fase === "trabajando" && (
        <p className="text-tinta-2 mt-2.5 flex items-center gap-1.5">
          <Loader2 className="size-3.5 animate-spin" />
          {t("tarjeta.trabajando")}
        </p>
      )}

      {fase !== "propuesta" && fase !== "trabajando" && (
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <p className={cn("flex items-center gap-1.5 font-medium", fase === "error" ? "text-tinta" : "text-marca-700")}>
            {fase === "error" ? <X className="size-3.5" /> : <Check className="size-3.5" />}
            {t(`tarjeta.fase.${fase}`)}
          </p>

          {fase === "hecha" && reversible && (
            <button
              type="button"
              onClick={() => void resolver(deshacerAccionIA, "deshecha")}
              className="text-marca-700 flex h-9 items-center gap-1.5 px-2 font-semibold hover:underline"
            >
              <Undo2 className="size-3.5" />
              {t("tarjeta.deshacer")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
