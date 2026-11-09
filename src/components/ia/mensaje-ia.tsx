"use client";

import { AlertCircle, ArrowUpRight, Check } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";

import { TarjetaAccionIA, type TarjetaAccion } from "@/components/ia/tarjeta-accion";
import { AiOrb, type EstadoOrbe } from "@/components/ui/ai-orb";
import { cn } from "@/lib/utils";
import type { AccionSugerida, MensajeWidget } from "@/server/ia/asistente-global";

/** Un paso de herramienta que el agente dio mientras respondía. */
export type PasoVisible = {
  id: string;
  herramienta: string;
  estado: "ejecutando" | "ok" | "error";
  resumen: string;
};

export type MensajeLocal = MensajeWidget & {
  pasos?: PasoVisible[];
  tarjetas?: TarjetaAccion[];
};

/**
 * Burbuja de la conversación del widget.
 *
 * Lo del asistente va sin avatar fijo: el orbe que «piensa» está una sola vez,
 * en la cabecera y en la respuesta en curso. Un canvas animado por mensaje
 * pasado sería ruido y gasto de batería sin decir nada nuevo.
 */
export function MensajeIA({
  mensaje,
  alNavegar,
}: {
  mensaje: MensajeLocal;
  alNavegar: (accion: AccionSugerida) => void;
}) {
  const t = useTranslations("widgetIA");
  const reducido = useReducedMotion() ?? false;
  const mio = mensaje.rol === "user";

  return (
    <motion.div
      layout={!reducido}
      initial={reducido ? false : { opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className={cn("flex", mio ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[86%] min-w-0 rounded-card px-3.5 py-2.5",
          mio ? "bg-tinta text-background" : "bg-muted text-tinta",
        )}
      >
        {mensaje.contenido && (
          // `whitespace-pre-wrap` conserva los saltos del modelo sin interpretar
          // Markdown: pintar HTML a partir de su salida sería más riesgo.
          <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
            {mensaje.contenido}
          </p>
        )}

        <PasosYTarjetas pasos={mensaje.pasos} tarjetas={mensaje.tarjetas} />

        {mensaje.accion && (
          <div className="border-linea bg-card mt-3 rounded-control border p-2.5">
            <p className="text-tinta-2 text-xs font-medium">
              {t("accionIdentificada")} · {mensaje.accion.etiqueta}
            </p>
            <button
              type="button"
              onClick={() => alNavegar(mensaje.accion!)}
              className="bg-marca-500 hover:bg-marca-600 focus-visible:ring-ring mt-2 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-control text-sm font-semibold text-white outline-none transition-colors focus-visible:ring-2 active:scale-[0.98]"
            >
              {t("abrirPantalla")}
              <ArrowUpRight className="size-4" />
            </button>
          </div>
        )}

        {mensaje.hora && (
          <p className={cn("mt-1 text-[11px]", mio ? "text-background/70" : "text-tinta-3")}>
            {mensaje.hora}
          </p>
        )}
      </div>
    </motion.div>
  );
}

/** Lo que hizo el agente (pasos) y lo que propone (tarjetas de aprobación). */
export function PasosYTarjetas({
  pasos,
  tarjetas,
}: {
  pasos?: PasoVisible[];
  tarjetas?: TarjetaAccion[];
}) {
  return (
    <>
      {pasos && pasos.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {pasos.map((paso) => (
            <motion.li
              key={paso.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-tinta-2 flex items-center gap-2 text-xs"
            >
              {paso.estado === "ejecutando" ? (
                <AiOrb estado="tool-call" tamano="sm" />
              ) : paso.estado === "ok" ? (
                <Check className="text-marca-600 size-4 shrink-0" />
              ) : (
                <AlertCircle className="size-4 shrink-0" />
              )}
              <span className="truncate">{paso.resumen}</span>
            </motion.li>
          ))}
        </ul>
      )}

      {tarjetas?.map((tarjeta) => (
        <TarjetaAccionIA key={tarjeta.accionId} {...tarjeta} />
      ))}
    </>
  );
}

/** Estado del orbe para la respuesta que está llegando. */
export function estadoEnVivo(enVivo: MensajeLocal | null): EstadoOrbe {
  if (!enVivo) return "thinking";
  if (enVivo.pasos?.some((paso) => paso.estado === "ejecutando")) return "tool-call";
  if (enVivo.tarjetas && enVivo.tarjetas.length > 0) return "waiting-approval";
  if (enVivo.contenido) return "streaming";
  if (enVivo.pasos && enVivo.pasos.length > 0) return "tool-result";
  return "thinking";
}
