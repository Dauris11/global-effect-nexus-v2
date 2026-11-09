"use client";

import { useState } from "react";
import { Check, Undo2, X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";

import { AiOrb, type EstadoOrbe } from "@/components/ui/ai-orb";
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

/** El orbe de la tarjeta cuenta en qué punto está la acción propuesta. */
const ORBE_DE_FASE: Record<Fase, EstadoOrbe> = {
  propuesta: "waiting-approval",
  trabajando: "tool-call",
  hecha: "done",
  rechazada: "idle",
  deshecha: "idle",
  error: "error",
};

export function TarjetaAccionIA({ accionId, resumen }: TarjetaAccion) {
  const t = useTranslations("widgetIA");
  const [fase, setFase] = useState<Fase>("propuesta");
  const [reversible, setReversible] = useState(false);
  const reducido = useReducedMotion() ?? false;

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
    <motion.div
      initial={reducido ? false : { opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 30 }}
      className="rounded-card border-linea-fuerte bg-card mt-2 border p-3"
    >
      <p className="text-tinta flex items-center gap-2 text-sm font-semibold">
        <AiOrb estado={ORBE_DE_FASE[fase]} tamano="sm" />
        {t("tarjeta.titulo")}
      </p>

      <p className="text-tinta mt-1.5 text-sm">{resumen}</p>

      {fase === "propuesta" && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => void resolver(aprobarAccionIA, "hecha")}
            className="bg-marca-500 hover:bg-marca-600 focus-visible:ring-ring flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-control text-sm font-semibold text-white outline-none transition-colors focus-visible:ring-2 active:scale-[0.98]"
          >
            <Check className="size-4" />
            {t("tarjeta.aprobar")}
          </button>
          <button
            type="button"
            onClick={() => void resolver(rechazarAccionIA, "rechazada")}
            className="border-linea-fuerte hover:bg-muted text-tinta focus-visible:ring-ring flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-control border text-sm font-medium outline-none transition-colors focus-visible:ring-2 active:scale-[0.98]"
          >
            <X className="size-4" />
            {t("tarjeta.rechazar")}
          </button>
        </div>
      )}

      {fase === "trabajando" && (
        <p role="status" className="text-tinta-2 mt-3 text-sm">
          {t("tarjeta.trabajando")}
        </p>
      )}

      {fase !== "propuesta" && fase !== "trabajando" && (
        <div className="mt-3 flex items-center justify-between gap-2">
          <p
            role="status"
            className={cn("flex items-center gap-1.5 text-sm font-medium", fase === "error" ? "text-tinta" : "text-marca-700")}
          >
            {fase === "error" ? <X className="size-4" /> : <Check className="size-4" />}
            {t(`tarjeta.fase.${fase}`)}
          </p>

          {fase === "hecha" && reversible && (
            <button
              type="button"
              onClick={() => void resolver(deshacerAccionIA, "deshecha")}
              className="text-marca-700 flex min-h-11 items-center gap-1.5 px-2 text-sm font-semibold hover:underline"
            >
              <Undo2 className="size-4" />
              {t("tarjeta.deshacer")}
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}
