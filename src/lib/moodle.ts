/**
 * Tipos y constantes compartidas para el Aula Virtual estilo Moodle y el
 * catálogo de matrícula de Global Effect 360 (una materia por tanda, dos tandas
 * por cuatrimestre).
 *
 * Sigue la regla del proyecto: cero dependencias de Node.js o pg en src/lib.
 */

export const FORMATOS_ARCHIVOS_COMUNES = [
  "pdf",
  "docx",
  "xlsx",
  "pptx",
  "zip",
  "tar.gz",
  "jpg",
  "png",
] as const;

export type FormatoArchivoComun = (typeof FORMATOS_ARCHIVOS_COMUNES)[number];

export const ESTADOS_ENTREGA_MOODLE = [
  "pendiente",
  "entregado",
  "calificado",
  "tarde",
] as const;

export type EstadoEntregaMoodle = (typeof ESTADOS_ENTREGA_MOODLE)[number];

export interface AsignacionMoodleDetalle {
  id: string;
  titulo: string;
  descripcion: string | null;
  tipo: "tarea" | "examen" | "material" | "anuncio";
  archivo_url: string | null;
  fecha_publicacion: string;
  fecha_vencimiento: string | null;
  limite_mb: number;
  formatos_permitidos: string[];
  puntaje_maximo: number;
  permite_entregas_tardias: boolean;
  instrucciones_entrega: string | null;
  materia_nombre: string;
  materia_codigo: string | null;
  docente_nombre: string | null;
  vencida: boolean;
  // Metadatos de la entrega del estudiante si existe
  entrega_id: string | null;
  entrega_estado: EstadoEntregaMoodle;
  entrega_archivo_url: string | null;
  entrega_archivo_nombre: string | null;
  entrega_archivo_tamano_mb: number | null;
  entrega_archivo_formato: string | null;
  entrega_texto_respuesta?: string | null;
  entrega_fecha: string | null;
  entrega_comentario_estudiante: string | null;
  calificacion: number | null;
  comentario_profesor: string | null;
  revisada_por_nombre: string | null;
  revisada_en: string | null;
}

export interface FilaEntregaDocente {
  entrega_id: string;
  estudiante_id: string;
  estudiante_nombre: string;
  estudiante_matricula: string | null;
  estudiante_email: string | null;
  estado: EstadoEntregaMoodle;
  archivo_url: string | null;
  archivo_nombre: string | null;
  archivo_tamano_mb: number | null;
  archivo_formato: string | null;
  fecha_entrega: string | null;
  comentario_estudiante: string | null;
  calificacion: number | null;
  comentario_profesor: string | null;
  es_tarde: boolean;
}

export interface Materia360Matricula {
  id: string;
  nombre: string;
  codigo: string | null;
  descripcion: string | null;
  creditos: number;
  horas: number | null;
  horario: string | null;
  aula: string | null;
  cupo_maximo: number;
  cupo_ocupado: number;
  docente_nombre: string | null;
  inscrita: boolean;
  inscripcion_id: string | null;
  ronda_inscrita: number | null;
  estado_inscripcion: string | null;
  /** Ya la aprobó en algún período: no se le vuelve a ofrecer. */
  aprobada: boolean;
}
