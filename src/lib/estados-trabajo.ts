import {
  CheckCircle2,
  ChevronDown,
  ChevronsUp,
  ChevronUp,
  Circle,
  CircleDot,
  Eye,
  Minus,
  PauseCircle,
  XCircle,
  type LucideIcon,
} from "lucide-react";

/**
 * Estado y prioridad del trabajo (proyectos, actividades y tareas) con color.
 *
 * EXCEPCIÓN acotada a «un solo acento» (nov 2026): los colores de la marca no
 * se ven afectados. Estados, estatus, prioridades y módulos pueden llevar color,
 * pero solo de este estándar: los colores son tokens `est-*` y `pri-*` de
 * `globals.css`. Cada estado y cada prioridad lleva SIEMPRE su icono, para que
 * la diferencia sobreviva en grises. Las clases van escritas completas para que
 * Tailwind las vea.
 *
 * Proyectos y actividades usan `planificacion | en_curso | pausado |
 * completado`; las tareas, `por_hacer | en_progreso | en_revision |
 * completada | cancelada`. Las dos familias comparten aspecto.
 */
export type VisualTrabajo = {
  icono: LucideIcon;
  /** Punto o cuadro sólido. */
  solido: string;
  /** Texto del color. */
  texto: string;
  /** Fondo suave de la columna o la píldora. */
  suave: string;
  /** Borde fino del color. */
  borde: string;
  /** Franja superior de la columna. */
  franja: string;
};

const PENDIENTE: VisualTrabajo = {
  icono: Circle,
  solido: "bg-est-pendiente",
  texto: "text-est-pendiente",
  suave: "bg-est-pendiente/10",
  borde: "border-est-pendiente/40",
  franja: "border-t-est-pendiente",
};
const PROGRESO: VisualTrabajo = {
  icono: CircleDot,
  solido: "bg-est-progreso",
  texto: "text-est-progreso",
  suave: "bg-est-progreso/10",
  borde: "border-est-progreso/40",
  franja: "border-t-est-progreso",
};
const REVISION: VisualTrabajo = {
  icono: Eye,
  solido: "bg-est-revision",
  texto: "text-est-revision",
  suave: "bg-est-revision/10",
  borde: "border-est-revision/40",
  franja: "border-t-est-revision",
};
const PAUSA: VisualTrabajo = {
  icono: PauseCircle,
  solido: "bg-est-pausa",
  texto: "text-est-pausa",
  suave: "bg-est-pausa/10",
  borde: "border-est-pausa/40",
  franja: "border-t-est-pausa",
};
const LISTO: VisualTrabajo = {
  icono: CheckCircle2,
  solido: "bg-est-listo",
  texto: "text-est-listo",
  suave: "bg-est-listo/10",
  borde: "border-est-listo/40",
  franja: "border-t-est-listo",
};
const CANCELADO: VisualTrabajo = { ...PENDIENTE, icono: XCircle };

const POR_ESTADO: Record<string, VisualTrabajo> = {
  planificacion: PENDIENTE,
  por_hacer: PENDIENTE,
  pendiente: PENDIENTE,
  en_curso: PROGRESO,
  en_progreso: PROGRESO,
  en_revision: REVISION,
  pausado: PAUSA,
  completado: LISTO,
  completada: LISTO,
  cancelada: CANCELADO,
  cancelado: CANCELADO,
};

/** Un estado desconocido cae en gris, que es lo que menos afirma. */
export function visualEstado(estado: string): VisualTrabajo {
  return POR_ESTADO[estado] ?? PENDIENTE;
}

export type VisualPrioridad = {
  icono: LucideIcon;
  texto: string;
  suave: string;
  /** Barra izquierda de la tarjeta. */
  barra: string;
};

const POR_PRIORIDAD: Record<string, VisualPrioridad> = {
  urgente: {
    icono: ChevronsUp,
    texto: "text-pri-urgente",
    suave: "bg-pri-urgente/10",
    barra: "border-l-pri-urgente",
  },
  alta: {
    icono: ChevronUp,
    texto: "text-pri-alta",
    suave: "bg-pri-alta/10",
    barra: "border-l-pri-alta",
  },
  media: {
    icono: Minus,
    texto: "text-pri-media",
    suave: "bg-pri-media/10",
    barra: "border-l-pri-media",
  },
  baja: {
    icono: ChevronDown,
    texto: "text-pri-baja",
    suave: "bg-pri-baja/10",
    barra: "border-l-pri-baja",
  },
};

export function visualPrioridad(prioridad: string): VisualPrioridad {
  return POR_PRIORIDAD[prioridad] ?? POR_PRIORIDAD.media;
}

/** Columnas del Kanban de proyectos y de actividades, en orden. */
export const COLUMNAS_PROYECTO = ["planificacion", "en_curso", "pausado", "completado"] as const;
export type ColumnaProyecto = (typeof COLUMNAS_PROYECTO)[number];
