"use client";

/**
 * Orbe animado que dice en qué está el asistente (escuchando, pensando, usando
 * una herramienta, escribiendo, esperando tu aprobación…).
 *
 * Es el componente `ai-orb` de 21st.dev sobre `thinking-orbs`, adaptado a la
 * marca: el tinte sale de los tokens `marca-*` y `tinta` (no de `--primary`,
 * que no sigue el acento negro, ni de un rojo, que la norma prohíbe para los
 * errores) y vuelve a leerse cuando cambia `data-acento`. Las etiquetas
 * accesibles no viven aquí: llegan traducidas por `etiqueta`.
 */

import {
  type ComponentProps,
  type RefObject,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type OrbState, ThinkingOrb } from "thinking-orbs";

import { cn } from "@/lib/utils";

export const ESTADOS_ORBE = [
  "idle",
  "listening",
  "thinking",
  "reasoning",
  "tool-call",
  "tool-result",
  "streaming",
  "waiting-approval",
  "error",
  "done",
] as const;

export type EstadoOrbe = (typeof ESTADOS_ORBE)[number];

type Tono = "apagado" | "marca" | "atencion" | "critico";

type Visual = {
  orbe: OrbState;
  tono: Tono;
  /** Multiplicador sobre la velocidad afinada de la librería. */
  velocidad: number;
  /** Un fotograma quieto en vez de animación. */
  pausado: boolean;
  /** Estado de reposo: se mueve `msReposo` y luego se queda quieto (WCAG 2.2.2). */
  reposa: boolean;
};

const CALMA = 0.6;

const VISUALES: Record<EstadoOrbe, Visual> = {
  done: { orbe: "breathing", pausado: false, reposa: true, velocidad: CALMA, tono: "marca" },
  error: { orbe: "breathing", pausado: true, reposa: false, velocidad: 1, tono: "critico" },
  idle: { orbe: "breathing", pausado: false, reposa: true, velocidad: CALMA, tono: "marca" },
  listening: { orbe: "listening", pausado: false, reposa: true, velocidad: 1, tono: "marca" },
  reasoning: { orbe: "solving", pausado: false, reposa: false, velocidad: 1, tono: "marca" },
  streaming: { orbe: "composing", pausado: false, reposa: false, velocidad: 1, tono: "marca" },
  thinking: { orbe: "working", pausado: false, reposa: false, velocidad: 1, tono: "marca" },
  "tool-call": { orbe: "searching", pausado: false, reposa: false, velocidad: 1, tono: "marca" },
  "tool-result": { orbe: "connecting", pausado: false, reposa: false, velocidad: 1, tono: "marca" },
  "waiting-approval": { orbe: "shaping", pausado: false, reposa: true, velocidad: 0.8, tono: "atencion" },
};

/** Variables del tema por tono; gana la primera definida. */
const TOKENS_TONO: Record<Tono, readonly string[]> = {
  apagado: ["--color-tinta-3"],
  marca: ["--color-marca-500"],
  atencion: ["--color-marca-700"],
  critico: ["--color-tinta"],
};

/** Qué fue lo último que hizo el agente en el mensaje que está llegando. */
export type ActividadAgente =
  | "reasoning"
  | "tool-call"
  | "tool-result"
  | "text"
  | "question";

const EN_VIVO: Record<ActividadAgente, EstadoOrbe> = {
  question: "waiting-approval",
  reasoning: "reasoning",
  text: "streaming",
  "tool-call": "tool-call",
  "tool-result": "tool-result",
};

/**
 * Estado del orbe a partir del estado del chat y de la última actividad del
 * agente. `hayBorrador` hace que un orbe en reposo «escuche» mientras se escribe.
 */
export function estadoDelOrbe({
  estado,
  actividad,
  hayBorrador = false,
  respondio = false,
}: {
  estado: "listo" | "enviado" | "transmitiendo" | "error";
  actividad?: ActividadAgente;
  hayBorrador?: boolean;
  respondio?: boolean;
}): EstadoOrbe {
  if (estado === "error") return "error";
  if (estado === "enviado") return "thinking";
  if (estado === "transmitiendo") return actividad ? EN_VIVO[actividad] : "thinking";
  if (actividad === "question") return "waiting-approval";
  if (hayBorrador) return "listening";
  return respondio ? "done" : "idle";
}

/**
 * El orbe pinta en un canvas y recibe el tinte en hex, mientras que el tema
 * define sus tokens en cualquier sintaxis CSS. El navegador resuelve el token
 * en una sonda oculta y un canvas de 1×1 lo pasa a hex. Se relee al cambiar de
 * tema (`class`), de acento (`data-acento`) o el esquema del sistema.
 */
function suscribirTema(alCambiar: () => void): () => void {
  const observador = new MutationObserver(alCambiar);
  observador.observe(document.documentElement, {
    attributeFilter: ["class", "style", "data-theme", "data-acento"],
    attributes: true,
  });
  const esquema = window.matchMedia("(prefers-color-scheme: dark)");
  esquema.addEventListener("change", alCambiar);
  return () => {
    observador.disconnect();
    esquema.removeEventListener("change", alCambiar);
  };
}

let pintor: CanvasRenderingContext2D | null | undefined;

function resolverTokens(tokens: readonly string[], anfitrion: HTMLElement): string | undefined {
  const sonda = document.createElement("span");
  sonda.style.display = "none";
  sonda.style.color = tokens.reduceRight((reserva, token) => `var(${token}, ${reserva})`, "transparent");
  // Dentro del orbe, para que un tema acotado a un contenedor también aplique.
  anfitrion.append(sonda);
  const calculado = getComputedStyle(sonda).color;
  sonda.remove();
  if (pintor === undefined) {
    const lienzo = document.createElement("canvas");
    lienzo.width = 1;
    lienzo.height = 1;
    pintor = lienzo.getContext("2d", { willReadFrequently: true });
  }
  if (!(pintor && calculado)) return;
  pintor.clearRect(0, 0, 1, 1);
  pintor.fillStyle = "transparent";
  pintor.fillStyle = calculado;
  pintor.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = pintor.getImageData(0, 0, 1, 1).data;
  if (!a) return;
  return `#${[r, g, b].map((canal) => canal.toString(16).padStart(2, "0")).join("")}`;
}

function useColorOrbe(anfitrion: RefObject<HTMLElement | null>, tono: Tono, token?: string) {
  const [color, setColor] = useState<string | undefined>(undefined);
  useEffect(() => {
    const leer = () => {
      if (anfitrion.current) {
        setColor(resolverTokens(token ? [token] : TOKENS_TONO[tono], anfitrion.current));
      }
    };
    // La primera lectura va en el siguiente cuadro: el canvas del orbe ya está
    // montado y no se encadena un segundo render dentro del mismo efecto.
    const cuadro = requestAnimationFrame(leer);
    const desuscribir = suscribirTema(leer);
    return () => {
      cancelAnimationFrame(cuadro);
      desuscribir();
    };
  }, [anfitrion, token, tono]);
  return color;
}

const sinSuscripcion = () => () => undefined;

const TAMANOS = {
  lg: { caja: "size-16", punto: 1, px: 64 },
  md: { caja: "size-8", punto: 1.15, px: 32 },
  sm: { caja: "size-5", punto: 1.3, px: 20 },
} as const;

/** `true` cuando un estado de reposo ya duró `msReposo`; cualquier cambio reinicia. */
function useEnReposo(estado: EstadoOrbe, reposa: boolean, msReposo: number) {
  const [estadoQuieto, setEstadoQuieto] = useState<EstadoOrbe | null>(null);
  useEffect(() => {
    if (!reposa) return;
    const temporizador = setTimeout(() => setEstadoQuieto(estado), msReposo);
    return () => clearTimeout(temporizador);
  }, [msReposo, reposa, estado]);
  return reposa && estadoQuieto === estado;
}

export type AiOrbProps = Omit<
  ComponentProps<"span">,
  "aria-hidden" | "aria-label" | "children" | "role"
> & {
  estado: EstadoOrbe;
  tamano?: keyof typeof TAMANOS;
  /** Nombre accesible, ya traducido. Sin él, el orbe es decorativo. */
  etiqueta?: string;
  /** Variable del tema que sustituye el tinte del estado. */
  token?: string;
  /** Cuánto se mueve un estado de reposo antes de quedarse quieto, ms. */
  msReposo?: number;
};

export function AiOrb({
  estado,
  tamano = "lg",
  etiqueta,
  token,
  msReposo = 5000,
  className,
  ...resto
}: AiOrbProps) {
  const visual = VISUALES[estado];
  const reducido = useReducedMotion() ?? false;
  const quieto = useEnReposo(estado, visual.reposa, msReposo);
  const anfitrion = useRef<HTMLSpanElement>(null);
  const color = useColorOrbe(anfitrion, visual.tono, token);
  // Canvas solo en el cliente: en el servidor va la caja y tras hidratar, el orbe.
  const montado = useSyncExternalStore(sinSuscripcion, () => true, () => false);
  const medida = TAMANOS[tamano];
  const accesible = etiqueta
    ? { "aria-label": etiqueta, role: "img" }
    : { "aria-hidden": true };

  return (
    <span
      {...resto}
      {...accesible}
      ref={anfitrion}
      data-slot="ai-orb"
      data-state={estado}
      className={cn("relative inline-block shrink-0", medida.caja, className)}
    >
      {montado ? (
        <AnimatePresence initial={false}>
          <motion.span
            key={`${visual.orbe}-${visual.tono}`}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reducido ? { duration: 0 } : { duration: 0.2 }}
          >
            <ThinkingOrb
              aria-hidden
              color={color}
              dotSize={medida.punto}
              paused={visual.pausado || reducido || quieto}
              size={medida.px}
              speed={visual.velocidad}
              state={visual.orbe}
            />
          </motion.span>
        </AnimatePresence>
      ) : null}
    </span>
  );
}
