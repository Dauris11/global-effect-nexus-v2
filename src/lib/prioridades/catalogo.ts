import type { TipoPrioridad } from "@/lib/prioridades/types";

/**
 * A qué módulo pertenece cada tipo de pendiente. Sirve para agrupar las casillas de «Qué
 * atiende» y para el icono/color del ítem. La etiqueta humana de cada tipo vive en
 * `messages/*.json` → `priorities.types.<tipo>` (nunca el identificador técnico en pantalla).
 */
export const MODULO_DE_TIPO: Record<TipoPrioridad, string> = {
  solicitud_por_decidir: "solicitudes",
  solicitud_pendiente_direccion: "solicitudes",
  mi_solicitud_respondida: "solicitudes",
  tarea_vencida: "tareas",
  tarea_hoy: "tareas",
  tarea_semana: "tareas",
  proyecto_atrasado: "proyectos",
  alta_expediente_por_revisar: "expedientes",
  expediente_incompleto: "expedientes",
  estudiante_en_riesgo_nuevo: "expedientes",
  becado_sin_patrocinador: "expedientes",
  renovacion_beca: "expedientes",
  carta_mensual_pendiente: "patrocinadores",
  compromiso_por_vencer: "patrocinadores",
  calificaciones_por_subir: "academico",
  prematricula_sin_elegir: "academico",
  clase_sin_docente: "academico",
  servicio_mensual_incumplido: "servicios",
  reunion_mensual_pendiente: "servicios",
  activo_en_mantenimiento_vencido: "inventario",
  prestamo_vencido: "inventario",
  comprobante_por_validar: "contabilidad",
  asiento_sin_procesar: "contabilidad",
  cxp_vencida: "contabilidad",
  cxp_por_vencer: "contabilidad",
  caja_chica_baja: "contabilidad",
  conciliacion_pendiente: "contabilidad",
  cierre_mes_pendiente: "contabilidad",
  compra_aprobada_por_pagar: "contabilidad",
  liquidez_negativa: "contabilidad",
  entrega_por_calificar: "docencia",
  nota_final_pendiente: "docencia",
  asistencia_hoy: "docencia",
  tarea_por_entregar: "estudiante",
  materia_por_elegir: "estudiante",
  servicio_del_mes: "estudiante",
  reunion_del_mes: "estudiante",
  visita_hoy: "habitudes",
  visita_semana: "habitudes",
  evidencia_faltante: "habitudes",
  viaje_del_turno: "transporte",
};

export const MODULOS = [...new Set(Object.values(MODULO_DE_TIPO))];

export const tiposDelModulo = (modulo: string): TipoPrioridad[] =>
  (Object.keys(MODULO_DE_TIPO) as TipoPrioridad[]).filter((t) => MODULO_DE_TIPO[t] === modulo);
