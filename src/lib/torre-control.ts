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

export const ROLES_ASIGNABLES_PROYECTO = [
  "admin",
  "docente",
  "contabilidad",
  "habitudes",
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
