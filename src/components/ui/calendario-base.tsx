"use client";

import type { ReactNode } from "react";
import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";
import type {
  EventoCalendario,
  OrigenCalendario,
  VistaCalendario,
} from "@/lib/calendario";

import "./calendario-base.css";

/**
 * Calendario único del sistema: envoltorio de FullCalendar tematizado con los
 * tokens (`calendario-base.css`). Lo usan `/calendario`, el calendario del
 * estudiante y los resúmenes de inicio del estudiante y del docente.
 *
 * FullCalendar se carga perezoso y solo en el cliente: pesa mucho y necesita
 * `window`, así que mientras llega se pinta un esqueleto del mismo tamaño.
 *
 * Es no controlado a propósito: FullCalendar guarda la fecha y la vista, y el
 * padre solo se entera con `onCambioRango` (para escribirlas en la URL y pedir
 * al servidor el mes nuevo). Las fechas viajan como `YYYY-MM-DD` y `HH:MM`, no
 * como `Date`: un `Date` cambia de día según la zona del navegador.
 */
export type PropiedadesCalendarioBase = {
  eventos: readonly EventoCalendario[];
  /** `YYYY-MM-DD` de hoy, calculado en el servidor. */
  hoy: string;
  /** `YYYY-MM-DD` donde abre el calendario. */
  fechaInicial: string;
  /** Sin valor, abre en mes (y en lista si la pantalla es de móvil). */
  vistaInicial?: VistaCalendario;
  /** Para los resúmenes de inicio: solo mes, sin selector de vista. */
  compacto?: boolean;
  etiquetaOrigen: (origen: OrigenCalendario) => string;
  onAbrir?: (clave: string) => void;
  /** Clic en un día vacío. Si se pasa, el día se pinta como pulsable. */
  onDiaClick?: (dia: string) => void;
  /**
   * Suelta una entrada en otro día (y hora, en semana y día; vacía si no
   * cambia). Debe devolver `false` si el servidor lo rechazó: el calendario
   * deshace el arrastre. Solo se pueden arrastrar las entradas `movible`.
   */
  onMover?: (clave: string, dia: string, hora: string) => Promise<boolean>;
  onCambioRango?: (rango: { mes: string; vista: VistaCalendario }) => void;
  /** Botones propios a la derecha del encabezado (p. ej. «Nuevo evento»). */
  acciones?: ReactNode;
  className?: string;
};

const CalendarioBaseInterno = dynamic(
  () => import("./calendario-base-interno"),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[520px] w-full rounded-card" />,
  },
);

export function CalendarioBase(props: PropiedadesCalendarioBase) {
  return <CalendarioBaseInterno {...props} />;
}
