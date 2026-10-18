/**
 * Tipos y constantes para la Agenda Institucional de Reuniones.
 *
 * Reemplazo institucional del antiguo módulo de psicología:
 * Gestión de reuniones tanto para el personal interno como para estudiantes.
 */

export const TIPOS_REUNION = [
  "coordinacion",
  "seguimiento_estudiante",
  "departamental",
  "direccion",
  "tutoria",
  "general",
] as const;

export type TipoReunion = (typeof TIPOS_REUNION)[number];

export const MODALIDADES_REUNION = ["presencial", "virtual", "hibrida"] as const;
export type ModalidadReunion = (typeof MODALIDADES_REUNION)[number];

export const ESTADOS_REUNION = [
  "programada",
  "en_curso",
  "realizada",
  "cancelada",
  "reprogramada",
] as const;
export type EstadoReunion = (typeof ESTADOS_REUNION)[number];

export const ROLES_EN_REUNION = [
  "anfitrion",
  "participante",
  "invitado",
  "secretario",
] as const;
export type RolEnReunion = (typeof ROLES_EN_REUNION)[number];

export const ASISTENCIAS_REUNION = [
  "pendiente",
  "confirmada",
  "asistio",
  "ausente",
  "justificada",
] as const;
export type AsistenciaReunion = (typeof ASISTENCIAS_REUNION)[number];

export type ReunionParticipante = {
  id: string;
  reunion_id: string;
  usuario_id: string | null;
  estudiante_id: string | null;
  rol_en_reunion: RolEnReunion;
  asistencia: AsistenciaReunion;
  nota: string | null;
  nombre: string;
  email: string | null;
  tipo_participante: "personal" | "estudiante";
};

export type Reunion = {
  id: string;
  folio: number;
  titulo: string;
  descripcion: string | null;
  tipo: TipoReunion;
  modalidad: ModalidadReunion;
  lugar_o_enlace: string | null;
  fecha: string; // YYYY-MM-DD
  hora_inicio: string; // HH:MM
  hora_fin: string; // HH:MM
  organizador_usuario_id: string;
  organizador_nombre: string;
  organizador_email: string;
  estudiante_id: string | null;
  estudiante_nombre: string | null;
  estado: EstadoReunion;
  conclusiones_o_minuta: string | null;
  participantes?: ReunionParticipante[];
  creado_en: string;
  actualizado_en: string;
};

export type MetricasReuniones = {
  total_reuniones: number;
  programadas: number;
  realizadas_mes: number;
  total_participantes: number;
};

export type CandidatoParticipante = {
  id: string;
  nombre: string;
  email: string;
  tipo: "personal" | "estudiante";
  detalle_rol?: string;
};
