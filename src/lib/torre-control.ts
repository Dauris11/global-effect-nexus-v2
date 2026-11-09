/**
 * Vocabulario y tipos compartidos para la Torre de Control del Colaborador
 * ("Lo que me toca hoy"), Asignación de Proyectos por Rol y Rendición de Gastos con OCR.
 *
 * Vive en `src/lib/` para que los componentes de cliente y servidor
 * puedan compartir tipos y constantes sin importar librerías de servidor (`pg`, etc.).
 */

export const ESTADOS_TAREA_COLABORADOR = [
  "por_hacer",
  "en_progreso",
  "en_revision",
  "completada",
] as const;

export type EstadoTareaColaborador = (typeof ESTADOS_TAREA_COLABORADOR)[number];

export const PRIORIDADES_TAREA = ["baja", "media", "alta", "urgente"] as const;
export type PrioridadTarea = (typeof PRIORIDADES_TAREA)[number];

export const ESTADOS_RENDICION = [
  "enviada",
  "en_revision",
  "aprobada",
  "rechazada",
  "contabilizada",
] as const;

export type EstadoRendicion = (typeof ESTADOS_RENDICION)[number];

// Debe coincidir con el CHECK de `proyecto_rol` (migración 0075).
export const ROLES_ASIGNABLES_PROYECTO = [
  "admin",
  "docente",
  "contabilidad",
  "habitudes",
  "dir_habitudes",
  "chofer",
] as const;

export type RolAsignableProyecto = (typeof ROLES_ASIGNABLES_PROYECTO)[number];

export interface TareaColaborador {
  id: string;
  titulo: string;
  descripcion: string | null;
  estado: EstadoTareaColaborador;
  prioridad: PrioridadTarea;
  visibilidad: string;
  fecha_limite: string | null;
  proyecto_id: string | null;
  proyecto_nombre: string | null;
  vencida: boolean;
  es_hoy: boolean;
  creado_en: string;
}

export interface ProyectoAsignadoRol {
  proyecto_id: string;
  proyecto_nombre: string;
  proyecto_descripcion: string | null;
  proyecto_estado: string;
  roles: RolAsignableProyecto[];
}

export interface BitacoraEntrada {
  id: string;
  usuario_id: string;
  fecha: string;
  descripcion: string;
  tarea_id: string | null;
  tarea_titulo: string | null;
  minutos_dedicados: number;
  creado_en: string;
}

export interface RendicionGastoItem {
  id: string;
  codigo: string;
  empleado_id: string;
  empleado_nombre: string;
  empleado_email: string;
  programa_id: string | null;
  programa_nombre: string | null;
  proveedor_nombre: string;
  proveedor_rnc: string | null;
  ncf: string | null;
  fecha_comprobante: string;
  moneda: string;
  monto_total: number;
  monto_itbis: number;
  concepto: string;
  comprobante_url: string | null;
  ocr_data: Record<string, unknown> | null;
  estado: EstadoRendicion;
  motivo_rechazo: string | null;
  revisado_por_nombre: string | null;
  revisado_en: string | null;
  creado_en: string;
}

/*
 * ---------------------------------------------------------------------------
 * Torre de control por usuario (0063)
 * ---------------------------------------------------------------------------
 * Lo de arriba es la jornada del colaborador; lo de aquí es la torre: lo que
 * una PERSONA tiene asignado, con plazos y avance, y la vista de carga de todo
 * el equipo para administración.
 */

/** Filtros de la lista de tareas de la torre, en el orden de los chips. */
export const FILTROS_TORRE = [
  "abiertas",
  "vencidas",
  "hoy",
  "semana",
  "sin_fecha",
  "completadas",
] as const;

export type FiltroTorre = (typeof FILTROS_TORRE)[number];

/** Pasos del selector de avance: de cuarto en cuarto basta para coordinar. */
export const PASOS_PROGRESO = [0, 25, 50, 75, 100] as const;

/**
 * Con cuántas tareas abiertas una persona se marca como sobrecargada.
 * Es un umbral de conversación, no de nómina: sirve para mirar a quién
 * repartirle menos.
 */
export const UMBRAL_CARGA_ALTA = 8;

export interface TareaTorre {
  id: string;
  titulo: string;
  descripcion: string | null;
  /** Ya normalizado: `pendiente` (heredado) llega como `por_hacer`. */
  estado: EstadoTareaColaborador;
  prioridad: PrioridadTarea;
  fecha_inicio: string | null;
  fecha_limite: string | null;
  progreso: number;
  horas_estimadas: number;
  proyecto_id: string | null;
  proyecto_nombre: string | null;
  asignados: string | null;
  asignados_ids: string[];
  comentarios: number;
  vencida: boolean;
  es_hoy: boolean;
  esta_semana: boolean;
}

export interface ProyectoTorre {
  id: string;
  nombre: string;
  estado: string;
  fecha_fin: string | null;
  responsable_nombre: string | null;
  es_responsable: boolean;
  tareas: number;
  hechas: number;
  mis_abiertas: number;
}

export interface CargaPersona {
  usuario_id: string;
  nombre: string;
  rol: string;
  abiertas: number;
  en_progreso: number;
  vencidas: number;
  hoy: number;
  semana: number;
  horas_pendientes: number;
  completadas_7d: number;
  /** Media de `progreso` de lo abierto, 0-100. */
  progreso_medio: number;
  proyectos: number;
}

export interface ComentarioTarea {
  id: string;
  autor: string | null;
  texto: string;
  creado_en: string;
}

export interface PersonaTorre {
  id: string;
  nombre: string;
  rol: string;
}

/** El filtro se decide en el cliente: la lista ya viene acotada a la persona. */
export function filtrarTareasTorre(
  tareas: readonly TareaTorre[],
  filtro: FiltroTorre,
): TareaTorre[] {
  return tareas.filter((t) => {
    const abierta = t.estado !== "completada";
    switch (filtro) {
      case "abiertas":
        return abierta;
      case "vencidas":
        return t.vencida;
      case "hoy":
        return abierta && t.es_hoy;
      case "semana":
        return abierta && t.esta_semana;
      case "sin_fecha":
        return abierta && !t.fecha_limite;
      case "completadas":
        return !abierta;
    }
  });
}
