import { horaLegible, type ValoresParametros } from "@/lib/parametros";
import { parametros } from "@/server/parametros/consultas";

/**
 * Reglas normativas y académicas institucionales de la Fundación Global Effect
 * para enriquecer lo que sabe el asistente.
 *
 * Los números (índice mínimo, asistencia, horas de servicio, nota de 360, horario
 * del comedor) NO están escritos: salen de los parámetros institucionales
 * (`/configuracion/parametros`). Si coordinación cambia una regla de la beca, el
 * asistente deja de repetir la anterior en la siguiente pregunta, sin tocar el
 * código ni tener un segundo texto que quedarse viejo.
 */
export function reglamento(p: ValoresParametros): string {
  return `
REGLAMENTO INSTITUCIONAL Y POLÍTICA DE BECAS (FUNDACIÓN GLOBAL EFFECT - LA VEGA, RD):
1. REQUISITOS DE PERMANENCIA EN LA BECA:
   - Becados Universitarios: Mantener un índice académico (GPA) igual o superior a ${p["becas.indice_minimo"]} sobre 4.00.
   - Global Effect 360: Calificación mínima aprobatoria de ${p["becas.nota_minima_360"]} puntos en cada materia.
   - Asistencia a Clases y Talleres: Mínimo ${p["becas.asistencia_minima"]}% de asistencia obligatoria. Las faltas injustificadas ponen en riesgo la beca.
   - Servicio Comunitario Mensual: ${p["becas.horas_servicio_mes"]} horas mensuales obligatorias en proyectos aprobados por la Fundación.
   - Reuniones Mensuales Generales: Asistencia obligatoria el primer fin de semana de cada mes.

2. ASIGNATURAS REPROBADAS Y OBSERVACIÓN:
   - Si un estudiante reprueba una materia o su índice cae por debajo de ${p["becas.indice_minimo"]}, entra automáticamente en «Observación Académica».
   - Debe cumplir un plan de tutorías y acompañamiento con el equipo académico. Dos cuatrimestres consecutivos en observación requieren revisión por el Comité de Becas.

3. TRÁMITES Y SOLICITUDES:
   - Para constancias de estudio, cartas de recomendación laboral/universitaria, permisos de ausencia justificadas o citas con Dirección/Coordinación, el estudiante debe realizarlas desde «Mis solicitudes» (/portal/estudiante/solicitudes).
   - No se tramitan solicitudes por mensajería informal.

4. ALIMENTACIÓN Y SERVICIOS EN EL CAMPUS:
   - El almuerzo en la Fundación requiere inscripción previa en «Inscripción de comida» (/inscripcion-comida), de ${horaLegible(p["comedor.apertura"])} a ${horaLegible(p["comedor.cierre"])}.

5. GLOBAL EFFECT 360:
   - Programa integral de formación en liderazgo, carácter, habilidades técnicas y valores que acompaña los estudios universitarios.
   - Lo cursan todos los becados. Todas sus materias son obligatorias: una por tanda, dos tandas por cuatrimestre.
`;
}

/** El reglamento con los parámetros vigentes. */
export async function reglamentoActual(): Promise<string> {
  return reglamento(await parametros());
}
