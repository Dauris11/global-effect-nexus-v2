import { MODULO_DE_TIPO } from "@/lib/prioridades/catalogo";
import type { TipoPrioridad } from "@/lib/prioridades/types";
import type { Rol } from "@/lib/rbac";

/**
 * Reparto de fábrica de «qué atiende» cada rol (la tabla `responsabilidades_personal` lo
 * personaliza por persona). Es la regla del encargo, no una conveniencia de la pantalla:
 * dos administrativos con casillas distintas ven listas distintas.
 */

/** Lo que ve TODA persona, sin casillas: lo suyo propio. */
export const UNIVERSALES: readonly TipoPrioridad[] = [
  "tarea_vencida",
  "tarea_hoy",
  "tarea_semana",
  "proyecto_atrasado",
  "mi_solicitud_respondida",
];

const delModulo = (m: string) => (Object.keys(MODULO_DE_TIPO) as TipoPrioridad[]).filter((t) => MODULO_DE_TIPO[t] === m);

export const DEFAULTS_POR_ROL: Record<Rol, readonly TipoPrioridad[]> = {
  // developer NO recibe prioridades de negocio (eso es de dirección): solo las técnicas. Para ver lo de dirección
  // usa «Ver como Propietario».
  developer: delModulo("tecnico"),
  owner: [
    "solicitud_pendiente_direccion",
    "renovacion_beca",
    "compra_aprobada_por_pagar",
    "estudiante_en_riesgo_nuevo",
    "proyecto_atrasado",
    "liquidez_negativa",
  ],
  admin: [
    "solicitud_por_decidir",
    "alta_expediente_por_revisar",
    "expediente_incompleto",
    "becado_sin_patrocinador",
    "carta_mensual_pendiente",
    "calificaciones_por_subir",
    "prematricula_sin_elegir",
    "clase_sin_docente",
    "servicio_mensual_incumplido",
    "activo_en_mantenimiento_vencido",
    "prestamo_vencido",
  ],
  // `solicitud_por_decidir` va aparte: contabilidad solo la ve si es Compra/Gasto (visibilidad.ts).
  contabilidad: [...delModulo("contabilidad"), "solicitud_por_decidir"],
  docente: delModulo("docencia"),
  estudiante: delModulo("estudiante"),
  habitudes: delModulo("habitudes"),
  dir_habitudes: delModulo("habitudes"),
  chofer: delModulo("transporte"),
};

/** Tipos que dirección ve de TODAS las personas, aunque tengan responsable. */
export const DIRECCION_VE_DE_TODOS: readonly TipoPrioridad[] = ["proyecto_atrasado"];

/** Tipos de solicitud que contabilidad atiende (los demás son de administración). */
export const SOLICITUDES_DE_CONTABILIDAD: readonly string[] = ["compra", "gasto"];

/** Días vencido a partir de los cuales un ítem de otra persona escala a dirección. */
export const DIAS_PARA_ESCALAR = 3;

/** Monto (USD) desde el cual una compra aprobada llega a dirección. Pendiente de exponer en Parámetros. */
export const UMBRAL_COMPRA_DIRECCION_USD = 1000;

/** Fila marcador: la persona ya fue personalizada; rige solo lo marcado. */
export const MARCADOR_CONFIGURADO = "__configurado__";

export function responsabilidadesPorDefecto(rol: Rol): ReadonlySet<TipoPrioridad> {
  return new Set(DEFAULTS_POR_ROL[rol] ?? []);
}
