import {
  BookOpen,
  CalendarCheck2,
  CalendarClock,
  FolderKanban,
  ClipboardList,
  Inbox,
  ListTodo,
  MessageSquareText,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * Lo que comparten todos los calendarios del sistema: de dónde viene una
 * entrada y cómo se reconoce de un vistazo.
 *
 * Vive en `lib/` y no en el componente porque lo importan tanto el calendario
 * base (cliente) como las páginas que arman las entradas. El color de cada
 * origen está en `components/ui/calendario-base.css` (`.fc-origen-*`): el
 * icono es lo que sobrevive en escala de grises y con el acento negro, donde
 * tres azules oscuros se confunden.
 */

export type OrigenCalendario =
  | "evento"
  | "tarea"
  | "actividad"
  | "asignacion"
  | "cita"
  | "reunion"
  | "clase"
  | "solicitud"
  | "foro";

/** Del origen a su icono y a su clave en `calendar.origin.*`. */
export const ORIGEN_VISUAL: Record<
  OrigenCalendario,
  { icono: LucideIcon; llave: string }
> = {
  evento: { icono: CalendarCheck2, llave: "event" },
  tarea: { icono: ListTodo, llave: "task" },
  actividad: { icono: FolderKanban, llave: "activity" },
  asignacion: { icono: ClipboardList, llave: "assignment" },
  cita: { icono: CalendarClock, llave: "appointment" },
  reunion: { icono: Users, llave: "meeting" },
  clase: { icono: BookOpen, llave: "class" },
  solicitud: { icono: Inbox, llave: "request" },
  foro: { icono: MessageSquareText, llave: "forum" },
};

/** Una entrada tal como la entiende el calendario base. */
export type EventoCalendario = {
  /** Único en todo el calendario; con él se vuelve a la entrada original. */
  clave: string;
  origen: OrigenCalendario;
  titulo: string;
  /** `YYYY-MM-DD`. */
  dia: string;
  /** `HH:MM`, o `null` si dura todo el día. */
  hora: string | null;
  horaFin?: string | null;
  /** Si esta persona puede arrastrarla. El servidor lo vuelve a comprobar. */
  movible?: boolean;
};

export type VistaCalendario = "mes" | "semana" | "dia" | "lista";

/**
 * Entrada del calendario interno (`/calendario`): lo que la consulta trae más
 * lo que hace falta para el diálogo de detalle y la edición.
 */
export type Entrada = {
  origen: "evento" | "tarea" | "actividad" | "asignacion" | "cita" | "reunion" | "clase";
  id: string;
  titulo: string;
  detalle: string | null;
  /** `YYYY-MM-DD`. */
  dia: string;
  /** `HH:MM` o `null` si dura todo el día. */
  hora: string | null;
  horaFin: string | null;
  descripcion: string | null;
  ubicacion: string | null;
  estado: string;
  prioridad?: string | null;
  /** Si esta persona puede moverla o editarla. Lo decide el servidor. */
  editable: boolean;
};

export const VISTAS_CALENDARIO: readonly VistaCalendario[] = [
  "mes",
  "semana",
  "dia",
  "lista",
];

export function esVistaCalendario(valor: unknown): valor is VistaCalendario {
  return VISTAS_CALENDARIO.includes(valor as VistaCalendario);
}
