import { consultar, consultarUna } from "@/lib/db";
import {
  flujoMensual,
  resumenDelMesEnCurso,
  type MesFinanciero,
} from "@/server/finanzas/consultas";

/**
 * Datos del panel general de administración.
 *
 * Todo se pide en agregados o en listas cortas: el panel resume, y una consulta
 * que se traiga mil filas para contar cuántas hay es una consulta mal escrita.
 *
 * Nada de aquí filtra por permiso. El permiso se comprueba en la página, que es
 * la que decide qué bloques pide; lo que no se puede ver, no se consulta.
 */

/** Estados de una tarea que siguen abiertos. */
const ABIERTAS = ["pendiente", "en_progreso"];

export type CifrasPanel = {
  universitarios: number;
  /** Estudiantes con una materia de Global Effect 360 en curso ahora. */
  cursando360: number;
  /** Materias del catálogo de 360 abiertas. */
  materias360: number;
  proyectos: number;
  tareas: number;
  patrocinadores: number;
  reclutamiento: number;
};

/**
 * Las cifras de cabecera, en una sola consulta.
 *
 * Siete subconsultas en un viaje en vez de siete viajes: son todas `count(*)`
 * sobre tablas distintas y el pooler cobra por ida y vuelta, no por subconsulta.
 *
 * Las dos cifras de 360 ocupan el sitio de las del curso técnico, retirado en
 * la 0047. "Cursando" cuenta personas y no inscripciones: con una materia por
 * tanda coinciden casi siempre, pero el panel pregunta a cuántos atendemos.
 */
export async function cifrasPanel(): Promise<CifrasPanel> {
  const fila = await consultarUna<CifrasPanel>(
    `SELECT (SELECT count(*)::int FROM estudiante
              WHERE estado = 'activo' AND tipo = 'becado')          AS universitarios,
            (SELECT count(DISTINCT estudiante_id)::int FROM inscripcion_360
              WHERE estado = 'cursando')                            AS "cursando360",
            (SELECT count(*)::int FROM materia_360
              WHERE activa)                                         AS "materias360",
            (SELECT count(*)::int FROM proyecto
              WHERE estado = 'en_curso')                            AS proyectos,
            (SELECT count(*)::int FROM tarea
              WHERE estado = ANY($1))                               AS tareas,
            (SELECT count(*)::int FROM patrocinador
              WHERE estado = 'activo')                              AS patrocinadores,
            -- Los cuatro primeros estados de estudiante son el embudo de
            -- reclutamiento, no gente que ya estudia: cuentan aparte.
            (SELECT count(*)::int FROM estudiante
              WHERE estado IN ('reclutado', 'postulado',
                               'academia_liderazgo', 'standby_tecnico')) AS reclutamiento`,
    [ABIERTAS],
  );

  return (
    fila ?? {
      universitarios: 0,
      cursando360: 0,
      materias360: 0,
      proyectos: 0,
      tareas: 0,
      patrocinadores: 0,
      reclutamiento: 0,
    }
  );
}

export type TareaPanel = {
  id: string;
  titulo: string;
  prioridad: string;
  estado: string;
  fecha_limite: string | null;
  /** Proyecto del que cuelga, si cuelga de alguno. */
  proyecto: string | null;
  /** Evento que la tarea generó, si generó alguno (`evento.tarea_id`). */
  evento: string | null;
  /** Nombres de quienes la tienen asignada, ya unidos. Vacío si nadie. */
  responsables: string | null;
};

/**
 * Tareas abiertas, de la más urgente a la que menos.
 *
 * Trae a quién le toca y de dónde sale, que es lo que convierte una lista de
 * títulos en algo con lo que se puede hacer algo. Los asignados son N:M
 * (`tarea_asignado`), así que se agregan; el evento va por subconsulta y no por
 * JOIN porque una tarea puede haber generado más de uno y un JOIN duplicaría la
 * tarea en la lista.
 *
 * El orden de prioridad se escribe a mano en un CASE: la columna es TEXT, no un
 * ENUM, así que alfabéticamente "urgente" iría al final, que es justo al revés.
 */
export async function tareasAbiertas(limite = 8): Promise<TareaPanel[]> {
  return consultar<TareaPanel>(
    `SELECT t.id,
            t.titulo,
            t.prioridad,
            t.estado,
            t.fecha_limite::text AS fecha_limite,
            p.nombre AS proyecto,
            (SELECT e.titulo FROM evento e
              WHERE e.tarea_id = t.id
              ORDER BY e.fecha
              LIMIT 1) AS evento,
            nullif(string_agg(u.nombre, ', ' ORDER BY u.nombre), '') AS responsables
       FROM tarea t
       LEFT JOIN proyecto       p  ON p.id = t.proyecto_id
       LEFT JOIN tarea_asignado ta ON ta.tarea_id = t.id
       LEFT JOIN usuario        u  ON u.id = ta.usuario_id
      WHERE t.estado = ANY($1)
      GROUP BY t.id, p.nombre
      ORDER BY CASE t.prioridad
                 WHEN 'urgente' THEN 0
                 WHEN 'alta'    THEN 1
                 WHEN 'media'   THEN 2
                 ELSE 3
               END,
               t.fecha_limite NULLS LAST,
               t.created_at
      LIMIT $2`,
    [ABIERTAS, limite],
  );
}

export type TareasPorPrioridad = { prioridad: string; total: number };

/** Cuántas tareas abiertas hay de cada prioridad, para la gráfica. */
export async function tareasPorPrioridad(): Promise<TareasPorPrioridad[]> {
  return consultar<TareasPorPrioridad>(
    `SELECT prioridad, count(*)::int AS total
       FROM tarea
      WHERE estado = ANY($1)
      GROUP BY prioridad`,
    [ABIERTAS],
  );
}

export type ProyectoPanel = {
  id: string;
  nombre: string;
  responsable: string | null;
  estado: string;
  progreso: number;
  fecha_fin: string | null;
  abiertas: number;
  total: number;
};

/**
 * Proyectos en marcha, con cuántas tareas les quedan abiertas.
 *
 * Se ordenan por tareas abiertas y no por fecha: el panel sirve para ver dónde
 * está el atasco, y el proyecto con doce cosas pendientes es lo que hay que
 * mirar primero, aunque su fecha de fin sea la más lejana.
 */
export async function proyectosEnMarcha(limite = 6): Promise<ProyectoPanel[]> {
  return consultar<ProyectoPanel>(
    `SELECT p.id,
            p.nombre,
            p.responsable,
            p.estado,
            coalesce(p.progreso, 0) AS progreso,
            p.fecha_fin::text AS fecha_fin,
            count(t.id) FILTER (WHERE t.estado = ANY($1))::int AS abiertas,
            count(t.id)::int AS total
       FROM proyecto p
       LEFT JOIN tarea t ON t.proyecto_id = p.id
      WHERE p.estado IN ('en_curso', 'planificacion')
      GROUP BY p.id
      ORDER BY abiertas DESC, p.fecha_fin NULLS LAST
      LIMIT $2`,
    [ABIERTAS, limite],
  );
}

/**
 * Ingresos y egresos por mes.
 *
 * Delega en `flujoMensual()` de finanzas por lo mismo que `balanceDelMes()`:
 * la misma gráfica la dibujan el panel y los reportes, y el relleno de los
 * meses vacíos tiene que estar escrito una sola vez.
 */
export async function flujoFinanciero(meses = 6): Promise<MesFinanciero[]> {
  return flujoMensual(meses);
}

export type BalanceMes = { ingresos: number; egresos: number };

/**
 * Ingresos y egresos del mes en curso, para la cifra de cabecera.
 *
 * Delega en `resumenDelMesEnCurso()` de finanzas, que es la misma consulta y
 * ahora tiene dos consumidores: esta cabecera y el portal de contabilidad.
 * Tenerla escrita dos veces era tenerla escrita para divergir —basta con que
 * un día una de las dos empiece a excluir una categoría—, y el balance del mes
 * tiene que ser un solo número en todo el sitio.
 *
 * Se queda la función y su tipo: el panel solo quiere las dos sumas, y no tiene
 * por qué saber del resto del resumen.
 */
export async function balanceDelMes(): Promise<BalanceMes> {
  const { ingresos, egresos } = await resumenDelMesEnCurso();

  return { ingresos, egresos };
}

export type EventoPanel = {
  id: string;
  titulo: string;
  tipo: string;
  fecha: string;
  hora_inicio: string | null;
  ubicacion: string | null;
};

/** Lo próximo del calendario institucional, cancelados aparte. */
export async function eventosProximos(limite = 5): Promise<EventoPanel[]> {
  return consultar<EventoPanel>(
    `SELECT id, titulo, tipo, fecha::text AS fecha, hora_inicio, ubicacion
       FROM evento
      WHERE fecha >= CURRENT_DATE
        AND estado <> 'cancelado'
      ORDER BY fecha, hora_inicio NULLS LAST
      LIMIT $1`,
    [limite],
  );
}
