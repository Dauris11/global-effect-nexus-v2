/**
 * Mapa central de estados del sistema → color semántico + etiqueta + icono.
 * Lo usa `<StatusBadge>` (components/app/status-badge.tsx); ninguna pantalla debe
 * pintar un estado por su cuenta (docs/ux-rules.md §9). GENERADO desde la tabla de
 * estados: para agregar uno, se añade aquí y su etiqueta en `messages/*.json` →
 * `estados.<valor>` (es y en), y `npm run i18n:check` avisa si falta alguna.
 *
 * Los valores son los snake_case que guarda la base o el código. Si el mismo valor
 * existe en varios dominios (`activa`, `cerrada`…) se muestra igual en todos: es lo
 * que evita que «Aprobada» sea verde en una pantalla y gris en otra.
 */
import {
  CheckCircle2,
  Circle,
  Flag,
  Info,
  Loader2,
  TriangleAlert,
  XCircle,
  type LucideIcon,
} from "lucide-react";

export type TokenEstado = "success" | "warning" | "danger" | "info" | "progress" | "done" | "neutral";

/** Clases literales (Tailwind no compila nombres armados con plantillas). */
export const CLASES_TOKEN: Record<TokenEstado, { pastilla: string; icono: string }> = {
  success: { pastilla: "border-status-success-border bg-status-success-bg text-status-success-fg", icono: "text-status-success" },
  warning: { pastilla: "border-status-warning-border bg-status-warning-bg text-status-warning-fg", icono: "text-status-warning" },
  danger: { pastilla: "border-status-danger-border bg-status-danger-bg text-status-danger-fg", icono: "text-status-danger" },
  info: { pastilla: "border-status-info-border bg-status-info-bg text-status-info-fg", icono: "text-status-info" },
  progress: { pastilla: "border-status-progress-border bg-status-progress-bg text-status-progress-fg", icono: "text-status-progress" },
  done: { pastilla: "border-status-done-border bg-status-done-bg text-status-done-fg", icono: "text-status-done" },
  neutral: { pastilla: "border-status-neutral-border bg-status-neutral-bg text-status-neutral-fg", icono: "text-status-neutral" },
};

/**
 * Un icono por token y no por estado: con el color no basta (se tiene que leer en
 * grises), pero un icono distinto por cada uno de los ~120 estados no se aprende.
 */
export const ICONO_TOKEN: Record<TokenEstado, LucideIcon> = {
  success: CheckCircle2,
  warning: TriangleAlert,
  danger: XCircle,
  info: Info,
  progress: Loader2,
  done: Flag,
  neutral: Circle,
};

export const MAPA_ESTADOS = {
  reclutado: "info",
  postulado: "info",
  academia_liderazgo: "progress",
  activo: "success",
  activa: "success",
  inactivo: "neutral",
  inactiva: "neutral",
  graduado: "done",
  suspendido: "danger",
  retirado: "neutral",
  retirada: "neutral",
  standby_tecnico: "neutral",
  enviada: "info",
  en_revision: "warning",
  pendiente_direccion: "warning",
  pendiente_aprobacion: "warning",
  aprobada: "success",
  aprobado: "success",
  rechazada: "danger",
  rechazado: "danger",
  completada: "success",
  completado: "success",
  cancelada: "neutral",
  cancelado: "neutral",
  pendiente: "warning",
  en_proceso: "info",
  por_hacer: "warning",
  en_progreso: "progress",
  planificacion: "info",
  planificado: "info",
  planificada: "info",
  en_curso: "progress",
  pausado: "warning",
  programada: "info",
  programado: "info",
  realizada: "success",
  reprogramada: "warning",
  entregado: "success",
  calificado: "success",
  tarde: "warning",
  vencida: "danger",
  prematriculada: "info",
  cursando: "progress",
  reprobada: "danger",
  borrador: "neutral",
  confirmada: "success",
  descartada: "neutral",
  sin_asignar: "neutral",
  en_riesgo: "danger",
  por_vencer: "warning",
  liquidez_baja: "warning",
  prueba_academica: "warning",
  error: "danger",
  procesando: "progress",
  contabilizado: "success",
  contabilizada: "success",
  anulado: "neutral",
  anulada: "neutral",
  vigente: "success",
  reverso: "progress",
  emitido: "info",
  cobrado: "success",
  cobrada: "success",
  pagada: "success",
  pagado: "success",
  pagada_parcial: "warning",
  recibido: "info",
  validado: "success",
  observado: "warning",
  abierto: "info",
  abierta: "info",
  cerrado: "done",
  cerrada: "done",
  cumplida: "success",
  facturada: "info",
  generada: "info",
  presentada: "success",
  aplicado: "success",
  licencia: "warning",
  desvinculado: "neutral",
  totalmente_depreciado: "neutral",
  baja: "neutral",
  donado: "neutral",
  traspasado: "neutral",
  operativo: "success",
  mantenimiento: "warning",
  prestado: "info",
  averiado: "danger",
  auditada: "done",
  finalizado: "done",
  sin_identificar: "neutral",
  sin_patrocinador: "neutral",
  retenido: "warning",
  reenviado: "info",
  duplicado: "neutral",
  repetido: "neutral",
  cumplio: "success",
  tardia: "warning",
  no_envio: "danger",
  no_aplica: "neutral",
  enviado: "success",
  fallido: "danger",
  propuesta: "info",
  ejecutada: "success",
  fallida: "danger",
} as const satisfies Record<string, TokenEstado>;

export type EstadoConocido = keyof typeof MAPA_ESTADOS;

export const esEstadoConocido = (valor: string): valor is EstadoConocido => Object.hasOwn(MAPA_ESTADOS, valor);

/** Token de un estado; lo que no está en el mapa cae en `neutral` en vez de romper la pantalla. */
export const tokenDeEstado = (valor: string): TokenEstado => (esEstadoConocido(valor) ? MAPA_ESTADOS[valor] : "neutral");
