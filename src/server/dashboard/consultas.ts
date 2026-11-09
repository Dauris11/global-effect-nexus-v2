import { consultar, consultarUna } from "@/lib/db";
import { flujoMensual, type MesFinanciero } from "@/server/finanzas/consultas";

/**
 * Datos de las cifras y el flujo financiero que usan la bandeja y el asistente.
 *
 * Todo se pide en agregados o en listas cortas: el panel resume, y una consulta
 * que se traiga mil filas para contar cuántas hay es una consulta mal escrita.
 *
 * Nada de aquí filtra por permiso. El permiso se comprueba en la página, que es
 * la que decide qué bloques pide; lo que no se puede ver, no se consulta.
 */

/** Estados de una tarea que siguen abiertos. */
const ABIERTAS = ["por_hacer", "en_progreso", "en_revision"];

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

/**
 * Ingresos y egresos por mes.
 *
 * Delega en `flujoMensual()` de finanzas porque la misma gráfica la dibujan
 * la bandeja y los reportes, y el relleno de los
 * meses vacíos tiene que estar escrito una sola vez.
 */
export async function flujoFinanciero(meses = 6): Promise<MesFinanciero[]> {
  return flujoMensual(meses);
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
