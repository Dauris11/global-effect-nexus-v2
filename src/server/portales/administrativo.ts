import { consultar, consultarUna } from "@/lib/db";

/**
 * El portal administrativo: todo lo que pasa en la Fundación, en una pantalla.
 *
 * NO ES UN PANEL DE OPERACIONES MÁS, y conviene decirlo porque es fácil
 * construirlo como si lo fuera. Este portal es donde converge el sistema
 * entero: absorbe lo que ocurre en los portales de estudiante, profesor,
 * contabilidad y las solicitudes, no solo lo de tareas y proyectos.
 *
 * Se apoya en cuatro cosas distintas y cada una responde a una pregunta:
 *
 *   · CIFRAS      — "¿cuánto hay?"          `cifrasDeLaFundacion`
 *   · PENDIENTES  — "¿qué espera por mí?"   `pendientesDeLaFundacion`
 *   · ACCESOS     — "¿por dónde entro?"     se derivan de `src/lib/nav.ts`
 *   · ACTIVIDAD   — "¿qué acaba de pasar?"  `actividadReciente`
 *
 * LOS PENDIENTES SON LO IMPORTANTE. Una cifra dice cómo va algo; un pendiente
 * dice que alguien está esperando. Por eso van arriba y por eso cada uno lleva
 * el enlace a la pantalla donde se resuelve: un aviso que no se puede accionar
 * es decoración.
 *
 * TODO SE CUENTA EN UNA SOLA CONSULTA por bloque, con subconsultas, en vez de
 * una por módulo. Son doce cifras de doce tablas: doce viajes al pooler para
 * pintar una pantalla de entrada es justo lo que hace que una pantalla de
 * entrada se sienta lenta.
 */

export type CifrasFundacion = {
  estudiantes: number;
  becados: number;
  /** Materias del catálogo de Global Effect 360 abiertas. */
  clases_360: number;
  materias: number;
  /** Notas finales de 360 ya puestas. */
  notas: number;
  proyectos: number;
  tareas_abiertas: number;
  patrocinadores: number;
  aporte_mensual: number;
  comensales_hoy: number;
  /** Solicitudes que siguen en el flujo, de cualquier tipo. */
  solicitudes_abiertas: number;
  usuarios: number;
};

/** Las cifras de todos los módulos, de una vez. */
export async function cifrasDeLaFundacion(): Promise<CifrasFundacion> {
  const fila = await consultarUna<CifrasFundacion>(
    `SELECT (SELECT count(*)::int FROM estudiante WHERE estado = 'activo') AS estudiantes,
            (SELECT count(*)::int FROM estudiante WHERE tipo = 'becado' AND estado = 'activo') AS becados,
            (SELECT count(*)::int FROM materia_360 WHERE activa) AS clases_360,
            (SELECT count(*)::int FROM materia WHERE estado = 'activa') AS materias,
            -- La retirada no cuenta aunque guardara nota: se dio de baja.
            (SELECT count(*)::int FROM inscripcion_360
              WHERE nota IS NOT NULL AND estado <> 'retirada') AS notas,
            (SELECT count(*)::int FROM proyecto WHERE estado = 'en_curso') AS proyectos,
            (SELECT count(*)::int FROM tarea
              WHERE estado IN ('pendiente', 'en_progreso')) AS tareas_abiertas,
            (SELECT count(*)::int FROM patrocinador WHERE estado = 'activo') AS patrocinadores,
            (SELECT coalesce(sum(monto_mensual), 0)::float8 FROM patrocinador
              WHERE estado = 'activo') AS aporte_mensual,
            (SELECT count(*)::int FROM inscripcion_comida
              WHERE fecha = CURRENT_DATE) AS comensales_hoy,
            (SELECT count(*)::int FROM solicitud
              WHERE estado IN ('enviada', 'en_revision',
                               'pendiente_direccion', 'aprobada')) AS solicitudes_abiertas,
            (SELECT count(*)::int FROM usuario WHERE activo) AS usuarios`,
  );

  return (
    fila ?? {
      estudiantes: 0, becados: 0, clases_360: 0, materias: 0, notas: 0,
      proyectos: 0, tareas_abiertas: 0, patrocinadores: 0, aporte_mensual: 0,
      comensales_hoy: 0, solicitudes_abiertas: 0, usuarios: 0,
    }
  );
}

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

export type TrazaReciente = {
  id: string;
  accion: string;
  entidad: string;
  quien: string | null;
  created_at: Date;
};

/**
 * Lo último que ha pasado en el sistema.
 *
 * PRIMERA PANTALLA QUE LEE `audit_log`. La tabla se escribe desde las
 * solicitudes, los anuncios del inicio, expedientes, el catálogo académico, las tareas y el
 * patrocinio, y hasta ahora no había forma de leerla salvo por SQL directo.
 *
 * NO se devuelve la columna `datos`. Ahí va el detalle de cada cambio —incluida
 * la nota de una calificación o el folio de una solicitud— y una tira de actividad
 * en la pantalla de entrada no es el sitio para eso: se dice QUÉ pasó y QUIÉN
 * lo hizo, y el detalle queda para la pantalla de auditoría, que es donde se
 * entra a propósito.
 */
export async function actividadReciente(limite = 8): Promise<TrazaReciente[]> {
  return consultar<TrazaReciente>(
    `SELECT a.id,
            a.accion,
            a.entidad,
            u.nombre AS quien,
            a.created_at
       FROM audit_log a
       LEFT JOIN usuario u ON u.id = a.usuario_id
      ORDER BY a.created_at DESC
      LIMIT $1`,
    [limite],
  );
}
