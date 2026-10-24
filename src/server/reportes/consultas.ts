import { consultar, consultarUna } from "@/lib/db";

/**
 * Consultas de los reportes.
 *
 * TRES REGLAS, y las tres son la misma en el fondo: un informe se lee para
 * decidir, así que ninguna cifra puede salir de una muestra.
 *
 *   1. **Todo se agrega en SQL.** Ninguna función de aquí devuelve filas para
 *      que la pantalla las cuente: devuelve el recuento. Un promedio calculado
 *      sobre las 500 filas que caben en una lista es el promedio de esas 500,
 *      no el de la Fundación.
 *
 *   2. **Nada se rellena con ceros inventados.** Si una materia de 360 no
 *      tiene notas, no sale en la gráfica de promedios por materia. Una barra a cero se lee
 *      como "sacaron cero", que es lo contrario de "todavía no hay notas".
 *
 *   3. **Lo que ya existía no se vuelve a escribir.** Las cifras académicas
 *      salen de `resumenDeNotas()` y las financieras de `@/server/finanzas`;
 *      aquí solo vive lo que ninguna pantalla pedía todavía. Un reporte con su
 *      propia versión del promedio es la forma más rápida de tener dos
 *      promedios distintos en el mismo sitio.
 */

/* ──────────────────────────── OPERACIONES ──────────────────────────── */

export type ProyectoEnReporte = {
  id: string;
  nombre: string;
  estado: string;
  tareas: number;
  hechas: number;
};

/**
 * Proyectos con sus tareas contadas, para el avance.
 *
 * Es lo mismo que hace `proyectosConAvance()` en operaciones, recortado a lo
 * que la gráfica necesita —sin descripción, sin responsable, sin fechas— y
 * ordenado por avance en vez de por estado: un informe de avance se lee de más
 * adelantado a menos, y una lista alfabética obliga a compararlos a ojo.
 *
 * El avance se CUENTA (`hechas` sobre `tareas`) y no se lee de
 * `proyecto.progreso`, que es un número escrito a mano que en la base dice 0%
 * mientras el avance real es del 33%. Las canceladas salen del denominador:
 * cancelar una tarea no puede hacer BAJAR el avance del proyecto.
 */
export async function proyectosParaReporte(): Promise<ProyectoEnReporte[]> {
  return consultar<ProyectoEnReporte>(
    `WITH conteo AS (
       SELECT p.id,
              p.nombre,
              p.estado,
              (SELECT count(*)::int FROM tarea t
                WHERE t.proyecto_id = p.id AND t.estado <> 'cancelada') AS tareas,
              (SELECT count(*)::int FROM tarea t
                WHERE t.proyecto_id = p.id AND t.estado = 'completada') AS hechas
         FROM proyecto p
     )
     SELECT id, nombre, estado, tareas, hechas
       FROM conteo
      ORDER BY CASE WHEN tareas = 0 THEN -1
                    ELSE hechas::numeric / tareas
               END DESC,
               nombre`,
  );
}

export type RepartoEstado = { estado: string; total: number };

/** Proyectos por estado, para el anillo. */
export async function proyectosPorEstado(): Promise<RepartoEstado[]> {
  return consultar<RepartoEstado>(
    `SELECT estado, count(*)::int AS total
       FROM proyecto
      GROUP BY estado
      ORDER BY total DESC`,
  );
}

/**
 * Tareas por estado.
 *
 * Incluye las que no cuelgan de ningún proyecto: son trabajo del equipo igual
 * que las demás, y un informe de operaciones que solo contara las de proyecto
 * dejaría fuera justo las urgencias, que casi nunca nacen dentro de uno.
 */
export async function tareasPorEstado(): Promise<RepartoEstado[]> {
  return consultar<RepartoEstado>(
    `SELECT estado, count(*)::int AS total
       FROM tarea
      GROUP BY estado
      ORDER BY total DESC`,
  );
}

export type CifrasOperaciones = {
  proyectos: number;
  en_curso: number;
  completados: number;
  tareas_abiertas: number;
};

export async function cifrasDeOperaciones(): Promise<CifrasOperaciones> {
  const fila = await consultarUna<CifrasOperaciones>(
    `SELECT (SELECT count(*)::int FROM proyecto) AS proyectos,
            (SELECT count(*)::int FROM proyecto WHERE estado = 'en_curso') AS en_curso,
            (SELECT count(*)::int FROM proyecto WHERE estado = 'completado') AS completados,
            (SELECT count(*)::int FROM tarea
              WHERE estado IN ('pendiente', 'en_progreso')) AS tareas_abiertas`,
  );

  return (
    fila ?? { proyectos: 0, en_curso: 0, completados: 0, tareas_abiertas: 0 }
  );
}

/* ───────────────────────────── ACADÉMICO ───────────────────────────── */

export type PromedioAgrupado = {
  clave: string;
  promedio: number;
  notas: number;
};

/**
 * Promedio por materia de Global Effect 360, de las que tienen alguna nota.
 *
 * Mismo universo que `resumenDeNotas()`: la nota final de cada inscripción,
 * sin las retiradas. El JOIN deja fuera la materia sin ninguna nota, y está
 * bien así —ver la regla 2 de la cabecera: una barra a cero diría que
 * sacaron cero—.
 *
 * Topado a 12 materias: por encima de eso las barras horizontales dejan de
 * caber en pantalla y el informe se convierte en una lista larga que ya está
 * en `/academico/clases-360`.
 */
export async function promedioPorMateria360(
  periodoId?: string | null,
  limite = 12,
): Promise<PromedioAgrupado[]> {
  return consultar<PromedioAgrupado>(
    `SELECT m.nombre AS clave,
            round(avg(i.nota), 1)::float8 AS promedio,
            count(*)::int AS notas
       FROM inscripcion_360 i
       JOIN materia_360 m ON m.id = i.materia_id
      WHERE i.nota IS NOT NULL
        AND i.estado <> 'retirada'
        AND ($1::uuid IS NULL OR i.periodo_id = $1)
      GROUP BY m.id, m.nombre
      ORDER BY promedio DESC
      LIMIT $2`,
    [periodoId ?? null, limite],
  );
}

export type CifrasAcademicas = {
  estudiantes: number;
  /** Estudiantes con una materia de 360 en curso ahora. */
  cursando_360: number;
  /** Materias del catálogo de 360 abiertas. */
  clases_360: number;
  materias: number;
};

/**
 * El contexto del informe académico: sobre cuánta gente se está hablando.
 *
 * Ya no hay cifra de becados: desde la 0047 todo estudiante lo es y repetía
 * la de estudiantes activos.
 */
export async function cifrasAcademicas(): Promise<CifrasAcademicas> {
  const fila = await consultarUna<CifrasAcademicas>(
    `SELECT (SELECT count(*)::int FROM estudiante WHERE estado = 'activo') AS estudiantes,
            (SELECT count(DISTINCT estudiante_id)::int FROM inscripcion_360
              WHERE estado = 'cursando') AS cursando_360,
            (SELECT count(*)::int FROM materia_360 WHERE activa) AS clases_360,
            (SELECT count(*)::int FROM materia) AS materias`,
  );

  return fila ?? { estudiantes: 0, cursando_360: 0, clases_360: 0, materias: 0 };
}
