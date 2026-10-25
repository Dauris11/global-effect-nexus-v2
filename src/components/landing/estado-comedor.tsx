"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Estado del comedor dentro de la tarjeta de inscripción: abierto o cerrado, y
 * cuánto queda.
 *
 * La ventana (parámetros `comedor.apertura` y `comedor.cierre`) depende de la hora de QUIEN MIRA, no del
 * servidor. Calcularlo al renderizar daría dos resultados distintos y React
 * avisaría de discordancia al hidratar, así que arranca sin hora y se rellena
 * tras montar. Mientras tanto muestra el horario, que es cierto a cualquier hora.
 *
 * Es lo único que quedó del antiguo panel "Ahora mismo", que era una sección
 * entera para dos datos. El estado del comedor vive aquí, pegado al botón que
 * lleva a inscribirse, que es donde sirve de algo; el próximo evento ya lo dice
 * la sección de eventos y no hacía falta dos veces.
 *
 * Abierto va en la píldora `marca` y cerrado en la `neutra`: el peso, no el
 * matiz, dice cuál importa ahora.
 */

export function EstadoComedor({
  aperturaMin: APERTURA_MIN,
  cierreMin: CIERRE_MIN,
  textos,
}: {
  /** Minutos desde medianoche. Salen de los parámetros institucionales. */
  aperturaMin: number;
  cierreMin: number;
  textos: {
    abierto: string;
    cerrado: string;
    ventana: string;
    /** Plantilla con `{n}`, los minutos que faltan para el cierre. */
    quedan: string;
    proximaApertura: string;
    /** Ya resuelto en el servidor: "3 inscritos hoy". Vacío si no hay ninguno. */
    inscritos: string;
  };
}) {
  const [minutos, setMinutos] = useState<number | null>(null);

  useEffect(() => {
    const actualizar = () => {
      const ahora = new Date();
      setMinutos(ahora.getHours() * 60 + ahora.getMinutes());
    };

    actualizar();

    // Cada 30 s: basta para que la cuenta atrás en minutos no se quede vieja.
    const temporizador = setInterval(actualizar, 30_000);

    return () => clearInterval(temporizador);
  }, []);

  const abierto =
    minutos !== null && minutos >= APERTURA_MIN && minutos < CIERRE_MIN;

  const detalle =
    minutos === null
      ? textos.ventana
      : abierto
        ? // Sustitución directa del marcador: es el único valor variable y así
          // no hay que mandar el mensaje ICU completo al navegador.
          textos.quedan.replace("{n}", String(CIERRE_MIN - minutos))
        : textos.proximaApertura;

  return (
    <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      {minutos !== null && (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
            abierto ? "bg-marca-50 text-marca-700" : "bg-muted text-tinta-2",
          )}
        >
          {abierto && (
            <span className="size-1.5 animate-pulse rounded-full bg-marca-500" />
          )}
          {abierto ? textos.abierto : textos.cerrado}
        </span>
      )}

      <span className="text-tinta-2">{detalle}</span>

      {textos.inscritos && (
        <span className="texto-meta">· {textos.inscritos}</span>
      )}
    </p>
  );
}
