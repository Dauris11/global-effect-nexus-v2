/**
 * Modelo del motor de prioridades. Es lo único que comparten el servidor (que arma la
 * lista) y la pantalla (que la dibuja), así que no importa nada de `pg`.
 */

export type Severidad = "vencido" | "hoy" | "pronto" | "normal";

export const TIPOS_PRIORIDAD = [
  // solicitudes
  "solicitud_por_decidir",
  "solicitud_pendiente_direccion",
  "mi_solicitud_respondida",
  // tareas
  "tarea_vencida",
  "tarea_hoy",
  "tarea_semana",
  // proyectos
  "proyecto_atrasado",
  // expedientes
  "alta_expediente_por_revisar",
  "expediente_incompleto",
  "estudiante_en_riesgo_nuevo",
  "becado_sin_patrocinador",
  "renovacion_beca",
  // patrocinadores
  "carta_mensual_pendiente",
  "compromiso_por_vencer",
  // académico
  "calificaciones_por_subir",
  "prematricula_sin_elegir",
  "clase_sin_docente",
  // servicios
  "servicio_mensual_incumplido",
  "reunion_mensual_pendiente",
  // inventario
  "activo_en_mantenimiento_vencido",
  "prestamo_vencido",
  // contabilidad
  "comprobante_por_validar",
  "asiento_sin_procesar",
  "cxp_vencida",
  "cxp_por_vencer",
  "caja_chica_baja",
  "conciliacion_pendiente",
  "cierre_mes_pendiente",
  "compra_aprobada_por_pagar",
  "liquidez_negativa",
  // docencia
  "entrega_por_calificar",
  "nota_final_pendiente",
  "asistencia_hoy",
  // estudiante
  "tarea_por_entregar",
  "materia_por_elegir",
  "servicio_del_mes",
  "reunion_del_mes",
  // habitudes
  "visita_hoy",
  "visita_semana",
  "evidencia_faltante",
  // transporte
  "viaje_del_turno",
  // técnicas: SOLO las recibe el developer (módulo «tecnico»)
  "error_produccion",
  "job_fallido",
  "integracion_caida",
] as const;

export type TipoPrioridad = (typeof TIPOS_PRIORIDAD)[number];

export type PrioridadTarea = "urgente" | "alta" | "media" | "baja";

export interface PrioridadItem {
  /** `${tipo}:${entidadId}` */
  id: string;
  tipo: TipoPrioridad;
  /** Verbo + objeto: «Aprobar carta de recomendación». */
  titulo: string;
  /** «Solicitud #4 · Yeimy Rodríguez». */
  contexto: string;
  /** Para el icono y el color del módulo. */
  modulo: string;
  href: string;
  venceEn?: Date;
  /** Se calcula (`calcular` en score.ts). */
  severidad: Severidad;
  /** Se calcula. */
  score: number;
  accion: { label: string; kind: "inline" | "panel" | "link"; action?: string };
  accionSecundaria?: { label: string; action: string };
  responsableId?: string;
  /** Lo que yo pedí o asigné y espera a otra persona. */
  esperandoA?: string;

  // Insumos del score y de la visibilidad que el contrato no nombra, pero que hacen falta:
  /** Fecha de creación: +1 punto por día de antigüedad (máx. 20). */
  creadoEn?: Date;
  /** Alguien espera MI decisión (+30). */
  bloquea?: boolean;
  /** Prioridad de la tarea (urgente +40, alta +20, media +5). */
  prioridadTarea?: PrioridadTarea;
  /** Subtipo de la entidad (p. ej. el tipo de solicitud), para filtros finos por rol. */
  subtipo?: string;
  /** Monto en USD, para el umbral de dirección. */
  montoUsd?: number;
  /** Cuántas cosas agrupa el ítem (p. ej. entregas de una tarea), para frases como «12 entregas en 2 clases». */
  cantidad?: number;
  /** A qué clase/grupo pertenece, para contar grupos distintos. */
  grupoClave?: string;
  /** Nombre natural de la clase/proyecto/persona al que pertenece el ítem («Liderazgo I»). Solo se agrupa por él; si falta, el ítem va suelto. */
  contextoGrupo?: string;
  /** Marcado por el motor: ítem de otro responsable con más de 3 días vencido (lo ve dirección). */
  escalado?: boolean;
}

export interface ContextoPrioridades {
  userId: string;
  rol: string;
  /** Tipos que esta persona atiende (ya resueltos: personalizados o de fábrica). */
  responsabilidades: ReadonlySet<TipoPrioridad>;
  /** Día RD de hoy, `YYYY-MM-DD`. */
  hoy: string;
}

export type GrupoPrioridad = "vencido" | "hoy" | "semana" | "adelante";

export interface ListaPrioridades {
  grupos: Record<GrupoPrioridad, PrioridadItem[]>;
  esperando: PrioridadItem[];
  total: number;
}
