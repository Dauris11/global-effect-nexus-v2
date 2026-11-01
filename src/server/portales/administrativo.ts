import { consultarUna } from "@/lib/db";

/**
 * Lo que espera una decisión en toda la Fundación, para la bandeja.
 *
 * Una cifra dice cómo va algo; un pendiente dice que alguien está esperando.
 * Todo se cuenta en una sola consulta con subconsultas: una por módulo serían
 * seis viajes al pooler para pintar la pantalla de entrada.
 */

export type PendientesFundacion = {
  /** Tareas urgentes o de prioridad alta que siguen abiertas. */
  tareas_urgentes: number;
  /** Tareas cuya fecha límite ya pasó y no están cerradas. */
  tareas_vencidas: number;
  /** Entregas del aula virtual esperando nota. */
  entregas_por_revisar: number;
  /** Becados activos sin ninguna beca vigente. */
  becados_sin_patrocinador: number;
  /** Períodos cuyo estado se contradice con sus fechas. */
  periodos_incoherentes: number;
  /** Materias sin período: no se pueden matricular ni situar en el tiempo. */
  materias_sin_periodo: number;
};

/**
 * Lo que espera por una decisión, en todos los módulos.
 *
 * Cada cifra corresponde a algo que alguien tiene que ir a resolver, y por eso
 * ninguna es "cuántos hay": son "cuántos faltan". Un cero aquí es una buena
 * noticia, que es justo lo contrario de lo que significa un cero en las cifras.
 *
 * `periodos_incoherentes` repite el criterio de `/academico/periodos`
 * —comparar el estado contra `CURRENT_DATE`— y se calcula igual, en la base.
 * Es la única duplicación de esta clase que hay aquí, y se hace porque el
 * portal tiene que poder contar sin traerse la lista entera de períodos.
 */
export async function pendientesDeLaFundacion(): Promise<PendientesFundacion> {
  const fila = await consultarUna<PendientesFundacion>(
    `SELECT (SELECT count(*)::int FROM tarea
              WHERE estado IN ('pendiente', 'en_progreso')
                AND prioridad IN ('urgente', 'alta')) AS tareas_urgentes,
            (SELECT count(*)::int FROM tarea
              WHERE estado IN ('pendiente', 'en_progreso')
                AND fecha_limite IS NOT NULL
                AND fecha_limite < CURRENT_DATE) AS tareas_vencidas,
            (SELECT count(*)::int FROM entrega_estudiante
              WHERE estado IN ('entregado', 'tarde')) AS entregas_por_revisar,
            (SELECT count(*)::int FROM estudiante e
              WHERE e.tipo = 'becado' AND e.estado = 'activo'
                AND NOT EXISTS (SELECT 1 FROM asignacion_beca a
                                 WHERE a.estudiante_id = e.id
                                   AND a.estado = 'activo')) AS becados_sin_patrocinador,
            (SELECT count(*)::int FROM periodo p
              WHERE (p.estado = 'activo'      AND CURRENT_DATE >  p.fecha_fin)
                 OR (p.estado = 'planificado' AND CURRENT_DATE >= p.fecha_inicio)) AS periodos_incoherentes,
            (SELECT count(*)::int FROM materia
              WHERE periodo_id IS NULL AND estado = 'activa') AS materias_sin_periodo`,
  );

  return (
    fila ?? {
      tareas_urgentes: 0, tareas_vencidas: 0, entregas_por_revisar: 0,
      becados_sin_patrocinador: 0, periodos_incoherentes: 0,
      materias_sin_periodo: 0,
    }
  );
}
